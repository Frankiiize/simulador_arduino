import { fanSpeedLevel } from './utils.js';

export function Card({ title, children }) {
  return (
    <section className="ctrl-card">
      <div className="s-title">{title}</div>
      {children}
    </section>
  );
}

export function ControlCard({ title, active, mode, onMode, subtitle }) {
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

export function Gauge({ label, value, max, color, suffix }) {
  const width = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="gauge-wrap">
      <div className="gauge-label"><span>{label}</span><span>{value}{suffix}</span></div>
      <div className="gauge-track"><div className={`gauge-fill ${color}`} style={{ width: `${width}%` }} /></div>
    </div>
  );
}

export function FanSpeedControl({ active, disabled, onChange, speed }) {
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
            <span /><span /><span />
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

export function Kpi({ label, value, unit, color }) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-val ${color}`}>{value}<span className="kpi-unit">{unit}</span></div>
    </div>
  );
}

export function HudChip({ color, label }) {
  return (
    <div className="hud-chip">
      <div className={`dot ${color}`} />
      <span>{label}</span>
    </div>
  );
}
