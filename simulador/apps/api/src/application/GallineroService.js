import { EventEmitter } from 'node:events';
import {
  createCoopState,
  createDefaultLightAutomation,
  createDefaultResources,
  createDefaultTelemetry,
  createDefaultTimeSource,
  createDefaultWeather,
  createDefaultWeatherAutomation,
  normalizeTelemetry
} from '../domain/coopState.js';
import { HistoryStore } from '../domain/historyStore.js';

const WOKWI_STALE_MS = 5000;
const LIGHT_TICK_MS = 60 * 1000;
const INITIAL_HENS = 50;
const DANGER_CYCLES_PER_DEATH = 10;

export class GallineroService extends EventEmitter {
  constructor({
    wokwiSimulator,
    weatherProvider,
    timeProvider,
    locationService,
    weatherAutomation = {},
    lightAutomation = {}
  }) {
    super();
    this.wokwiSimulator = wokwiSimulator;
    this.weatherProvider = weatherProvider;
    this.timeProvider = timeProvider;
    this.locationService = locationService;
    this.resources = createDefaultResources();
    this.telemetry = createDefaultTelemetry();
    this.weather = createDefaultWeather();
    this.weatherAutomation = {
      ...createDefaultWeatherAutomation(),
      ...weatherAutomation
    };
    this.timeSource = createDefaultTimeSource();
    this.lightAutomation = {
      ...createDefaultLightAutomation(),
      ...lightAutomation
    };
    this.source = 'disconnected';
    this.connected = false;
    this.lastWokwiTelemetryAt = 0;
    this.hens = INITIAL_HENS;
    this.dangerCycles = 0;
    this.lastWeatherCommand = '';
    this.lastLightCommand = '';
    this.timeRefreshInFlight = false;
    this.lightTimer = null;
    this.history = new HistoryStore();
    this._lastAlarmState = null;
    this._lastConnected = null;

    this.wokwiSimulator.on('telemetry', telemetry => {
      this.lastWokwiTelemetryAt = Date.now();
      this.telemetry = normalizeTelemetry(telemetry);
      this.source = 'wokwi';
      this.connected = true;
      this.updateMortality();
      this._trackAlarmChange(this.telemetry.alarmState);
      this.history.maybeAddSnapshot(this.telemetry, this.hens);
      this.emitState();
    });

    this.wokwiSimulator.on('status', status => {
      this.connected = Boolean(status.connected);
      this.source = this.connected ? 'wokwi' : 'disconnected';
      this._trackConnectionChange(this.connected);
      if (this.connected) {
        this.applyWeatherAutomation(true);
        this.applyLightAutomation(true);
      }
      this.emitState();
    });

    this.weatherProvider.on('weather', weather => {
      this.weather = weather;
      this.applyWeatherAutomation();
      this.applyLightAutomation();
      this.emitState();
    });

    this.weatherProvider.on('error', weather => {
      this.weather = weather;
      this.weatherAutomation = {
        ...this.weatherAutomation,
        decision: 'UNAVAILABLE',
        reason: weather.error || 'Servicio meteorologico no disponible'
      };
      this.maybeRefreshTimeSource();
      this.emitState();
    });

    this.timeProvider.on('time', timeSource => {
      this.timeSource = timeSource;
      this.applyLightAutomation();
      this.emitState();
    });

    this.timeProvider.on('error', timeSource => {
      this.timeSource = timeSource;
      this.applyLightAutomation();
      this.emitState();
    });

    this.locationService.on('changed', async locationState => {
      await this.applyLocationState(locationState);
      this.emitState();
    });
  }

  start() {
    this.wokwiSimulator.start();
    this.applyLocationState(this.locationService.getState());
    this.weatherProvider.start();
    this.applyLightAutomation(true);
    this.lightTimer = setInterval(() => {
      this.applyLightAutomation();
      this.emitState();
    }, LIGHT_TICK_MS);
  }

  getState() {
    const usingWokwi = this.connected && !this.isWokwiStale();
    return createCoopState({
      source: usingWokwi ? 'wokwi' : 'disconnected',
      connected: usingWokwi,
      controller: {
        connected: usingWokwi,
        source: usingWokwi ? 'wokwi' : 'disconnected',
        lastTelemetryAt: this.lastWokwiTelemetryAt ? new Date(this.lastWokwiTelemetryAt).toISOString() : null,
        stale: this.isWokwiStale(),
        rfc2217: true
      },
      telemetry: this.telemetry,
      resources: this.resources,
      weather: this.weather,
      weatherAutomation: this.weatherAutomation,
      timeSource: this.resolveCurrentTime(),
      lightAutomation: this.lightAutomation,
      location: this.locationService.getState(),
      hens: this.hens
    });
  }

