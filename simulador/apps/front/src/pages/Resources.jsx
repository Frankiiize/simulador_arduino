import { useApp } from '../context.js';
import { Card } from '../components.jsx';

export default function Resources() {
  const { telemetry, resources, action, refillSilos, setWater } = useApp();

  return (
    <>
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
    </>
  );
}
