import { useMemo, useState } from 'react';
import { useApp } from '../context.js';

const STAGES = [
  {
    name: 'Pollito',
    days: 'Dia 1-7',
    week: 'Sem 1',
    tempMin: 30,
    tempMax: 35,
    lightH: 23,
    feed: 'Iniciador',
    feedRate: '1.8 kg/dia',
    color: '#ffe066',
    eggRate: 0,
    birdClass: 'chick',
    desc: 'Primera semana critica. La calefaccion es esencial y una temperatura bajo 30 C puede causar mortalidad masiva.'
  },
  {
    name: 'Cria',
    days: 'Sem 2-6',
    week: 'Sem 2-6',
    tempMin: 25,
    tempMax: 32,
    lightH: 20,
    feed: 'Iniciador',
    feedRate: '3.2 kg/dia',
    color: '#d29922',
    eggRate: 0,
    birdClass: 'pullet',
    desc: 'Reduccion gradual de temperatura, cerca de 1 C por semana, mientras las plumas reemplazan el plumon.'
  },
  {
    name: 'Recria',
    days: 'Sem 7-17',
    week: 'Sem 7-17',
    tempMin: 18,
    tempMax: 24,
    lightH: 14,
    feed: 'Crecimiento',
    feedRate: '5.5 kg/dia',
    color: '#58a6ff',
    eggRate: 0,
    birdClass: 'pullet',
    desc: 'Etapa de crecimiento. Se limita la luz a 14 horas para evitar adelantar la madurez sexual.'
  },
  {
    name: 'Inicio postura',
    days: 'Sem 18-22',
    week: 'Sem 18-22',
    tempMin: 18,
    tempMax: 24,
    lightH: 16,
    feed: 'Pre-postura',
    feedRate: '6.2 kg/dia',
    color: '#3fb950',
    eggRate: 40,
    birdClass: 'laying',
    desc: 'Aparecen los primeros huevos. Se aumenta la luz a 16 horas y se cambia a alimento de pre-postura con calcio.'
  },
  {
    name: 'Pico postura',
    days: 'Sem 23-45',
    week: 'Sem 23-45',
    tempMin: 18,
    tempMax: 22,
    lightH: 16,
    feed: 'Postura',
    feedRate: '7.0 kg/dia',
    color: '#3fb950',
    eggRate: 95,
    birdClass: 'laying',
    desc: 'Periodo de maxima produccion. Una gallina sana puede poner cerca de 6 huevos por semana.'
  },
  {
    name: 'Post-pico',
    days: 'Sem 46-60',
    week: 'Sem 46-60',
    tempMin: 18,
    tempMax: 22,
    lightH: 16,
    feed: 'Postura',
    feedRate: '6.8 kg/dia',
    color: '#d29922',
    eggRate: 75,
    birdClass: 'laying',
    desc: 'La postura cae gradualmente. Conviene monitorear calidad de cascara, consumo y estres del lote.'
  },
  {
    name: 'Muda',
    days: 'Sem 61-72',
    week: 'Sem 61-72',
    tempMin: 18,
    tempMax: 22,
    lightH: 10,
    feed: 'Muda',
    feedRate: '5.0 kg/dia',
    color: '#8b949e',
    eggRate: 0,
    birdClass: 'pullet',
    desc: 'Muda forzada o descarte. Se reduce la luz a 10 horas y se evalua si conviene un segundo ciclo productivo.'
  }
];

const RISKS = [
  ['T < 30 C causa hipotermia y muerte en horas', 'Falla electrica del calefactor implica mortalidad masiva', 'Sin agua por 12 h hay deshidratacion critica'],
  ['T < 25 C retrasa el crecimiento', 'Agua sucia aumenta infecciones respiratorias', 'Falta de alimento puede provocar canibalismo'],
  ['Luz > 14 h adelanta madurez y reduce vida productiva', 'Cambios bruscos de temperatura', 'Sobrealimentacion genera exceso de peso'],
  ['Sin 16 h de luz no inicia postura', 'T > 24 C reduce tamano del huevo', 'Sin agua por 2 h detiene la postura'],
  ['Sin agua por 2 h cesa la produccion inmediatamente', 'Golpe de calor sobre 30 C aumenta mortalidad', 'Falta de calcio produce huevos sin cascara'],
  ['Estres provoca caidas bruscas de produccion', 'Reducir luz bajo 16 h baja la postura', 'Aumenta el riesgo de enfermedades acumuladas'],
  ['Restriccion de alimento acelera la muda', 'Reducir a 10 h de luz', 'Evaluar rentabilidad del segundo ciclo']
];

