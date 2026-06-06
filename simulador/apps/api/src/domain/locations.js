export const CHILE_LOCATIONS = [
  { id: 'cl-arica', label: 'Arica', region: 'Arica y Parinacota', latitude: -18.4783, longitude: -70.3126, timezone: 'America/Santiago' },
  { id: 'cl-iquique', label: 'Iquique', region: 'Tarapaca', latitude: -20.2307, longitude: -70.1357, timezone: 'America/Santiago' },
  { id: 'cl-antofagasta', label: 'Antofagasta', region: 'Antofagasta', latitude: -23.6509, longitude: -70.3975, timezone: 'America/Santiago' },
  { id: 'cl-copiapo', label: 'Copiapo', region: 'Atacama', latitude: -27.3668, longitude: -70.3323, timezone: 'America/Santiago' },
  { id: 'cl-la-serena', label: 'La Serena', region: 'Coquimbo', latitude: -29.9027, longitude: -71.2519, timezone: 'America/Santiago' },
  { id: 'cl-valparaiso', label: 'Valparaiso', region: 'Valparaiso', latitude: -33.0472, longitude: -71.6127, timezone: 'America/Santiago' },
  { id: 'cl-santiago', label: 'Santiago', region: 'Metropolitana', latitude: -33.4489, longitude: -70.6693, timezone: 'America/Santiago' },
  { id: 'cl-rancagua', label: 'Rancagua', region: "O'Higgins", latitude: -34.1708, longitude: -70.7407, timezone: 'America/Santiago' },
  { id: 'cl-talca', label: 'Talca', region: 'Maule', latitude: -35.4264, longitude: -71.6554, timezone: 'America/Santiago' },
  { id: 'cl-chillan', label: 'Chillan', region: 'Nuble', latitude: -36.6066, longitude: -72.1034, timezone: 'America/Santiago' },
  { id: 'cl-concepcion', label: 'Concepcion', region: 'Biobio', latitude: -36.8201, longitude: -73.0444, timezone: 'America/Santiago' },
  { id: 'cl-temuco', label: 'Temuco', region: 'La Araucania', latitude: -38.7359, longitude: -72.5904, timezone: 'America/Santiago' },
  { id: 'cl-valdivia', label: 'Valdivia', region: 'Los Rios', latitude: -39.8142, longitude: -73.2459, timezone: 'America/Santiago' },
  { id: 'cl-puerto-montt', label: 'Puerto Montt', region: 'Los Lagos', latitude: -41.4693, longitude: -72.9424, timezone: 'America/Santiago' },
  { id: 'cl-coyhaique', label: 'Coyhaique', region: 'Aysen', latitude: -45.5712, longitude: -72.0683, timezone: 'America/Santiago' },
  { id: 'cl-punta-arenas', label: 'Punta Arenas', region: 'Magallanes', latitude: -53.1638, longitude: -70.9171, timezone: 'America/Punta_Arenas' },
  { id: 'cl-hanga-roa', label: 'Hanga Roa', region: 'Rapa Nui', latitude: -27.1500, longitude: -109.4333, timezone: 'Pacific/Easter' }
];

export function createDefaultLocationState(location = createLocationFromEnv()) {
  return {
    active: location,
    fallback: location,
    presets: CHILE_LOCATIONS,
    manual: [],
    source: location.source || 'env',
    permission: 'unknown',
    error: null,
    updatedAt: new Date().toISOString()
  };
}

export function createLocationFromEnv(env = process.env) {
  return normalizeLocation({
    id: 'env-default',
    label: env.WEATHER_LOCATION || 'Santiago, CL',
    region: env.WEATHER_REGION || 'Configuracion',
    latitude: env.WEATHER_LATITUDE ?? -33.4489,
    longitude: env.WEATHER_LONGITUDE ?? -70.6693,
    timezone: env.WEATHER_TIMEZONE || 'America/Santiago',
    source: 'env'
  });
}

export function normalizeLocation(input = {}, fallback = {}) {
  const latitude = Number(input.latitude ?? fallback.latitude);
  const longitude = Number(input.longitude ?? fallback.longitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new Error('LATITUDE_INVALID');
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error('LONGITUDE_INVALID');
  }
  return {
    id: slug(input.id || fallback.id || input.label || 'manual-location'),
    label: String(input.label || fallback.label || 'Ubicacion manual').trim(),
    region: String(input.region || fallback.region || 'Manual').trim(),
    latitude,
    longitude,
    timezone: String(input.timezone || fallback.timezone || inferChileTimezone(latitude, longitude)).trim(),
    source: input.source || fallback.source || 'manual',
    accuracy: Number.isFinite(Number(input.accuracy)) ? Number(input.accuracy) : undefined
  };
}

export function findNearestChileLocation(latitude, longitude) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return CHILE_LOCATIONS
    .map(location => ({
      location,
      distanceKm: distanceKm(lat, lon, location.latitude, location.longitude)
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm)[0];
}

function inferChileTimezone(latitude, longitude) {
  if (longitude < -100) return 'Pacific/Easter';
  if (latitude < -50) return 'America/Punta_Arenas';
  return 'America/Santiago';
}

function slug(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'location';
}

function distanceKm(lat1, lon1, lat2, lon2) {
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(value) {
  return value * Math.PI / 180;
}