  updateMortality() {
    const { alarmState, temperature } = this.telemetry;
    const tempDanger = temperature > 34 || temperature < 4;
    if (alarmState === 'DANGER' && tempDanger) {
      this.dangerCycles++;
      if (this.dangerCycles >= DANGER_CYCLES_PER_DEATH && this.hens > 0) {
        this.hens = Math.max(0, this.hens - 1);
        this.dangerCycles = 0;
        this.history.addEvent('MORTALITY', `Mortalidad registrada: ${this.hens} gallinas activas (T: ${temperature.toFixed(1)} C)`, 'danger');
      }
    } else {
      this.dangerCycles = 0;
    }
  }

  _trackAlarmChange(newAlarm) {
    if (newAlarm === this._lastAlarmState) return;
    this._lastAlarmState = newAlarm;
    const severityMap = { DANGER: 'danger', WARNING: 'warning', OK: 'success', AUTO: 'info' };
    const labelMap = { DANGER: 'PELIGRO', WARNING: 'ADVERTENCIA', OK: 'OK', AUTO: 'AUTO' };
    this.history.addEvent('ALARM', `Alarma cambiada a ${labelMap[newAlarm] || newAlarm}`, severityMap[newAlarm] || 'info');
  }

  _trackConnectionChange(connected) {
    if (connected === this._lastConnected) return;
    this._lastConnected = connected;
    if (connected) {
      this.history.addEvent('CONNECTION', 'Simulador Wokwi conectado', 'success');
    } else {
      this.history.addEvent('CONNECTION', 'Simulador Wokwi desconectado', 'warning');
    }
  }

  getStats() {
    return this.history.getStats();
  }

  async control(target, payload = {}) {
    const command = this.toSerialCommand(target, payload);
    let sent = false;
    if (command) {
      sent = this.wokwiSimulator.sendCommand(command);
    }

    if (target === 'feed') {
      this.history.addEvent('FEED', 'Ciclo de alimentacion activado manualmente', 'info');
    }
    if (target === 'reset') {
      this.history.addEvent('SYSTEM', 'Sistema reiniciado a modo automatico', 'success');
    }

    if (target === 'resources') {
      this.updateResources(payload);
      this.emitState();
    }
    if (target === 'weather-automation') {
      this.updateWeatherAutomation(payload);
      this.applyWeatherAutomation(true);
      this.emitState();
    }
    if (target === 'weather-refresh') {
      await this.weatherProvider.refresh();
    }
    if (target === 'light-automation') {
      this.updateLightAutomation(payload);
      this.applyLightAutomation(true);
      this.emitState();
    }
    if (target === 'time-refresh') {
      await this.refreshTimeSource();
    }
    if (target === 'location-active') {
      this.locationService.setActiveById(payload.id);
    }
    if (target === 'location-manual') {
      const location = this.locationService.addManualLocation(payload);
      this.locationService.setActiveById(location.id);
    }
    if (target === 'location-browser') {
      this.locationService.setBrowserLocation(payload);
    }
    if (target === 'location-denied') {
      this.locationService.markBrowserDenied();
    }
    if (target === 'location-reset') {
      this.locationService.resetToDefault();
    }

    return {
      command,
      sent,
      state: this.getState()
    };
  }

  toSerialCommand(target, payload) {
    const mode = normalizeMode(payload.mode);
    const state = normalizeAlarm(payload.state);

    switch (target) {
      case 'fan':
        return `FAN:${mode}`;
      case 'fan-speed':
        return `FAN_SPEED:${clampInt(payload.speed, 0, 100, 60)}`;
      case 'heat':
        return `HEAT:${mode}`;
      case 'light':
        return `LIGHT:${mode}`;
      case 'alarm':
        return `ALARM:${state}`;
      case 'feed':
        return 'FEED';
      case 'reset':
        return 'RESET';
      case 'test':
        return 'TEST';
      case 'hour':
        return `HOUR:${clampInt(payload.hour, 0, 23, 6)}`;
      default:
        return null;
    }
  }

  getWeather() {
    return {
      weather: this.weather,
      weatherAutomation: this.weatherAutomation
    };
  }

  getTime() {
    return {
      timeSource: this.resolveCurrentTime(),
      lightAutomation: this.lightAutomation
    };
  }

  getLocations() {
    return this.locationService.getState();
  }

  updateResources(payload) {
    if (Number.isFinite(Number(payload.lux))) {
      this.resources.lux = clampInt(payload.lux, 0, 1000, this.resources.lux);
    }
    if (Number.isFinite(Number(payload.water))) {
      this.resources.water = clampInt(payload.water, 0, 100, this.resources.water);
    }
    if (Array.isArray(payload.silos)) {
      this.resources.silos = this.resources.silos.map(silo => {
        const next = payload.silos.find(item => item.id === silo.id);
        return next ? { ...silo, level: clampInt(next.level, 0, 100, silo.level) } : silo;
      });
    }
  }