const AUTOMATIONS = [
  ['Calefactor ON si T < 30 C', 'LED 23 h/dia programado', 'Alarma si T < 28 C o T > 36 C'],
  ['Calefactor ajusta -1 C/semana', 'Reduccion gradual de luz', 'Alarma si silo < 30%'],
  ['LED limitado a 14 h exactas', 'Sensor de peso semanal', 'Ventilacion si T > 24 C'],
  ['LED aumenta a 16 h', 'Alerta por primer huevo detectado', 'Sensor de nidales activo'],
  ['LED 16 h fijo', 'Extractor ON si T > 22 C', 'Contador de huevos automatico', 'Alarma si postura cae > 5%/dia'],
  ['Monitoreo de calidad de cascara', 'Alerta por caida de produccion > 10%', 'LED 16 h mantenido'],
  ['LED reducido a 10 h', 'Restriccion de alimento programada', 'Evaluacion automatizada del lote']
];

const EGG_CURVE = [
  { label: 'Sem 1-6 (Cria)', pct: 0 },
  { label: 'Sem 7-17 (Recria)', pct: 0 },
  { label: 'Sem 18-22 (Inicio)', pct: 40 },
  { label: 'Sem 23-30 (Subida)', pct: 85 },
  { label: 'Sem 31-45 (Pico)', pct: 95 },
  { label: 'Sem 46-52 (Post-pico)', pct: 80 },
  { label: 'Sem 53-60 (Declive)', pct: 70 },
  { label: 'Sem 61-72 (Muda)', pct: 0 }
];

const CRISIS = {
  cold: {
    title: 'Corte de calefaccion en pollitos',
    tone: 'danger',
    text: 'En la primera semana, una baja rapida de temperatura puede provocar hipotermia, agrupamiento y mortalidad en pocas horas.'
  },
  water: {
    title: 'Corte de agua 24 h',
    tone: 'danger',
    text: 'La produccion de huevos se detiene casi de inmediato y aumenta el riesgo de deshidratacion y mortalidad.'
  },
  heat: {
    title: 'Golpe de calor',
    tone: 'warning',
    text: 'Sobre 30 C baja el consumo, cae la postura y aumenta el riesgo de muerte si no hay ventilacion suficiente.'
  },
  feed: {
    title: 'Silo vacio 48 h',
    tone: 'warning',
    text: 'La falta de alimento afecta crecimiento, postura y bienestar. En postura puede bajar la produccion por varios dias.'
  },
  light: {
    title: 'Falla de luz en postura',
    tone: 'info',
    text: 'En etapas productivas, perder el fotoperiodo de 16 h reduce el estimulo de postura y puede retrasar la recuperacion.'
  }
};

function DetailRow({ label, value, color }) {
  return (
    <div className="lc-detail-row">
      <span>{label}</span>
      <strong style={color ? { color } : undefined}>{value}</strong>
    </div>
  );
}

