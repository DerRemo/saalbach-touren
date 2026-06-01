// quartier.js — Quartier (home base) state + overview map modal.
// Depends on geo.js globals: haversineKm, formatKm, parseLatLng, makeProjection.
// Exposes window.Quartier for app.js (distance badges, route button, sort).

const Quartier = (() => {
  const DEFAULT_HOME = { name: "Buchegg Resort", lat: 47.3663889, lng: 12.5966667 };
  const STORAGE_KEY = "saalbach.home";
  const NEAR_KM = 2; // "ab Quartier" threshold (air-line)

  let home = readHome();
  let tours = [];
  let meta = null; // overview.json projection params
  let proj = null; // makeProjection(meta)
  const listeners = [];
  let els = {};

  function readHome() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const o = JSON.parse(raw);
        if (Number.isFinite(o.lat) && Number.isFinite(o.lng)) {
          return { name: o.name || "Eigenes Quartier", lat: o.lat, lng: o.lng };
        }
      }
    } catch (e) { /* ignore corrupt storage */ }
    return { ...DEFAULT_HOME };
  }

  function getHome() { return home; }

  function setHome(next) {
    if (!Number.isFinite(next.lat) || !Number.isFinite(next.lng)) return;
    home = { name: next.name || "Eigenes Quartier", lat: next.lat, lng: next.lng };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(home)); } catch (e) {}
    renderCurrent();
    renderOverlay();
    listeners.forEach((cb) => cb());
  }

  function resetHome() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    home = { ...DEFAULT_HOME };
    renderCurrent();
    renderOverlay();
    listeners.forEach((cb) => cb());
  }

  function onHomeChange(cb) { listeners.push(cb); }

  // air-line distance from home to a tour's start; null if tour lacks coords
  function distanceKm(tour) {
    if (!Number.isFinite(tour.start_lat) || !Number.isFinite(tour.start_lng)) return null;
    return haversineKm(home.lat, home.lng, tour.start_lat, tour.start_lng);
  }

  function isNear(tour) {
    const d = distanceKm(tour);
    return d !== null && d <= NEAR_KM;
  }

  function formatDistance(tour) {
    const d = distanceKm(tour);
    return d === null ? null : formatKm(d);
  }

  function routeUrl(tour) {
    if (!Number.isFinite(tour.start_lat) || !Number.isFinite(tour.start_lng)) return null;
    const origin = `${home.lat},${home.lng}`;
    const dest = `${tour.start_lat},${tour.start_lng}`;
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}`;
  }

  // --- DOM hooks (filled in Task 7); safe no-ops until init() wires them ---
  function renderCurrent() {}
  function renderOverlay() {}
  async function init(loadedTours) {
    tours = loadedTours || [];
  }

  return {
    init, getHome, setHome, resetHome, onHomeChange,
    distanceKm, isNear, formatDistance, routeUrl,
  };
})();

window.Quartier = Quartier;
