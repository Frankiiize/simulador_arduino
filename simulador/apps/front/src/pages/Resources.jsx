import { useApp } from '../context.js';
import { Card } from '../components.jsx';
import { FARM, calcFeedAutonomy, calcWaterAutonomy, autonomyColor } from '../utils.js';

export default function Resources() {
  const { state, telemetry, resources, action, refillSilos, setWater } = useApp();
  const hens = state.production.hens;
  const feed = calcFeedAutonomy(resources.silos, hens);
  const water = calcWaterAutonomy(resources.water, hens);

  return (
    <>
      <Card title="Comedero">
        <div className="status-row">
          <span>Compuerta</span>
          <strong>{telemetry.servoOpen ? 'Abierta' : 'Cerrada'}</strong>
        </div>
        <div className="status-row">
          <span>Ciclos totales</span>
          <strong>{telemetry.feedCount}</strong>
        </div>
        <div className="status-row">
          <span>Frecuencia</span>
          <strong>c/6 h simuladas · {FARM.feedCyclesPerDay} ciclos/día</strong>
        </div>
        <div className="status-row">
          <span>Ración por ciclo</span>
          <strong>{(feed.perCycleKg * 1000).toFixed(0)} g · {feed.perCycleKg.toFixed(2)} kg</strong>
        </div>
        <div className="button-row">
          <button className="btn btn-green" onClick={() => action('feed')}>Alimentar</button>
          <button className="btn" onClick={() => action('reset')}>Reset</button>
          <button className="btn btn-red" onClick={() => action('test')}>Test</button>
        </div>
      </Card>

      <Card title="Silos de alimento">
        <div className="resource-note">
          {FARM.feedPerHenGDay} g/gallina/día · {hens} gallinas activas
        </div>
        <div className="silos-row">
          {resources.silos.map(silo => {
            const kg = ((silo.level / 100) * FARM.siloCapacityKg).toFixed(1);
            return (
              <div className="silo-unit" key={silo.id}>
                <div className="silo-top" />
                <div className="silo-body">
                  <div className="silo-fill-bar" style={{ height: `${silo.level}%` }} />
                </div>
                <div className="silo-pct">{silo.level}%</div>
                <div className="silo-kg">{kg} kg</div>
                <div className="silo-name">Silo {silo.id}</div>
              </div>
            );
          })}
        </div>
        <div className="status-row">
          <span>Total disponible</span>
          <strong>{feed.totalKg.toFixed(1)} kg / {FARM.siloCapacityKg * resources.silos.length} kg</strong>
        </div>
        <div className="status-row">
          <span>Consumo diario</span>
          <strong>{feed.dailyKg.toFixed(2)} kg/día</strong>
        </div>
        <div className={`autonomy-badge ${autonomyColor(feed.autonomyDays)}`}>
          Autonomía alimentaria: <strong>{feed.autonomyDays.toFixed(1)} días</strong>
        </div>
        <button className="btn btn-green full" onClick={refillSilos}>Reponer silos</button>
      </Card>

      <Card title="Sistema de agua">
        <div className="resource-note">
          {FARM.waterPerHenMlDay} ml/gallina/día · {hens} gallinas · tanque {FARM.tankCapacityL} L
        </div>
        <div className="tank-outer">
          <div className="tank-wave-fill" style={{ height: `${resources.water}%` }} />
          <div className="tank-text">{resources.water}%</div>
        </div>
        <input type="range" min="0" max="100" value={resources.water} onChange={event => setWater(event.target.value)} />
        <div className="status-row">
          <span>Disponible</span>
          <strong>{water.totalL.toFixed(1)} L / {FARM.tankCapacityL} L</strong>
        </div>
        <div className="status-row">
          <span>Consumo diario</span>
          <strong>{water.dailyL.toFixed(1)} L/día</strong>
        </div>
        <div className={`autonomy-badge ${autonomyColor(water.autonomyDays)}`}>
          Autonomía hídrica: <strong>{water.autonomyDays.toFixed(1)} días</strong>
        </div>
      </Card>
    </>
  );
}
