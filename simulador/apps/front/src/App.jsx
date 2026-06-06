import { useEffect, useMemo, useState } from 'react';
import {
  fetchState,
  addManualLocation,
  markLocationDenied,
  refreshTime,
  refreshWeather,
  resetLocation,
  sendControl,
  setActiveLocation,
  setBrowserLocation,
  subscribeState,
  updateLightAutomation,
  updateResources,
  updateWeatherAutomation
} from './api.js';
import { IndustrialScene } from './IndustrialScene.jsx';
import './styles.css';

const emptyState = {
  source: 'disconnected',
  connected: false,
  controller: {
    connected: false,
    source: 'disconnected',
    lastTelemetryAt: null,
    stale: true,
    rfc2217: true
  },
  alerts: [],
  updatedAt: new Date().toISOString(),
  telemetry: {
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
    modes: { fan: 'AUTO', heat: 'AUTO', light: 'AUTO', alarm: 'AUTO' }
  },
  production: { hens: 50, mortality: 0, posture: 0 },
  resources: {
    lux: 680,
    water: 74,
    silos: [
      { id: 'A', level: 68 },
      { id: 'B', level: 22 },
      { id: 'C', level: 85 }
    ]
  },
  weather: {
    provider: 'open-meteo',
    status: 'idle',
    location: { label: 'Santiago, CL', latitude: -33.4489, longitude: -70.6693 },
    current: null,
    updatedAt: null,
    error: null
  },
  weatherAutomation: {
    enabled: true,
    lowTemp: 10,
    highTemp: 26,
    decision: 'AUTO',
    reason: 'Esperando datos meteorologicos',
    lastAppliedAt: null
  },
  timeSource: {
    provider: 'system',
    status: 'idle',
    timezone: 'America/Santiago',
    localTime: null,
    hour: null,
    minute: null,
    updatedAt: null,
    error: null
  },
  lightAutomation: {
    enabled: true,
    onHour: 6,
    offHour: 20,
    decision: 'WAITING',
    reason: 'Esperando hora real',
    lastAppliedAt: null
  },
  location: {
    active: { id: 'env-default', label: 'Santiago, CL', latitude: -33.4489, longitude: -70.6693, timezone: 'America/Santiago', source: 'env' },
    fallback: { id: 'env-default', label: 'Santiago, CL', latitude: -33.4489, longitude: -70.6693, timezone: 'America/Santiago', source: 'env' },
    presets: [],
    manual: [],
    source: 'env',
    permission: 'unknown',
    error: null
  }
};

