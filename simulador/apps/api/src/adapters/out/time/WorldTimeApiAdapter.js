import { EventEmitter } from 'node:events';

const WORLD_TIME_BASE_URL = 'https://worldtimeapi.org/api/timezone';

export class WorldTimeApiAdapter extends EventEmitter {
  constructor({ timezone = 'America/Santiago' } = {}) {
    super();
    this.timezone = timezone;
  }

  async refresh(timezone = this.timezone) {
    const safeTimezone = encodeTimezone(timezone);
    const url = `${WORLD_TIME_BASE_URL}/${safeTimezone}`;

    try {
      const response = await fetch(url, {
        headers: { accept: 'application/json' }
      });
      if (!response.ok) {
        throw new Error(`WorldTimeAPI HTTP ${response.status}`);
      }
      const data = await response.json();
      const time = normalizeWorldTime(data, timezone);
      this.emit('time', time);
      return time;
    } catch (error) {
      const time = {
        provider: 'worldtimeapi',
        status: 'error',
        timezone,
        localTime: null,
        hour: null,
        minute: null,
        updatedAt: new Date().toISOString(),
        error: error.message
      };
      this.emit('error', time);
      return time;
    }
  }
}

function normalizeWorldTime(data, fallbackTimezone) {
  const timezone = data.timezone || fallbackTimezone;
  const parsed = parseHourMinuteFromDate(data.datetime, timezone);
  return {
    provider: 'worldtimeapi',
    status: 'ok',
    timezone,
    localTime: data.datetime || null,
    hour: parsed.hour,
    minute: parsed.minute,
    updatedAt: new Date().toISOString(),
    error: null
  };
}

function parseHourMinuteFromDate(value, timezone) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { hour: null, minute: null };
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(date);
  return {
    hour: Number(parts.find(part => part.type === 'hour')?.value),
    minute: Number(parts.find(part => part.type === 'minute')?.value)
  };
}

function encodeTimezone(timezone) {
  return String(timezone || 'America/Santiago')
    .split('/')
    .map(part => encodeURIComponent(part))
    .join('/');
}
