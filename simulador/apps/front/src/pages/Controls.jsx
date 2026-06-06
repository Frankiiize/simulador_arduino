import { useApp } from '../context.js';
import { Card, ControlCard, Gauge, FanSpeedControl } from '../components.jsx';
import { formatClock } from '../utils.js';

export default function Controls() {
  const {
    controllerOnline, telemetry, resources, fanSpeed,
    controlMode, setFanSpeed, setLux,
    timeSource, lightAutomation,
    toggleLightAutomation, forceTimeRefresh,
  } = useApp();

  return (
    <>
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
          <strong>{timeSource.timezone || 'local'}</strong>
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
    </>
  );
}
