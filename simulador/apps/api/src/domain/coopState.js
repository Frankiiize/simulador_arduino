export function createDefaultTelemetry() {
  return {
    temperature: 22,
    humidity: 65,
    alarmState: 'OK',
    fanOn: false,
    fanSpeed: 60,
    heatOn: false,
    lightOn: true,
    hour: 6,
    eggs: 0,
    feedCount: 0,
    errorCount: 0,
    servoOpen: false,
    modes: {
      fan: 'AUTO',
      heat: 'AUTO',
      light: 'AUTO',
      alarm: 'AUTO'
    }
  };
}

export function createDefaultResources() {
  return {
    lux: 680,
    water: 74,
    silos: [
      { id: 'A', level: 68 },
      { id: 'B', level: 22 },
      { id: 'C', level: 85 }
    ]
  };
}

export function createDefaultWeather() {
  return {
    provider: 'open-meteo',
    status: 'idle',
    location: {
      label: 'Santiago, CL',
      latitude: -33.4489,
      longitude: -70.6693,
      timezone: 'America/Santiago'
    },
    current: null,
    updatedAt: null,
    error: null
  };
}

export function createDefaultWeatherAutomation() {
  return {
    enabled: true,
    lowTemp: 10,
    highTemp: 26,
    decision: 'AUTO',
    reason: 'Esperando datos meteorologicos',
    lastAppliedAt: null
  };
}

export function createDefaultTimeSource() {
  return {
    provider: 'system',
    status: 'idle',
    timezone: 'America/Santiago',
    localTime: null,
    hour: null,
    minute: null,
    updatedAt: null,
    error: null
  };
}

export function createDefaultLightAutomation() {
  return {
    enabled: true,
    onHour: 6,
    offHour: 20,
    decision: 'WAITING',
    reason: 'Esperando hora real',
    lastAppliedAt: null
  };
}

export function normalizeTelemetry(raw = {}) {
  return {
    temperature: numberOr(raw.temp, 22),
    humidity: numberOr(raw.hum, 65),
    alarmState: String(raw.state || 'OK').toUpperCase(),
    fanOn: boolOr(raw.fan, false),
    fanSpeed: clampNumber(raw.fanSpeed, 0, 100, 60),
    heatOn: boolOr(raw.heat, false),
    lightOn: boolOr(raw.light, true),
    hour: numberOr(raw.hour, 6),
    eggs: numberOr(raw.eggs, 0),
    feedCount: numberOr(raw.feed, 0),
    errorCount: numberOr(raw.err, 0),
    servoOpen: boolOr(raw.servoOpen, false),
    modes: {
      fan: String(raw.fanMode || 'AUTO').toUpperCase(),
      heat: String(raw.heatMode || 'AUTO').toUpperCase(),
      light: String(raw.lightMode || 'AUTO').toUpperCase(),
      alarm: String(raw.alarmMode || 'AUTO').toUpperCase()
    }
  };
}

export function createCoopState({
  source,
  connected,
  controller = null,
  telemetry,
  resources,
  weather = createDefaultWeather(),
  weatherAutomation = createDefaultWeatherAutomation(),
  timeSource = createDefaultTimeSource(),
  lightAutomation = createDefaultLightAutomation(),
  location = null
}) {
  const hens = 50;
  const eggs = telemetry.eggs;
  const connection = controller || {
    connected,
    source,
    lastTelemetryAt: null,
    stale: !connected
  };
  const alerts = createAlerts({ connected, source, controller: connection, weather });
  return {
    source,
    connected,
    controller: connection,
    alerts,
    updatedAt: new Date().toISOString(),
    telemetry,
    production: {
      hens,
      mortality: 0,
      posture: Math.min(100, Math.round((eggs / hens) * 100))
    },
    resources,
    weather,
    weatherAutomation,
    timeSource,
    lightAutomation,
    location
  };
}

function createAlerts({ connected, source, controller, weather }) {
  const alerts = [];
  if (!connected || source === 'disconnected') {
    alerts.push({
      id: 'controller-disconnected',
      severity: 'critical',
      title: 'Controlador desconectado',
      message: 'No hay telemetria del simulador/Raspberry. Verifica Wokwi, RFC2217 y la alimentacion del controlador.',
      createdAt: new Date().toISOString(),
      meta: {
        lastTelemetryAt: controller.lastTelemetryAt,
        source
      }
    });
  }
  if (weather?.status === 'error') {
    alerts.push({
      id: 'weather-unavailable',
      severity: 'warning',
      title: 'Meteorologia no disponible',
      message: weather.error || 'No se pudo obtener meteorologia exterior.',
      createdAt: new Date().toISOString()
    });
  }
  return alerts;
}

function numberOr(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function boolOr(value, fallback) {
  if (value === true || value === 'true' || value === 1 || value === '1') return true;
  if (value === false || value === 'false' || value === 0 || value === '0') return false;
  return fallback;
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}
