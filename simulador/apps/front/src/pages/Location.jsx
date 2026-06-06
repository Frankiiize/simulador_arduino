import { useApp } from '../context.js';
import { Card } from '../components.jsx';
import { formatNumber, formatCoordinate, temperatureClass } from '../utils.js';

export default function Location() {
  const {
    telemetry, weather, weatherAutomation, activeLocation, locationState,
    manualLocation, setManualLocation,
    changeLocation, restoreDefaultLocation, useBrowserGeolocation,
    saveManualLocation, toggleWeatherAutomation, forceWeatherRefresh,
  } = useApp();

  return (
    <>
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
    </>
  );
}
