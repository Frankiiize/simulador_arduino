import { EventEmitter } from 'node:events';
import {
  createDefaultLocationState,
  createLocationFromEnv,
  findNearestChileLocation,
  normalizeLocation
} from '../domain/locations.js';

export class LocationService extends EventEmitter {
  constructor({ defaultLocation = createLocationFromEnv(), locationStore = null } = {}) {
    super();
    this.locationStore = locationStore;
    this.state = createDefaultLocationState(defaultLocation);
    this.restore();
  }

  getState() {
    return this.state;
  }

  setActiveById(id) {
    const location = this.findLocation(id);
    if (!location) throw new Error('LOCATION_NOT_FOUND');
    return this.setActive(location, location.source || 'preset');
  }

  addManualLocation(input) {
    const location = normalizeLocation({
      ...input,
      id: input.id || `manual-${Date.now()}`,
      source: 'manual'
    }, this.state.fallback);
    this.state = {
      ...this.state,
      manual: upsertLocation(this.state.manual, location),
      error: null,
      updatedAt: new Date().toISOString()
    };
    this.persist();
    this.emit('changed', this.state);
    return location;
  }

  setBrowserLocation(input) {
    const nearest = findNearestChileLocation(input.latitude, input.longitude);
    const label = nearest && nearest.distanceKm < 35
      ? `${nearest.location.label} (GPS)`
      : 'Ubicacion del navegador';
    const location = normalizeLocation({
      id: 'browser-location',
      label,
      region: nearest?.location.region || 'GPS',
      latitude: input.latitude,
      longitude: input.longitude,
      timezone: nearest?.location.timezone || this.state.fallback.timezone,
      source: 'browser',
      accuracy: input.accuracy
    }, this.state.fallback);
    return this.setActive(location, 'browser', 'granted');
  }

  markBrowserDenied() {
    this.state = {
      ...this.state,
      active: this.state.fallback,
      source: 'env',
      permission: 'denied',
      error: 'Permiso de geolocalizacion denegado; usando ubicacion .env',
      updatedAt: new Date().toISOString()
    };
    this.persist();
    this.emit('changed', this.state);
    return this.state;
  }

  resetToDefault() {
    return this.setActive(this.state.fallback, 'env');
  }

  findLocation(id) {
    return [...this.state.presets, ...this.state.manual, this.state.fallback]
      .find(location => location.id === id);
  }

  setActive(location, source = location.source || 'manual', permission = this.state.permission) {
    const active = normalizeLocation({ ...location, source }, this.state.fallback);
    this.state = {
      ...this.state,
      active,
      source,
      permission,
      error: null,
      updatedAt: new Date().toISOString()
    };
    this.persist();
    this.emit('changed', this.state);
    return this.state;
  }

  restore() {
    if (!this.locationStore) return;
    const saved = this.locationStore.load();
    const manual = Array.isArray(saved.manual)
      ? saved.manual.map(location => normalizeLocation(location, this.state.fallback))
      : [];
    const active = [...this.state.presets, ...manual, this.state.fallback]
      .find(location => location.id === saved.activeId) || this.state.fallback;
    this.state = {
      ...this.state,
      manual,
      active,
      source: active.source || (active.id === this.state.fallback.id ? 'env' : 'preset'),
      updatedAt: new Date().toISOString()
    };
  }

  persist() {
    if (!this.locationStore) return;
    this.locationStore.save({
      activeId: this.state.active.source === 'browser' ? this.state.fallback.id : this.state.active.id,
      manual: this.state.manual
    });
  }
}

function upsertLocation(locations, nextLocation) {
  const existing = locations.filter(location => location.id !== nextLocation.id);
  return [...existing, nextLocation];
}