export default function App() {
  const [state, setState] = useState(emptyState);
  const [clock, setClock] = useState('');
  const [error, setError] = useState('');
  const [manualLocation, setManualLocation] = useState({
    label: '',
    latitude: '',
    longitude: '',
    timezone: 'America/Santiago'
  });

  useEffect(() => {
    const load = async () => {
      try {
        setState(await fetchState());
        setError('');
      } catch {
        setError('API no disponible');
      }
    };

    load();
    const unsubscribe = subscribeState(
      next => {
        setState(next);
        setError('');
      },
      () => setError('Reconectando API')
    );
    const poll = setInterval(load, 5000);
    return () => {
      unsubscribe();
      clearInterval(poll);
    };
  }, []);

  useEffect(() => {
    const updateClock = () => {
      setClock(new Date().toLocaleTimeString('es-CL', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }));
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  const telemetry = state.telemetry;
  const resources = state.resources;
  const weather = state.weather;
  const weatherAutomation = state.weatherAutomation;
  const timeSource = state.timeSource;
  const lightAutomation = state.lightAutomation;
  const locationState = state.location || emptyState.location;
  const activeLocation = locationState.active || emptyState.location.active;
  const controllerOnline = state.connected;
  const alarmMode = telemetry.modes.alarm || 'AUTO';
  const alarmUi = useMemo(() => alarmPresentation(telemetry.alarmState), [telemetry.alarmState]);
  const fanSpeed = controllerOnline ? clampNumber(telemetry.fanSpeed, 0, 100) : 0;

  const controlMode = async (target, mode) => {
    const result = await sendControl(target, { mode });
    setState(result.state);
  };

  const setFanSpeed = async speed => {
    const result = await sendControl('fan-speed', { speed: Number(speed) });
    setState(result.state);
  };

  const controlAlarm = async alarmState => {
    const result = await sendControl('alarm', { state: alarmState });
    setState(result.state);
  };

  const action = async target => {
    const result = await sendControl(target);
    setState(result.state);
  };

  const setLux = async lux => {
    const result = await updateResources({ lux: Number(lux) * 10 });
    setState(result.state);
  };

  const setWater = async water => {
    const result = await updateResources({ water: Number(water) });
    setState(result.state);
  };

  const refillSilos = async () => {
    const result = await updateResources({
      silos: resources.silos.map(silo => ({ id: silo.id, level: 90 }))
    });
    setState(result.state);
  };

  const toggleWeatherAutomation = async () => {
    const result = await updateWeatherAutomation({ enabled: !weatherAutomation.enabled });
    setState(result.state);
  };

  const forceWeatherRefresh = async () => {
    const result = await refreshWeather();
    setState(result.state);
  };

  const toggleLightAutomation = async () => {
    const result = await updateLightAutomation({ enabled: !lightAutomation.enabled });
    setState(result.state);
  };

  const forceTimeRefresh = async () => {
    const result = await refreshTime();
    setState(result.state);
  };

  const changeLocation = async id => {
    if (!id) return;
    const result = await setActiveLocation(id);
    setState(result.state);
  };

  const restoreDefaultLocation = async () => {
    const result = await resetLocation();
    setState(result.state);
  };

  const useBrowserGeolocation = () => {
    if (!navigator.geolocation) {
      markLocationDenied().then(result => setState(result.state));
      setError('Geolocalizacion no disponible; usando ubicacion .env');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async position => {
        const result = await setBrowserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
        setState(result.state);
        setError('');
      },
      async () => {
        const result = await markLocationDenied();
        setState(result.state);
        setError('Permiso de ubicacion denegado; usando ubicacion .env');
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 15 * 60 * 1000 }
    );
  };

  const saveManualLocation = async event => {
    event.preventDefault();
    const result = await addManualLocation(manualLocation);
    setState(result.state);
    setManualLocation({
      label: '',
      latitude: '',
      longitude: '',
      timezone: 'America/Santiago'
    });
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">GallineroSmart <span>NAVE INDUSTRIAL v1.0</span></div>
        <div className="topbar-right">
          <span>{clock}</span>
          <span>NAVE-01</span>
          <span>{state.production.hens} gallinas</span>
          <span className={`source-pill ${state.connected ? 'online' : 'offline'}`}>
            {state.connected ? 'SIMULADOR' : 'DESCONECTADO'}
          </span>
          <div className="live-dot" />
        </div>
      </header>

      <main className="main">
        <section className="scene-wrap">
          <IndustrialScene telemetry={telemetry} resources={resources} connected={state.connected} />
          {!state.connected && (
            <div className="scene-disconnected">
              <strong>Simulador desconectado</strong>
              <span>La visualización está congelada hasta recibir telemetría por RFC2217.</span>
            </div>
          )}
          <div className="hud">
            <HudChip color={controllerOnline ? 'green' : 'muted'} label={controllerOnline ? `T: ${telemetry.temperature.toFixed(1)} C` : 'T: --'} />
            <HudChip color={controllerOnline ? 'blue' : 'muted'} label={controllerOnline ? `H: ${telemetry.humidity}%` : 'H: --'} />
            <HudChip color={controllerOnline && telemetry.fanOn ? 'blue' : 'muted'} label={controllerOnline ? `EXTRACTOR: ${telemetry.fanOn ? `ON · ${fanSpeed}%` : 'OFF'}` : 'EXTRACTOR: --'} />
            <HudChip color={controllerOnline && telemetry.lightOn ? 'amber' : 'muted'} label={controllerOnline ? `LUZ: ${telemetry.lightOn ? 'ON' : 'OFF'} · ${telemetry.hour}h` : 'LUZ: --'} />
          </div>
        </section>

        <aside className="sidebar">
          {error && <div className="notice">{error}</div>}
          {state.alerts?.map(alert => (
            <div className={`system-alert ${alert.severity}`} key={alert.id}>
              <strong>{alert.title}</strong>
              <span>{alert.message}</span>
              {alert.meta?.lastTelemetryAt && (
                <small>Ultima telemetria: {new Date(alert.meta.lastTelemetryAt).toLocaleString('es-CL')}</small>
              )}
            </div>
          ))}

          <Card title="Estado del sistema">
            <div className={`alarm-state ${alarmUi.className}`}>
              <span>{alarmUi.label}</span>
            </div>
            <div className="button-row">
              <button className={`btn ${alarmMode === 'AUTO' ? 'btn-selected btn-selected-auto' : ''}`} onClick={() => controlAlarm('AUTO')}>Auto</button>
              <button className={`btn btn-green ${alarmMode === 'OK' ? 'btn-selected' : ''}`} onClick={() => controlAlarm('OK')}>Verde</button>
              <button className={`btn btn-amber ${alarmMode === 'WARNING' ? 'btn-selected' : ''}`} onClick={() => controlAlarm('WARNING')}>Amarillo</button>
              <button className={`btn btn-red ${alarmMode === 'DANGER' ? 'btn-selected' : ''}`} onClick={() => controlAlarm('DANGER')}>Rojo</button>
            </div>
          </Card>

          <Card title="Producción del día">
            <div className="kpi-row">
              <Kpi label="Huevos" value={telemetry.eggs} unit="u" color="green" />
              <Kpi label="Gallinas" value={state.production.hens} unit="act" color="cyan" />
              <Kpi label="Mortalidad" value={state.production.mortality} unit="hoy" color="green" />
              <Kpi label="Postura" value={state.production.posture} unit="%" color="amber" />
            </div>
          </Card>

          <Card title="Temperatura">
            <div className="big-reading">
              <span className={controllerOnline ? temperatureClass(telemetry.temperature) : 'big-num'}>{controllerOnline ? telemetry.temperature.toFixed(1) : '--'}</span>
              <span className="big-unit">C</span>
            </div>
            <Gauge label="Humedad" value={controllerOnline ? telemetry.humidity : 0} max={100} color="blue" suffix={controllerOnline ? '%' : ' --'} />
          </Card>

          <Card title="Localización">
            <div className="weather-grid">
              <div>
                <div className="kpi-label">Ubicación activa</div>
                <div className="weather-location">{activeLocation.label}</div>
              </div>
              <div className={`weather-status ${locationState.source === 'browser' ? 'ok' : 'warn'}`}>
                {locationState.source}
              </div>
            </div>
            <div className="status-row">
              <span>Coordenadas</span>
              <strong>{formatCoordinate(activeLocation.latitude)}, {formatCoordinate(activeLocation.longitude)}</strong>
            </div>
            <div className="status-row">
              <span>Zona</span>
              <strong>{activeLocation.timezone}</strong>
            </div>
            {locationState.error && <div className="mini-warning">{locationState.error}</div>}
            <select className="field" value={activeLocation.id} onChange={event => changeLocation(event.target.value)}>
              <option value="">Seleccionar ubicación</option>
              {activeLocation.id === 'env-default' && (
                <option value={activeLocation.id}>{activeLocation.label} · .env</option>
              )}
              {activeLocation.id === 'browser-location' && (
                <option value={activeLocation.id}>{activeLocation.label} · GPS</option>
              )}
              <optgroup label="Chile">
                {locationState.presets.map(location => (
                  <option key={location.id} value={location.id}>{location.label} · {location.region}</option>
                ))}
              </optgroup>
              {locationState.manual.length > 0 && (
                <optgroup label="Manual">
                  {locationState.manual.map(location => (
                    <option key={location.id} value={location.id}>{location.label}</option>
                  ))}
                </optgroup>
              )}
            </select>
            <div className="button-row">
              <button className="btn btn-green" onClick={useBrowserGeolocation}>Usar mi ubicación</button>
              <button className="btn" onClick={restoreDefaultLocation}>Default .env</button>
            </div>
            <form className="manual-location-form" onSubmit={saveManualLocation}>
              <input
                className="field"
                placeholder="Nombre"
                value={manualLocation.label}
                onChange={event => setManualLocation({ ...manualLocation, label: event.target.value })}
                required
              />
              <input
                className="field"
                placeholder="Latitud"
                value={manualLocation.latitude}
                onChange={event => setManualLocation({ ...manualLocation, latitude: event.target.value })}
                required
              />
              <input
                className="field"
                placeholder="Longitud"
                value={manualLocation.longitude}
                onChange={event => setManualLocation({ ...manualLocation, longitude: event.target.value })}
                required
              />
              <select
                className="field"
                value={manualLocation.timezone}
                onChange={event => setManualLocation({ ...manualLocation, timezone: event.target.value })}
              >
                <option value="America/Santiago">America/Santiago</option>
                <option value="America/Punta_Arenas">America/Punta_Arenas</option>
                <option value="Pacific/Easter">Pacific/Easter</option>
              </select>
              <button className="btn full" type="submit">Agregar manual</button>
            </form>
          </Card>

          <Card title="Meteorología exterior">
            <div className="weather-grid">
              <div>
                <div className="kpi-label">Ubicación</div>
                <div className="weather-location">{weather.location?.label || 'Sin configurar'}</div>
              </div>
              <div className={`weather-status ${weather.status === 'ok' ? 'ok' : 'warn'}`}>
                {weather.status === 'ok' ? 'ONLINE' : 'SIN DATOS'}
              </div>
            </div>
            <div className="big-reading">
              <span className={temperatureClass(weather.current?.temperature ?? telemetry.temperature)}>
                {formatNumber(weather.current?.temperature)}
              </span>
              <span className="big-unit">C ext</span>
            </div>
            <div className="status-row">
              <span>Sensación</span>
              <strong>{formatNumber(weather.current?.apparentTemperature)} C</strong>
            </div>
            <div className="status-row">
              <span>Humedad ext.</span>
              <strong>{formatNumber(weather.current?.humidity, 0)}%</strong>
            </div>
            <div className="status-row">
              <span>Viento</span>
              <strong>{formatNumber(weather.current?.windSpeed, 1)} km/h</strong>
            </div>
            <div className="tog-row">
              <div>
                <div className="tog-label">Auto clima externo</div>
                <div className="tog-sub">{weatherAutomation.reason}</div>
              </div>
              <button className={`tog button-toggle ${weatherAutomation.enabled ? 'on' : ''}`} onClick={toggleWeatherAutomation} aria-label="Alternar automatización meteorológica" />
            </div>
            <div className="status-row">
              <span>Decisión</span>
              <strong>{weatherAutomation.decision}</strong>
            </div>
            <button className="btn full" onClick={forceWeatherRefresh}>Actualizar clima</button>
          </Card>

          <ControlCard
            title="Iluminación LED"
            active={controllerOnline && telemetry.lightOn}
            mode={telemetry.modes.light}
            onMode={mode => controlMode('light', mode)}
            subtitle={`Ciclo solar · ${resources.lux} lux`}
          />
          <Gauge label="Intensidad" value={Math.round(resources.lux / 10)} max={100} color="amber" suffix="%" />
          <input type="range" min="0" max="100" value={Math.round(resources.lux / 10)} onChange={event => setLux(event.target.value)} />

          <Card title="Horario real de luz">
            <div className="weather-grid">
              <div>
                <div className="kpi-label">Hora local</div>
                <div className="weather-location">{formatClock(timeSource.hour, timeSource.minute)}</div>
              </div>
              <div className={`weather-status ${timeSource.status === 'ok' ? 'ok' : 'warn'}`}>
                {timeSource.provider}
              </div>
            </div>
            <div className="status-row">
              <span>Zona</span>
              <strong>{timeSource.timezone || weather.location?.timezone || 'local'}</strong>
            </div>
            <div className="status-row">
              <span>Horario</span>
              <strong>{lightAutomation.onHour}:00 - {lightAutomation.offHour}:00</strong>
            </div>
            <div className="tog-row">
              <div>
                <div className="tog-label">Auto hora real</div>
                <div className="tog-sub">{lightAutomation.reason}</div>
              </div>
              <button className={`tog button-toggle ${lightAutomation.enabled ? 'on' : ''}`} onClick={toggleLightAutomation} aria-label="Alternar automatización horaria de luces" />
            </div>
            <div className="status-row">
              <span>Decisión</span>
              <strong>{lightAutomation.decision}</strong>
            </div>
            <button className="btn full" onClick={forceTimeRefresh}>Actualizar hora</button>
          </Card>

          <ControlCard
            title="Extractor industrial"
            active={controllerOnline && telemetry.fanOn}
            mode={telemetry.modes.fan}
            onMode={mode => controlMode('fan', mode)}
            subtitle="Activa automático sobre 26 C"
          />
          <FanSpeedControl
            active={controllerOnline && telemetry.fanOn}
            disabled={!controllerOnline}
            onChange={setFanSpeed}
            speed={fanSpeed}
          />

          <ControlCard
            title="Calefactor"
            active={controllerOnline && telemetry.heatOn}
            mode={telemetry.modes.heat}
            onMode={mode => controlMode('heat', mode)}
            subtitle="Activa automático bajo 10 C"
          />

          <Card title="Comedero">
            <div className="status-row">
              <span>Compuerta</span>
              <strong>{telemetry.servoOpen ? 'Abierta' : 'Cerrada'}</strong>
            </div>
            <div className="status-row">
              <span>Ciclos</span>
              <strong>{telemetry.feedCount}</strong>
            </div>
            <div className="button-row">
              <button className="btn btn-green" onClick={() => action('feed')}>Alimentar</button>
              <button className="btn" onClick={() => action('reset')}>Reset</button>
              <button className="btn btn-red" onClick={() => action('test')}>Test</button>
            </div>
          </Card>

          <Card title="Silos de alimento">
            <div className="silos-row">
              {resources.silos.map(silo => (
                <div className="silo-unit" key={silo.id}>
                  <div className="silo-top" />
                  <div className="silo-body">
                    <div className="silo-fill-bar" style={{ height: `${silo.level}%` }} />
                  </div>
                  <div className="silo-pct">{silo.level}%</div>
                  <div className="silo-name">Silo {silo.id}</div>
                </div>
              ))}
            </div>
            <button className="btn btn-green full" onClick={refillSilos}>Reponer silos</button>
          </Card>

          <Card title="Sistema de agua">
            <div className="tank-outer">
              <div className="tank-wave-fill" style={{ height: `${resources.water}%` }} />
              <div className="tank-text">{resources.water}%</div>
            </div>
            <input type="range" min="0" max="100" value={resources.water} onChange={event => setWater(event.target.value)} />
          </Card>
        </aside>
      </main>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <section className="ctrl-card">
      <div className="s-title">{title}</div>
      {children}
    </section>
  );
}

function ControlCard({ title, active, mode, onMode, subtitle }) {
  return (
    <Card title={title}>
      <div className="tog-row">
        <div>
          <div className="tog-label">{active ? 'Activo' : 'Inactivo'}</div>
          <div className="tog-sub">{subtitle}</div>
        </div>
        <div className={`tog ${active ? 'on' : ''}`} />
      </div>
      <div className="segmented">
        {['AUTO', 'ON', 'OFF'].map(nextMode => (
          <button
            key={nextMode}
            className={mode === nextMode ? 'selected' : ''}
            onClick={() => onMode(nextMode)}
          >
            {nextMode}
          </button>
        ))}
      </div>
    </Card>
  );
}

function Gauge({ label, value, max, color, suffix }) {
  const width = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="gauge-wrap">
      <div className="gauge-label"><span>{label}</span><span>{value}{suffix}</span></div>
      <div className="gauge-track"><div className={`gauge-fill ${color}`} style={{ width: `${width}%` }} /></div>
    </div>
  );
}

function FanSpeedControl({ active, disabled, onChange, speed }) {
  const running = active && speed > 0;
  const rpm = running ? Math.round(speed * 18) : 0;
  const spinDuration = running ? `${Math.max(0.16, 1.35 - speed * 0.011)}s` : '1.35s';
  const flowDuration = running ? `${Math.max(0.52, (1.35 - speed * 0.011) * 3.2)}s` : '4s';
  const level = fanSpeedLevel(speed, running);

  return (
    <Card title="Velocidad del extractor">
      <div
        className={`fan-speed-panel ${running ? 'running' : ''} ${disabled ? 'disabled' : ''}`}
        style={{ '--fan-speed': `${speed}%`, '--fan-flow-duration': flowDuration, '--fan-spin-duration': spinDuration }}
      >
        <div className="fan-visual" aria-hidden="true">
          <div className="fan-air">
            <span />
            <span />
            <span />
          </div>
          <div className="fan-housing">
            <div className="fan-rotor">
              <span className="fan-blade blade-one" />
              <span className="fan-blade blade-two" />
              <span className="fan-blade blade-three" />
            </div>
            <div className="fan-hub" />
          </div>
        </div>
        <div className="fan-readout">
          <div className="fan-percent">{speed}<span>%</span></div>
          <div>
            <div className="fan-level">{level}</div>
            <div className="fan-rpm">{rpm} RPM</div>
          </div>
        </div>
        <div className="fan-meter">
          <div className="fan-meter-fill" style={{ width: `${speed}%` }} />
        </div>
        <input
          aria-label="Velocidad del ventilador"
          className="fan-range"
          disabled={disabled}
          max="100"
          min="0"
          onChange={event => onChange(event.target.value)}
          type="range"
          value={speed}
        />
      </div>
    </Card>
  );
}

function Kpi({ label, value, unit, color }) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-val ${color}`}>{value}<span className="kpi-unit">{unit}</span></div>
    </div>
  );
}

function HudChip({ color, label }) {
  return (
    <div className="hud-chip">
      <div className={`dot ${color}`} />
      <span>{label}</span>
    </div>
  );
}

function alarmPresentation(state) {
  if (state === 'DANGER') return { className: 'alarm-red', label: 'ROJO - Urgente' };
  if (state === 'WARNING') return { className: 'alarm-amber', label: 'AMARILLO - Aviso' };
  return { className: 'alarm-green', label: 'VERDE - Todo OK' };
}

function temperatureClass(temp) {
  if (temp > 26) return 'big-num red';
  if (temp < 10) return 'big-num blue';
  return 'big-num green';
}

function formatNumber(value, digits = 1) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(digits) : '--';
}

function formatClock(hour, minute) {
  const h = Number(hour);
  const m = Number(minute);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return '--:--';
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatCoordinate(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(4) : '--';
}

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function fanSpeedLevel(speed, running) {
  if (!running) return 'Detenido';
  if (speed < 35) return 'Baja';
  if (speed < 70) return 'Media';
  if (speed < 90) return 'Alta';
  return 'Turbo';
}
