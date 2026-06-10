import { useApp } from '../context.js';
import { Card, Kpi } from '../components.jsx';

export default function Dashboard() {
  const { state, error, telemetry } = useApp();

  return (
    <>
      {error && <div className="notice">{error}</div>}

      <Card title="Resumen del día">
        <div className="kpi-row">
          <Kpi label="Huevos" value={telemetry.eggs} unit="u" color="green" />
          <Kpi label="Gallinas" value={state.production.hens} unit="act" color="cyan" />
          <Kpi label="Mortalidad" value={state.production.mortality} unit="hoy" color="green" />
          <Kpi label="Postura" value={state.production.posture} unit="%" color="amber" />
        </div>
      </Card>
    </>
  );
}