export default function Lifecycle() {
  const { state } = useApp();
  const [stageIndex, setStageIndex] = useState(0);
  const [dead, setDead] = useState(state.production?.mortality ?? 0);
  const [crisis, setCrisis] = useState(null);

  const stage = STAGES[stageIndex];
  const alive = Math.max(0, (state.production?.hens ?? 50) - dead);
  const nextStage = STAGES[stageIndex + 1];
  const eggsPerDay = stage.eggRate > 0 ? Math.round(alive * (stage.eggRate / 100) * (6 / 7)) : 0;
  const eggsPerWeek = stage.eggRate > 0 ? Math.round(eggsPerDay * 7) : 0;
  const birds = useMemo(() => Array.from({ length: state.production?.hens ?? 50 }, (_, i) => i), [state.production?.hens]);

  const addMortality = () => setDead(current => Math.min(state.production?.hens ?? 50, current + 1));
  const resetMortality = () => setDead(0);

  return (
    <section className="lifecycle-page">
      <div className="lc-header">
        <div>
          <h1>Ciclo de vida completo</h1>
          <p>Gallina ponedora desde el dia 1 hasta la semana 72. Datos operativos para temperatura, luz, alimento, postura y riesgos.</p>
        </div>
        <div className="lc-summary">
          <span>{alive} vivas</span>
          <span>{dead} bajas</span>
          <span>{eggsPerDay || 0} huevos/dia</span>
        </div>
      </div>

      <div className="lc-timeline" aria-label="Etapas del ciclo de vida">
        {STAGES.map((item, index) => {
          const active = index === stageIndex;
          const complete = index < stageIndex;
          const progress = active || complete ? 100 : 0;
          return (
            <button
              className={`lc-stage ${active ? 'active' : ''}`}
              key={item.name}
              onClick={() => setStageIndex(index)}
              type="button"
            >
              <span className="lc-stage-index">{String(index + 1).padStart(2, '0')}</span>
              <span className="lc-stage-name">{item.name}</span>
              <span className="lc-stage-days">{item.days}</span>
              <span className="lc-stage-bar"><span style={{ background: item.color, width: `${progress}%` }} /></span>
            </button>
          );
        })}
      </div>

      <div className="lc-detail-grid">
        <article className="lc-card">
          <div className="lc-card-title">{stage.name} · {stage.days}</div>
          <p className="lc-description">{stage.desc}</p>
          <div className="lc-detail-list">
            <DetailRow label="Temperatura optima" value={`${stage.tempMin}-${stage.tempMax} C`} color={stage.color} />
            <DetailRow label="Horas de luz" value={`${stage.lightH} h/dia`} />
            <DetailRow label="Alimento" value={stage.feed} />
            <DetailRow label="Consumo" value={stage.feedRate} />
            <DetailRow label="Tasa postura" value={stage.eggRate > 0 ? `${stage.eggRate}%` : 'No aplica'} color={stage.eggRate > 0 ? 'var(--green)' : 'var(--muted)'} />
            <DetailRow label="Huevos/semana" value={eggsPerWeek > 0 ? eggsPerWeek : '--'} color={eggsPerWeek > 0 ? 'var(--amber)' : 'var(--muted)'} />
          </div>
        </article>

        <article className="lc-card">
          <div className="lc-card-title">Riesgos criticos</div>
          <ul className="lc-check-list risk">
            {RISKS[stageIndex].map(item => <li key={item}>{item}</li>)}
          </ul>
        </article>

        <article className="lc-card">
          <div className="lc-card-title">Automatizaciones activas</div>
          <ul className="lc-check-list automation">
            {AUTOMATIONS[stageIndex].map(item => <li key={item}>{item}</li>)}
          </ul>
          {nextStage && (
            <div className="lc-next-stage">
              <span>Proxima etapa</span>
              <strong>{nextStage.name}</strong>
              <small>{nextStage.days} · T {nextStage.tempMin}-{nextStage.tempMax} C · {nextStage.lightH} h luz</small>
            </div>
          )}
        </article>
      </div>

      <div className="lc-two-col">
        <article className="lc-card">
          <div className="lc-card-title">Estado del lote ({state.production?.hens ?? 50} aves)</div>
          <div className="lc-bird-grid">
            {birds.map(index => (
              <span
                className={`lc-bird-dot ${index >= alive ? 'dead' : stage.birdClass}`}
                key={index}
                title={`Ave ${index + 1}`}
              />
            ))}
          </div>
          <div className="lc-legend">
            <span><i className="legend-alive" /> Viva</span>
            <span><i className="legend-pullet" /> Pollona</span>
            <span><i className="legend-chick" /> Pollito</span>
            <span><i className="legend-dead" /> Baja</span>
          </div>
          <div className="button-row">
            <button className="btn btn-red" onClick={addMortality} type="button">Simular baja</button>
            <button className="btn btn-green" onClick={resetMortality} type="button">Reponer lote</button>
          </div>
          <div className="lc-footnote">Vivas: <strong className="green">{alive}</strong> / Bajas: <strong className="red">{dead}</strong></div>
        </article>

        <article className="lc-card">
          <div className="lc-card-title">Curva de postura semanal</div>
          <div className="lc-egg-chart">
            {EGG_CURVE.map(row => (
              <div className="lc-egg-row" key={row.label}>
                <span>{row.label}</span>
                <div className="lc-egg-track">
                  <div
                    style={{
                      width: `${row.pct}%`,
                      background: row.pct > 80 ? 'var(--green)' : row.pct > 40 ? 'var(--amber)' : 'var(--muted)'
                    }}
                  />
                </div>
                <strong>{row.pct > 0 ? `${row.pct}%` : '--'}</strong>
              </div>
            ))}
          </div>
          <div className="lc-footnote">Promedio etapa actual: <strong>{eggsPerDay > 0 ? `${eggsPerDay}/dia` : '--'}</strong> · Tasa: <strong>{stage.eggRate > 0 ? `${stage.eggRate}%` : 'No aplica'}</strong></div>
        </article>
      </div>

      <article className="lc-card">
        <div className="lc-card-title">Simulador de crisis</div>
        <div className="button-row lc-crisis-buttons">
          <button className="btn btn-red" onClick={() => setCrisis(CRISIS.cold)} type="button">Cortar calefaccion</button>
          <button className="btn btn-red" onClick={() => setCrisis(CRISIS.water)} type="button">Cortar agua 24 h</button>
          <button className="btn btn-amber" onClick={() => setCrisis(CRISIS.heat)} type="button">Golpe de calor</button>
          <button className="btn btn-amber" onClick={() => setCrisis(CRISIS.feed)} type="button">Silo vacio 48 h</button>
          <button className="btn" onClick={() => setCrisis(CRISIS.light)} type="button">Falla de luz</button>
          <button className="btn" onClick={() => setCrisis(null)} type="button">Restablecer</button>
        </div>
        {crisis && (
          <div className={`lc-crisis-result ${crisis.tone}`}>
            <strong>{crisis.title}</strong>
            <span>{crisis.text}</span>
          </div>
        )}
      </article>
    </section>
  );
}
