import { EventEmitter } from 'node:events';

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';

export class OpenMeteoWeatherAdapter extends EventEmitter {
  constructor({
    latitude = -33.4489,
    longitude = -70.6693,
    timezone = 'America/Santiago',
    locationLabel = 'Santiago, CL',
    pollMs = 10 * 60 * 1000
  } = {}) {
    super();
    this.latitude = Number(latitude);
    this.longitude = Number(longitude);
    this.timezone = timezone;
    this.locationLabel = locationLabel;
    this.pollMs = Number(pollMs);
    this.timer = null;
  }

  start() {
    this.refresh();
    if (this.timer) return;
    this.timer = setInterval(() => this.refresh(), this.pollMs);
  }

  setLocation(location) {
    this.latitude = Number(location.latitude);
    this.longitude = Number(location.longitude);
    this.timezone = location.timezone || this.timezone;
    this.locationLabel = location.label || this.locationLabel;
    return this.refresh();
  }

  async refresh() {
    const url = new URL(OPEN_METEO_URL);
    url.searchParams.set('latitude', String(this.latitude));
    url.searchParams.set('longitude', String(this.longitude));
    url.searchParams.set('timezone', this.timezone);
    url.searchParams.set('forecast_days', '1');
    url.searchParams.set('current', [
      'temperature_2m',
      'relative_humidity_2m',
      'apparent_temperature',
      'weather_code',
      'wind_speed_10m',
      'is_day'
    ].join(','));

    try {
      const response = await fetch(url, {
        headers: { accept: 'application/json' }
      });
      if (!response.ok) {
        throw new Error(`Open-Meteo HTTP ${response.status}`);
      }
      const data = await response.json();
      this.emit('weather', this.normalize(data));
    } catch (error) {
      this.emit('error', {
        provider: 'open-meteo',
        status: 'error',
        location: this.location(),
        current: null,
        updatedAt: new Date().toISOString(),
        error: error.message
      });
    }
  }

  normalize(data) {
    const current = data.current || {};
    return {
      provider: 'open-meteo',
      status: 'ok',
      location: this.location(data.timezone),
      current: {
        time: current.time || null,
        temperature: numberOrNull(current.temperature_2m),
        humidity: numberOrNull(current.relative_humidity_2m),
        apparentTemperature: numberOrNull(current.apparent_temperature),
        windSpeed: numberOrNull(current.wind_speed_10m),
        weatherCode: current.weather_code ?? null,
        isDay: current.is_day === 1
      },
      updatedAt: new Date().toISOString(),
      error: null
    };
  }

  location(timezone = this.timezone) {
    return {
      label: this.locationLabel,
      latitude: this.latitude,
      longitude: this.longitude,
      timezone
    };
  }
}

function numberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
