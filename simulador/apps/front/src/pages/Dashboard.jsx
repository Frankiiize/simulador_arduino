import { useMemo } from 'react';
import { useApp } from '../context.js';
import { Card, Kpi, Gauge } from '../components.jsx';
import { alarmPresentation, alarmReasons, temperatureClass } from '../utils.js';

export default function Dashboard() {
  const { state, error, controllerOnline, telemetry, resources, controlAlarm } = useApp();
  const alarmMode = telemetry.modes.alarm || 'AUTO';
  const alarmUi = useMemo(() => alarmPresentation(telemetry.alarmState), [telemetry.alarmState]);
  const reasons = useMemo(() => alarmReasons(telemetry), [telemetry.temperature, telemetry.feedCount]);

  return (
    <>
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
        <ul className="alarm-reasons">
          {reasons.map(r => <li key={r}>{r}</li>)}
        </ul>
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
          <span className={controllerOnline ? temperatureClass(telemetry.temperature) : 'big-num'}>
            {controllerOnline ? telemetry.temperature.toFixed(1) : '--'}
          </span>
          <span className="big-unit">C</span>
        </div>
        <Gauge label="Humedad" value={controllerOnline ? telemetry.humidity : 0} max={100} color="blue" suffix={controllerOnline ? '%' : ' --'} />
      </Card>
    </>
  );
}
