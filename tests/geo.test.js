const assert = require("assert");
const { haversineKm, formatKm, parseLatLng, makeProjection, nearestTrackPoint } = require("../geo.js");

function near(a, b, tol, msg) {
  assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} not within ${tol} of ${b}`);
}

// haversineKm
assert.strictEqual(haversineKm(47, 12, 47, 12), 0, "same point = 0 km");
near(haversineKm(47, 12, 48, 12), 111.19, 0.6, "1 deg latitude ~111 km");
near(haversineKm(0, 0, 0, 1), 111.19, 0.6, "1 deg longitude at equator ~111 km");

// formatKm (German decimal comma)
assert.strictEqual(formatKm(2.34), "2,3 km", "one decimal below 10");
assert.strictEqual(formatKm(12.6), "13 km", "rounded at/above 10");

// parseLatLng — full Google URL prefers the !3d!4d place marker
const url =
  "https://www.google.com/maps/place/Buchegg+Resort/@47.3664215,12.5964977,459m/data=!3m1!1e3!4m9!3m8!1s0x4777000d38354397:0x359b31052edaf7a4!5m2!4m1!1i2!8m2!3d47.3663889!4d12.5966667!16s%2Fg%2F1tgcl3mp";
let p = parseLatLng(url);
assert.ok(p, "url parsed");
near(p.lat, 47.3663889, 1e-6, "url lat marker");
near(p.lng, 12.5966667, 1e-6, "url lng marker");

// bare "lat, lng"
p = parseLatLng("47.3663889, 12.5966667");
assert.ok(p, "bare parsed");
near(p.lat, 47.3663889, 1e-9, "bare lat");
near(p.lng, 12.5966667, 1e-9, "bare lng");

// unparseable / invalid → null
assert.strictEqual(parseLatLng("https://maps.app.goo.gl/mqWXWPtgnTrYJVtM7"), null, "short link → null");
assert.strictEqual(parseLatLng("garbage"), null, "garbage → null");
assert.strictEqual(parseLatLng("200, 999"), null, "out of range → null");

// projection round-trip (origin irrelevant for identity)
const proj = makeProjection({ z: 14, originX: 0, originY: 0, w: 900, h: 600 });
const xy = proj.toXY(12.5966667, 47.3663889);
const ll = proj.toLngLat(xy.x, xy.y);
near(ll.lng, 12.5966667, 1e-6, "proj round-trip lng");
near(ll.lat, 47.3663889, 1e-6, "proj round-trip lat");

// nearestTrackPoint — track is [[lon,lat], ...]
const track = [[12.0, 47.0], [12.5966667, 47.3663889], [13.0, 48.0]];
let np = nearestTrackPoint(47.3663889, 12.5966667, track);
assert.ok(np, "nearest point found");
near(np.km, 0, 1e-6, "exact match → 0 km");
near(np.lat, 47.3663889, 1e-9, "nearest lat");
near(np.lng, 12.5966667, 1e-9, "nearest lng");
np = nearestTrackPoint(47.01, 12.01, track);
near(np.lat, 47.0, 1e-9, "picks the closest (first) point");
near(np.lng, 12.0, 1e-9, "picks the closest (first) point lng");
assert.strictEqual(nearestTrackPoint(47, 12, []), null, "empty track → null");
assert.strictEqual(nearestTrackPoint(47, 12, undefined), null, "missing track → null");

console.log("geo.test.js: all assertions passed");