  updateWeatherAutomation(payload) {
    const enabled = payload.enabled;
    this.weatherAutomation = {
      ...this.weatherAutomation,
      enabled: typeof enabled === 'boolean' ? enabled : this.weatherAutomation.enabled,
      lowTemp: clampNumber(payload.lowTemp, 0, 30, this.weatherAutomation.lowTemp),
      highTemp: clampNumber(payload.highTemp, 10, 50, this.weatherAutomation.highTemp)
    };
    if (this.weatherAutomation.lowTemp >= this.weatherAutomation.highTemp) {
      this.weatherAutomation.lowTemp = 10;
      this.weatherAutomation.highTemp = 26;
    }
  }

  applyWeatherAutomation(force = false) {
    if (!this.weatherAutomation.enabled) {
      this.weatherAutomation = {
        ...this.weatherAutomation,
        decision: 'DISABLED',
        reason: 'Automatizacion meteorologica desactivada'
      };
      return;
    }
    const current = this.weather.current;
    if (!current || !Number.isFinite(current.temperature)) {
      this.weatherAutomation = {
        ...this.weatherAutomation,
        decision: 'WAITING',
        reason: 'Esperando temperatura exterior'
      };
      return;
    }

    const decision = decideClimateCommand(current.temperature, this.weatherAutomation);
    const signature = `${decision.fan}:${decision.heat}`;
    this.weatherAutomation = {
      ...this.weatherAutomation,
      decision: decision.name,
      reason: decision.reason
    };

    if (!force && signature === this.lastWeatherCommand) return;
    const fanSent = this.sendSerialCommand(`FAN:${decision.fan}`);
    const heatSent = this.sendSerialCommand(`HEAT:${decision.heat}`);
    if (!fanSent || !heatSent) {
      this.weatherAutomation = {
        ...this.weatherAutomation,
        reason: `${decision.reason} (simulador desconectado)`
      };
      return;
    }
    this.lastWeatherCommand = signature;
    this.weatherAutomation = {
      ...this.weatherAutomation,
      lastAppliedAt: new Date().toISOString()
    };
  }

  updateLightAutomation(payload) {
    const enabled = payload.enabled;
    this.lightAutomation = {
      ...this.lightAutomation,
      enabled: typeof enabled === 'boolean' ? enabled : this.lightAutomation.enabled,
      onHour: clampInt(payload.onHour, 0, 23, this.lightAutomation.onHour),
      offHour: clampInt(payload.offHour, 0, 23, this.lightAutomation.offHour)
    };
  }

  applyLightAutomation(force = false) {
    if (!this.lightAutomation.enabled) {
      this.lightAutomation = {
        ...this.lightAutomation,
        decision: 'DISABLED',
        reason: 'Automatizacion horaria de luces desactivada'
      };
      return;
    }

    const currentTime = this.resolveCurrentTime();
    if (!Number.isFinite(currentTime.hour)) {
      this.lightAutomation = {
        ...this.lightAutomation,
        decision: 'WAITING',
        reason: 'Esperando hora real'
      };
      this.maybeRefreshTimeSource();
      return;
    }

    const decision = decideLightCommand(currentTime.hour, this.lightAutomation);
    this.lightAutomation = {
      ...this.lightAutomation,
      decision: decision.name,
      reason: `${decision.reason} (${currentTime.provider})`
    };

    if (!force && decision.light === this.lastLightCommand) return;
    const sent = this.sendSerialCommand(`LIGHT:${decision.light}`);
    if (!sent) {
      this.lightAutomation = {
        ...this.lightAutomation,
        reason: `${decision.reason} (${currentTime.provider}, simulador desconectado)`
      };
      return;
    }
    this.lastLightCommand = decision.light;
    this.lightAutomation = {
      ...this.lightAutomation,
      lastAppliedAt: new Date().toISOString()
    };
  }

  resolveCurrentTime() {
    const weatherTime = resolveTimeFromWeather(this.weather);
    if (weatherTime) return weatherTime;
    const providerTime = resolveTimeFromProvider(this.timeSource);
    if (providerTime) return providerTime;
    this.maybeRefreshTimeSource();
    return resolveSystemTime(this.weather.location?.timezone || this.timeSource.timezone || 'America/Santiago');
  }

  maybeRefreshTimeSource() {
    if (this.timeRefreshInFlight) return;
    this.refreshTimeSource();
  }

