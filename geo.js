// geo.js — pure geo/parse helpers, no DOM or browser APIs.
// Loaded as a plain <script> in the browser (functions become globals) and
// required by Node test scripts. No build step, no dependency.

// Great-circle distance in km between two lat/lng points.
function haversineKm(aLat, aLng, bLat, bLng) {
  const R = 6371; // mean Earth radius (km)
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Format a km distance the German way: "2,3 km" (< 10, one decimal),
// "13 km" (>= 10, rounded).
function formatKm(km) {
  if (km < 10) return km.toFixed(1).replace(".", ",") + " km";
  return Math.round(km) + " km";
}

// Validate a lat/lng pair; return {lat,lng} or null.
function validLatLng(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

// Parse coordinates from a full Google Maps URL or a "lat, lng" string.
// Returns {lat,lng} or null. Short links (maps.app.goo.gl) carry no coords
// and return null — the caller must tell the user to paste a full URL /
// coordinates, or drag the pin.
function parseLatLng(text) {
  if (typeof text !== "string") return null;
  const s = text.trim();
  // 1. Google place marker: ...!3d47.3663889!4d12.5966667...
  let m = s.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (m) return validLatLng(parseFloat(m[1]), parseFloat(m[2]));
  // 2. Map view center: ...@47.3664215,12.5964977,459m...
  m = s.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (m) return validLatLng(parseFloat(m[1]), parseFloat(m[2]));
  // 3. Bare "lat, lng"
  m = s.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (m) return validLatLng(parseFloat(m[1]), parseFloat(m[2]));
  return null;
}

// Nearest point on a coarse track to a given location.
// `track` is [[lon, lat], ...]; returns {lat, lng, km} of the closest point,
// or null if the track is missing/empty.
function nearestTrackPoint(lat, lng, track) {
  if (!Array.isArray(track) || track.length === 0) return null;
  let best = null;
  for (const p of track) {
    if (!Array.isArray(p) || p.length < 2) continue;
    const plng = p[0];
    const plat = p[1];
    if (!Number.isFinite(plat) || !Number.isFinite(plng)) continue;
    const km = haversineKm(lat, lng, plat, plng);
    if (best === null || km < best.km) best = { lat: plat, lng: plng, km };
  }
  return best;
}

// Web-Mercator projection bound to fixed overview parameters.
// meta = { z, originX, originY, w, h } in @1x logical pixels (from overview.json).
// Returns { toXY(lng,lat) -> {x,y}, toLngLat(x,y) -> {lng,lat} } in the
// overview image's local pixel space (SVG viewBox = "0 0 w h").
function makeProjection(meta) {
  const TILE = 256;
  const n = TILE * Math.pow(2, meta.z); // world size in px at this zoom
  return {
    toXY(lng, lat) {
      const gx = ((lng + 180) / 360) * n;
      const latR = (lat * Math.PI) / 180;
      const gy =
        ((1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2) * n;
      return { x: gx - meta.originX, y: gy - meta.originY };
    },
    toLngLat(x, y) {
      const gx = x + meta.originX;
      const gy = y + meta.originY;
      const lng = (gx / n) * 360 - 180;
      const latR = Math.atan(Math.sinh(Math.PI * (1 - (2 * gy) / n)));
      const lat = (latR * 180) / Math.PI;
      return { lng, lat };
    },
  };
}

// Dual export: browser globals (module undefined → skipped) + Node tests.
if (typeof module !== "undefined" && module.exports) {
  module.exports = { haversineKm, formatKm, validLatLng, parseLatLng, makeProjection, nearestTrackPoint };
}
