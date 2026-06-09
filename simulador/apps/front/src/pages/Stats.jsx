import { useEffect, useRef, useState } from 'react';
import { fetchStats } from '../api.js';
import { Card, Kpi } from '../components.jsx';

const SEVERITY_LABEL = { danger: 'PELIGRO', warning: 'AVISO', success: 'OK', info: 'INFO' };
const TYPE_LABEL = {
  ALARM: 'Alarma',
  CONNECTION: 'Conexión',
  MORTALITY: 'Mortalidad',
  FEED: 'Alimentación',
  SYSTEM: 'Sistema'
};

function LineChart({ data, getValue, color, label, suffix = '', height = 72 }) {
  if (!data.length) {
    return (
      <div className="chart-wrap">
        <div className="chart-header"><span className="chart-label">{label}</span></div>
        <div className="chart-empty">Esperando datos del simulador…</div>
      </div>
    );
  }

  const values = data.map(getValue);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const W = 400;
  const H = height;
  const PAD = 4;

  const pts = values.map((v, i) => {
    const x = data.length === 1 ? W / 2 : (i / (data.length - 1)) * W;
    const y = H - PAD - ((v - min) / range) * (H - PAD * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const last = values[values.length - 1];

  return (
    <div className="chart-wrap">
      <div className="chart-header">
        <span className="chart-label">{label}</span>
        <span className="chart-range">
          {min.toFixed(1)} – {max.toFixed(1)}{suffix}
          <span className="chart-last"> · ahora: <strong>{last.toFixed(1)}{suffix}</strong></span>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="chart-svg">
        <line x1="0" y1={H - PAD} x2={W} y2={H - PAD} stroke="var(--border)" strokeWidth="1" />
        <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {data.length > 1 && (
          <circle
            cx={(values.length - 1) / (values.length - 1) * W}
            cy={H - PAD - ((last - min) / range) * (H - PAD * 2)}
            r="3"
            fill={color}
          />
        )}
      </svg>
    </div>
  );
}

function EventLog({ events }) {
  if (!events.length) {
    return <div className="chart-empty">Sin eventos registrados aún.</div>;
  }

  return (
    <ul className="event-log">
      {events.map(ev => (
        <li key={ev.id} className={`event-item event-${ev.severity}`}>
          <span className={`event-badge event-badge-${ev.severity}`}>{SEVERITY_LABEL[ev.severity] || ev.severity}</span>
          <span className="event-type">{TYPE_LABEL[ev.type] || ev.type}</span>
          <span className="event-msg">{ev.message}</span>
          <span className="event-time">{new Date(ev.t).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
        </li>
      ))}
    </ul>
  );
}

export default function Stats() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef(null);

  const load = async () => {
    try {
      const data = await fetchStats();
      setStats(data);
      setError('');
    } catch {
      setError('No se pudieron cargar las estadísticas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 10000);
    return () => clearInterval(intervalRef.current);
  }, []);

  const snaps = stats?.snapshots ?? [];
  const events = stats?.events ?? [];
  const summary = stats?.summary;

  return (
    <>
      <div className="stats-toolbar">
        <span className="stats-title">Estadísticas del sistema</span>
        <button className="btn btn-sm" onClick={load} disabled={loading}>
          {loading ? 'Actualizando…' : 'Actualizar'}
        </button>
      </div>

      {error && <div className="notice">{error}</div>}

      <Card title="Resumen de sesión">
        <div className="kpi-row">
          <Kpi
            label="Temp. mín"
            value={summary?.tempMin != null ? summary.tempMin.toFixed(1) : '--'}
            unit="°C"
            color="blue"
          />
          <Kpi
            label="Temp. máx"
            value={summary?.tempMax != null ? summary.tempMax.toFixed(1) : '--'}
            unit="°C"
            color="red"
          />
          <Kpi
            label="Temp. prom"
            value={summary?.tempAvg != null ? summary.tempAvg.toFixed(1) : '--'}
            unit="°C"
            color="amber"
          />
          <Kpi label="Huevos" value={summary?.totalEggs ?? '--'} unit="u" color="green" />
          <Kpi label="Errores" value={summary?.totalErrors ?? '--'} unit="ev" color={summary?.totalErrors > 0 ? 'red' : 'green'} />
          <Kpi label="Muestras" value={summary?.snapshotCount ?? 0} unit="" color="cyan" />
        </div>
      </Card>

      <Card title="Temperatura interior (°C)">
        <LineChart
          data={snaps}
          getValue={s => s.temp}
          color="var(--red)"
          label="Temperatura"
          suffix="°C"
        />
      </Card>

      <Card title="Humedad relativa (%)">
        <LineChart
          data={snaps}
          getValue={s => s.hum}
          color="var(--blue)"
          label="Humedad"
          suffix="%"
        />
      </Card>

      <Card title="Producción de huevos (acumulado)">
        <LineChart
          data={snaps}
          getValue={s => s.eggs}
          color="var(--green)"
          label="Huevos"
          suffix=" u"
        />
      </Card>

      <Card title="Gallinas activas">
        <LineChart
          data={snaps}
          getValue={s => s.hens}
          color="var(--amber)"
          label="Gallinas"
          suffix=" gall"
        />
      </Card>

      <Card title="Registro de errores del sistema">
        <LineChart
          data={snaps}
          getValue={s => s.errors}
          color="var(--red)"
          label="Errores acumulados"
          suffix=" ev"
          height={56}
        />
      </Card>

      <Card title="Bitácora de eventos (RF-06)">
        <EventLog events={events} />
      </Card>
    </>
  );
}
