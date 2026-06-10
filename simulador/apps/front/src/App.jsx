import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
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
import { HudChip } from './components.jsx';
import { AppContext } from './context.js';
import { clampNumber } from './utils.js';
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

const AUTH_STORAGE_KEY = 'gallinero-auth';
const AUTH_USER = 'admin';
const AUTH_PASSWORD = '1234';

function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const submit = event => {
    event.preventDefault();
    if (username.trim() === AUTH_USER && password === AUTH_PASSWORD) {
      localStorage.setItem(AUTH_STORAGE_KEY, 'authenticated');
      setLoginError('');
      onLogin();
      return;
    }
    setLoginError('Usuario o contraseña incorrectos');
  };

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand">GallineroSmart</div>
        <h1>Ingreso al sistema</h1>
        <p>Panel de control de nave industrial</p>

        <form className="login-form" onSubmit={submit}>
          <label>
            Usuario
            <input
              autoComplete="username"
              autoFocus
              className="field"
              onChange={event => setUsername(event.target.value)}
              placeholder="admin"
              type="text"
              value={username}
            />
          </label>
          <label>
            Contraseña
            <input
              autoComplete="current-password"
              className="field"
              onChange={event => setPassword(event.target.value)}
              placeholder="1234"
              type="password"
              value={password}
            />
          </label>
          {loginError && <div className="login-error">{loginError}</div>}
          <button className="btn btn-green login-submit" type="submit">Ingresar</button>
        </form>
      </section>
    </main>
  );
}

export default function App() {
  const location = useLocation();
  const [authenticated, setAuthenticated] = useState(() => localStorage.getItem(AUTH_STORAGE_KEY) === 'authenticated');
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
    if (!authenticated) return undefined;

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
      next => { setState(next); setError(''); },
      () => setError('Reconectando API')
    );
    const poll = setInterval(load, 5000);
    return () => { unsubscribe(); clearInterval(poll); };
  }, [authenticated]);

  useEffect(() => {
    const updateClock = () => {
      setClock(new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
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
  const fanSpeed = controllerOnline ? clampNumber(telemetry.fanSpeed, 0, 100) : 0;
  const isDashboardRoute = location.pathname === '/';
  const isLifecycleRoute = location.pathname === '/ciclo-vida';

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
    await updateResources({
      silos: resources.silos.map(silo => ({ id: silo.id, level: 90 }))
    });
    const result = await sendControl('reset');
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
    setManualLocation({ label: '', latitude: '', longitude: '', timezone: 'America/Santiago' });
  };

  const logout = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setAuthenticated(false);
    setState(emptyState);
    setError('');
  };

  const ctx = {
    state, error, clock,
    telemetry, resources, weather, weatherAutomation,
    timeSource, lightAutomation, locationState, activeLocation,
    controllerOnline, fanSpeed,
    manualLocation, setManualLocation,
    controlMode, setFanSpeed, controlAlarm, action,
    setLux, setWater, refillSilos,
    toggleWeatherAutomation, forceWeatherRefresh,
    toggleLightAutomation, forceTimeRefresh,
    changeLocation, restoreDefaultLocation,
    useBrowserGeolocation, saveManualLocation,
  };

  if (!authenticated) {
    return <LoginScreen onLogin={() => setAuthenticated(true)} />;
  }

  return (
    <AppContext.Provider value={ctx}>
      <div className="app-shell">
        <header className="topbar">
          <div className="brand">GallineroSmart </div>
          <div className="topbar-right">
            <span>{clock}</span>
            <span>{state.production.hens} gallinas</span>
            <span className={`source-pill ${state.connected ? 'online' : 'offline'}`}>
              {state.connected ? 'SIMULADOR' : 'DESCONECTADO'}
            </span>
            <button className="logout-btn" onClick={logout} type="button">Salir</button>
            <div className="live-dot" />
          </div>
        </header>

        <nav className="app-nav">
          <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Dashboard</NavLink>
          <NavLink to="/controles" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Controles</NavLink>
          <NavLink to="/recursos" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Recursos</NavLink>
          <NavLink to="/ciclo-vida" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Ciclo de vida</NavLink>
          <NavLink to="/ubicacion" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Ubicación</NavLink>
          <NavLink to="/estadisticas" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Estadísticas</NavLink>
        </nav>

        <main className={`main ${!isDashboardRoute ? 'main-full' : ''}`}>
          {isDashboardRoute ? (
            <>
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
                <Outlet />
              </aside>
            </>
          ) : (
            <div className={isLifecycleRoute ? '' : 'dedicated-page'}>
              <Outlet />
            </div>
          )}
        </main>
      </div>
    </AppContext.Provider>
  );
}