  async refreshTimeSource() {
    this.timeRefreshInFlight = true;
    try {
      const timezone = this.weather.location?.timezone || this.timeSource.timezone || 'America/Santiago';
      return await this.timeProvider.refresh(timezone);
    } finally {
      this.timeRefreshInFlight = false;
    }
  }

  async applyLocationState(locationState) {
    const location = locationState.active;
    this.weather = {
      ...this.weather,
      status: 'loading',
      location,
      error: null
    };
    this.timeSource = {
      ...this.timeSource,
      timezone: location.timezone,
      status: 'idle',
      error: null
    };
    await this.weatherProvider.setLocation(location);
    this.refreshTimeSource();
  }

  sendSerialCommand(command) {
    return this.wokwiSimulator.sendCommand(command);
  }

  isWokwiStale() {
    return Date.now() - this.lastWokwiTelemetryAt > WOKWI_STALE_MS;
  }

  emitState() {
    this.emit('state', this.getState());
  }
}

function normalizeMode(value) {
  const mode = String(value || 'AUTO').toUpperCase();
  return ['AUTO', 'ON', 'OFF'].includes(mode) ? mode : 'AUTO';
}

function normalizeAlarm(value) {
  const state = String(value || 'AUTO').toUpperCase();
  return ['AUTO', 'OK', 'WARNING', 'DANGER'].includes(state) ? state : 'AUTO';
}

function clampInt(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function decideClimateCommand(exteriorTemp, automation) {
  if (exteriorTemp >= automation.highTemp) {
    return {
      name: 'COOLING',
      fan: 'ON',
      heat: 'OFF',
      reason: `Temperatura exterior ${exteriorTemp.toFixed(1)} C sobre ${automation.highTemp} C`
    };
  }
  if (exteriorTemp <= automation.lowTemp) {
    return {
      name: 'HEATING',
      fan: 'OFF',
      heat: 'ON',
      reason: `Temperatura exterior ${exteriorTemp.toFixed(1)} C bajo ${automation.lowTemp} C`
    };
  }
  return {
    name: 'AUTO',
    fan: 'AUTO',
    heat: 'AUTO',
    reason: `Temperatura exterior ${exteriorTemp.toFixed(1)} C en rango`
  };
}

function decideLightCommand(hour, automation) {
  const inDaylight = isHourInsideWindow(hour, automation.onHour, automation.offHour);
  return {
    name: inDaylight ? 'LIGHT_ON' : 'LIGHT_OFF',
    light: inDaylight ? 'ON' : 'OFF',
    reason: inDaylight
      ? `Hora real ${hour}:00 dentro del horario ${automation.onHour}:00-${automation.offHour}:00`
      : `Hora real ${hour}:00 fuera del horario ${automation.onHour}:00-${automation.offHour}:00`
  };
}

function isHourInsideWindow(hour, onHour, offHour) {
  if (onHour === offHour) return true;
  if (onHour < offHour) return hour >= onHour && hour < offHour;
  return hour >= onHour || hour < offHour;
}

function resolveTimeFromWeather(weather) {
  const currentTime = weather.current?.time;
  if (!currentTime) return null;
  const parsed = parseOpenMeteoLocalTime(currentTime);
  if (!parsed) return null;
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - Date.parse(weather.updatedAt || new Date())) / 60000));
  const totalMinutes = (parsed.hour * 60 + parsed.minute + elapsedMinutes) % (24 * 60);
  return {
    provider: 'open-meteo',
    status: 'ok',
    timezone: weather.location?.timezone || 'auto',
    localTime: currentTime,
    hour: Math.floor(totalMinutes / 60),
    minute: totalMinutes % 60,
    updatedAt: weather.updatedAt,
    error: null
  };
}

function resolveTimeFromProvider(timeSource) {
  if (timeSource.status !== 'ok' || !timeSource.localTime) return null;
  const parsedAt = Date.parse(timeSource.localTime);
  if (!Number.isFinite(parsedAt)) return null;
  const elapsedMs = Math.max(0, Date.now() - Date.parse(timeSource.updatedAt || new Date()));
  return resolveTimeFromDate(new Date(parsedAt + elapsedMs), timeSource.timezone, timeSource.provider);
}

function resolveSystemTime(timezone) {
  return resolveTimeFromDate(new Date(), timezone, 'system');
}

function resolveTimeFromDate(date, timezone, provider) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(date);
  return {
    provider,
    status: 'ok',
    timezone,
    localTime: date.toISOString(),
    hour: Number(parts.find(part => part.type === 'hour')?.value),
    minute: Number(parts.find(part => part.type === 'minute')?.value),
    updatedAt: new Date().toISOString(),
    error: null
  };
}

function parseOpenMeteoLocalTime(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(value));
  if (!match) return null;
  return {
    hour: Number(match[4]),
    minute: Number(match[5])
  };
}
