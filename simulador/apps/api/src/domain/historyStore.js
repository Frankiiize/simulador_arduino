const MAX_SNAPSHOTS = 200;
const MAX_EVENTS = 100;
const SNAPSHOT_INTERVAL_MS = 5000;

let _counter = 0;

export class HistoryStore {
  constructor() {
    this.snapshots = [];
    this.events = [];
    this.lastSnapshotAt = 0;
  }

  maybeAddSnapshot(telemetry, hens) {
    const now = Date.now();
    if (now - this.lastSnapshotAt < SNAPSHOT_INTERVAL_MS) return;
    this.lastSnapshotAt = now;

    this.snapshots.push({
      t: new Date().toISOString(),
      temp: telemetry.temperature,
      hum: telemetry.humidity,
      eggs: telemetry.eggs,
      errors: telemetry.errorCount,
      alarm: telemetry.alarmState,
      feed: telemetry.feedCount,
      fan: telemetry.fanOn,
      heat: telemetry.heatOn,
      light: telemetry.lightOn,
      hens
    });

    if (this.snapshots.length > MAX_SNAPSHOTS) {
      this.snapshots.shift();
    }
  }

  addEvent(type, message, severity = 'info') {
    _counter++;
    this.events.unshift({
      id: `evt-${_counter}`,
      t: new Date().toISOString(),
      type,
      message,
      severity
    });
    if (this.events.length > MAX_EVENTS) {
      this.events.pop();
    }
  }

  getStats() {
    const snaps = this.snapshots;
    return {
      snapshots: snaps,
      events: this.events,
      summary: this._computeSummary(snaps)
    };
  }

  _computeSummary(snaps) {
    if (snaps.length === 0) {
      return { tempMin: null, tempMax: null, tempAvg: null, totalEggs: 0, totalErrors: 0, snapshotCount: 0 };
    }
    const temps = snaps.map(s => s.temp).filter(Number.isFinite);
    const last = snaps[snaps.length - 1];
    const tempAvg = temps.length ? temps.reduce((a, b) => a + b, 0) / temps.length : null;
    return {
      tempMin: temps.length ? Math.min(...temps) : null,
      tempMax: temps.length ? Math.max(...temps) : null,
      tempAvg: tempAvg !== null ? Math.round(tempAvg * 10) / 10 : null,
      totalEggs: last?.eggs ?? 0,
      totalErrors: last?.errors ?? 0,
      snapshotCount: snaps.length
    };
  }
}
