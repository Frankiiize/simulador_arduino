const API_BASE = import.meta.env.VITE_API_BASE || '';

export async function fetchState() {
  const response = await fetch(`${API_BASE}/api/state`);
  if (!response.ok) throw new Error('No se pudo leer el estado');
  return response.json();
}

export async function sendControl(target, payload = {}) {
  const response = await fetch(`${API_BASE}/api/controls/${target}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error('No se pudo enviar el control');
  return response.json();
}

export async function updateResources(payload = {}) {
  const response = await fetch(`${API_BASE}/api/resources`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error('No se pudieron actualizar los recursos');
  return response.json();
}

export async function updateWeatherAutomation(payload = {}) {
  const response = await fetch(`${API_BASE}/api/weather/automation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error('No se pudo actualizar la automatizacion meteorologica');
  return response.json();
}

export async function refreshWeather() {
  const response = await fetch(`${API_BASE}/api/weather/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  if (!response.ok) throw new Error('No se pudo refrescar la meteorologia');
  return response.json();
}

export async function updateLightAutomation(payload = {}) {
  const response = await fetch(`${API_BASE}/api/light/automation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error('No se pudo actualizar la automatizacion de luces');
  return response.json();
}

export async function refreshTime() {
  const response = await fetch(`${API_BASE}/api/time/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  if (!response.ok) throw new Error('No se pudo refrescar la hora real');
  return response.json();
}

export async function setActiveLocation(id) {
  const response = await fetch(`${API_BASE}/api/locations/active`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id })
  });
  if (!response.ok) throw new Error('No se pudo cambiar la ubicacion');
  return response.json();
}

export async function addManualLocation(payload = {}) {
  const response = await fetch(`${API_BASE}/api/locations/manual`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error('No se pudo agregar la ubicacion');
  return response.json();
}

export async function setBrowserLocation(payload = {}) {
  const response = await fetch(`${API_BASE}/api/locations/browser`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error('No se pudo usar la ubicacion del navegador');
  return response.json();
}

export async function markLocationDenied() {
  const response = await fetch(`${API_BASE}/api/locations/denied`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  if (!response.ok) throw new Error('No se pudo aplicar la ubicacion por defecto');
  return response.json();
}

export async function resetLocation() {
  const response = await fetch(`${API_BASE}/api/locations/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  if (!response.ok) throw new Error('No se pudo restaurar la ubicacion por defecto');
  return response.json();
}

export function subscribeState(onState, onError) {
  const events = new EventSource(`${API_BASE}/api/events`);
  events.onmessage = event => onState(JSON.parse(event.data));
  events.onerror = error => onError?.(error);
  return () => events.close();
}
