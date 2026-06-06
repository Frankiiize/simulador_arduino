export function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, Math.round(number)));
}

export function alarmPresentation(state) {
  if (state === 'DANGER') return { className: 'alarm-red', label: 'ROJO - Urgente' };
  if (state === 'WARNING') return { className: 'alarm-amber', label: 'AMARILLO - Aviso' };
  return { className: 'alarm-green', label: 'VERDE - Todo OK' };
}

export function alarmReasons(telemetry) {
  const { temperature, feedCount } = telemetry;
  const reasons = [];

  if (temperature > 34)       reasons.push(`Temperatura crítica: ${temperature.toFixed(1)}°C (límite: 34°C)`);
  else if (temperature < 4)   reasons.push(`Temperatura crítica: ${temperature.toFixed(1)}°C (límite: 4°C)`);
  else if (temperature > 30)  reasons.push(`Temperatura elevada: ${temperature.toFixed(1)}°C (aviso: 30°C)`);
  else if (temperature < 7)   reasons.push(`Temperatura baja: ${temperature.toFixed(1)}°C (aviso: 7°C)`);
  else                        reasons.push(`Temperatura normal: ${temperature.toFixed(1)}°C`);

  if (feedCount >= 12)        reasons.push(`Suministro crítico: ${feedCount} ciclos (límite: 12)`);
  else if (feedCount >= 8)    reasons.push(`Suministro bajo: ${feedCount} ciclos (aviso: 8)`);
  else                        reasons.push(`Alimentación normal: ${feedCount} ciclos`);

  return reasons;
}

export function temperatureClass(temp) {
  if (temp > 26) return 'big-num red';
  if (temp < 10) return 'big-num blue';
  return 'big-num green';
}

export function formatNumber(value, digits = 1) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(digits) : '--';
}

export function formatClock(hour, minute) {
  const h = Number(hour);
  const m = Number(minute);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return '--:--';
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatCoordinate(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(4) : '--';
}

export function fanSpeedLevel(speed, running) {
  if (!running) return 'Detenido';
  if (speed < 35) return 'Baja';
  if (speed < 70) return 'Media';
  if (speed < 90) return 'Alta';
  return 'Turbo';
}
