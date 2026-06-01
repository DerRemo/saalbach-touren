# Route/Distanz zum nächstgelegenen Tour-Punkt — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Distance badge, "ab Quartier" badge, "nearest" sort, and the Route button target the nearest point of a tour's track instead of its recorded start — the Quartier is rarely near the official start. The tour GPX is never modified.

**Architecture:** `build_maps.py` stores a coarse downsampled track (`track: [[lon,lat],…]`, ≤80 pts) per bike tour. A new pure `geo.js` helper `nearestTrackPoint` finds the closest track point to the live Quartier. `quartier.js` routes `distanceKm`/`routeUrl` through it; `app.js` only adjusts the badge wording. No routing backend, no GPX surgery.

**Tech Stack:** Vanilla HTML/CSS/JS (no build step), Python 3 + Pillow + requests (build script), plain `node` assert tests.

**Testing note:** Automated TDD covers the pure helper in `geo.js` (Task 1, `node tests/geo.test.js`). Other tasks are verified by parse checks, the build, and the running app (`dev_server.py`) — the repo has no JS test harness and deliberately no build step.

---

## File Structure
- **Modify** `geo.js` — add pure `nearestTrackPoint(lat, lng, track)`.
- **Modify** `tests/geo.test.js` — add assertions for it.
- **Modify** `build_maps.py` — add `coarse_track()` and store `track` per tour.
- **Modify** `quartier.js` — `distanceKm` + `routeUrl` use the nearest track point.
- **Modify** `app.js` — badge wording ("zur Tour" + tooltip).
- **Modify** `service-worker.js` — bump cache to v12.
- **Generated** `tours_db.json` (gains `track` per tour).

---

## Task 1: `nearestTrackPoint` helper (`geo.js`) — TDD

**Files:**
- Modify: `geo.js`
- Test: `tests/geo.test.js`

- [ ] **Step 1: Add the failing test**

In `tests/geo.test.js`, change the require line:
```js
const { haversineKm, formatKm, parseLatLng, makeProjection } = require("../geo.js");
```
to:
```js
const { haversineKm, formatKm, parseLatLng, makeProjection, nearestTrackPoint } = require("../geo.js");
```
Then append, immediately before the final `console.log(...)` line:
```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/geo.test.js`
Expected: FAIL — `TypeError: nearestTrackPoint is not a function` (it isn't defined/exported yet).

- [ ] **Step 3: Implement the function**

In `geo.js`, add this function immediately after `parseLatLng` (before `makeProjection`):
```js
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
```
And add it to the export list. Change:
```js
  module.exports = { haversineKm, formatKm, validLatLng, parseLatLng, makeProjection };
```
to:
```js
  module.exports = { haversineKm, formatKm, validLatLng, parseLatLng, makeProjection, nearestTrackPoint };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/geo.test.js`
Expected: `geo.test.js: all assertions passed`

- [ ] **Step 5: Commit**

```bash
git add geo.js tests/geo.test.js
git commit -m "feat: add nearestTrackPoint helper (geo.js) with tests"
```

---

## Task 2: store coarse track per tour (`build_maps.py`)

**Files:**
- Modify: `build_maps.py`

- [ ] **Step 1: Add the `coarse_track` helper**

In `build_maps.py`, add this function right before `def main():`:
```python
def coarse_track(pts, target=80):
    """Downsample a (lon, lat) point list to at most `target` points for
    client-side nearest-point lookup. Always keeps the first and last point.
    Returns [[lon, lat], ...] rounded to 5 decimals."""
    n = len(pts)
    if n <= target:
        idxs = list(range(n))
    else:
        step = (n - 1) / (target - 1)
        idxs = sorted({int(round(i * step)) for i in range(target)} | {0, n - 1})
    return [[round(pts[i][0], 5), round(pts[i][1], 5)] for i in idxs]
```

- [ ] **Step 2: Store the track in `main()`**

In `main()`, inside the `if len(pts) >= 2:` block, the code currently reads:
```python
                render(tid, pts)
                t["images"] = [f"./maps/{tid}.webp"]
                t["start_lng"] = round(pts[0][0], 6)
                t["start_lat"] = round(pts[0][1], 6)
                all_starts.append((pts[0][0], pts[0][1]))
                tag = f"map({len(pts)}pts)"
```
Change it to:
```python
                render(tid, pts)
                t["images"] = [f"./maps/{tid}.webp"]
                t["start_lng"] = round(pts[0][0], 6)
                t["start_lat"] = round(pts[0][1], 6)
                t["track"] = coarse_track(pts)
                all_starts.append((pts[0][0], pts[0][1]))
                tag = f"map({len(pts)}pts)"
```

- [ ] **Step 3: Verify it compiles**

Run: `python3 -m py_compile build_maps.py`
Expected: no output, exit 0.

- [ ] **Step 4: Smoke-test the helper logic (no network)**

Run:
```bash
python3 -c "
import build_maps
pts=[(12.0+i*0.001, 47.0+i*0.001) for i in range(500)]
t=build_maps.coarse_track(pts)
print('len', len(t), 'first', t[0], 'last', t[-1])
assert len(t) <= 80, 'too many points'
assert t[0]==[12.0,47.0] and t[-1]==[round(pts[-1][0],5),round(pts[-1][1],5)], 'endpoints kept'
small=build_maps.coarse_track([(12.0,47.0),(12.1,47.1)])
assert small==[[12.0,47.0],[12.1,47.1]], 'small track kept as-is'
print('coarse_track OK')
"
```
Expected: prints `len <=80 …` then `coarse_track OK`. (Importing build_maps runs no network code — `main()` is guarded by `if __name__ == '__main__'`.)

- [ ] **Step 5: Commit**

```bash
git add build_maps.py
git commit -m "feat: build_maps stores a coarse track per tour for nearest-point lookup"
```

> The full data rebuild happens in Task 5.

---

## Task 3: route distance & URL via nearest point (`quartier.js`)

**Files:**
- Modify: `quartier.js`

- [ ] **Step 1: Replace `distanceKm` and `routeUrl` to use the nearest track point**

In `quartier.js`, the current code reads:
```js
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
```
Change it to:
```js
  // nearest point on this tour's coarse track to the current home (or null)
  function nearest(tour) {
    return nearestTrackPoint(home.lat, home.lng, tour.track);
  }

  // air-line distance from home to the nearest point of the tour; null if no track
  function distanceKm(tour) {
    const np = nearest(tour);
    return np === null ? null : np.km;
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
    const np = nearest(tour);
    if (np === null) return null;
    const origin = `${home.lat},${home.lng}`;
    const dest = `${np.lat},${np.lng}`;
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}`;
  }
```
(`nearestTrackPoint` is a geo.js global, loaded before quartier.js. `nearest` is internal — do NOT add it to the exported object. The exported API stays exactly: `init, getHome, setHome, resetHome, onHomeChange, distanceKm, isNear, formatDistance, routeUrl`.)

- [ ] **Step 2: Verify it parses**

Run:
```bash
node -e "global.localStorage={getItem:()=>null,setItem(){},removeItem(){}}; global.window={}; const g=require('./geo.js'); global.haversineKm=g.haversineKm; global.formatKm=g.formatKm; global.parseLatLng=g.parseLatLng; global.makeProjection=g.makeProjection; global.nearestTrackPoint=g.nearestTrackPoint; require('./quartier.js'); const q=global.window.Quartier; const t={track:[[12.5966667,47.3663889],[12.7,47.4]]}; console.log('dist', q.distanceKm(t).toFixed(3), 'route', q.routeUrl(t)); console.log('no-track', q.distanceKm({}), q.routeUrl({}));"
```
Expected: a small `dist` value and a `https://www.google.com/maps/dir/?api=1&origin=47.3663889,12.5966667&destination=47.3663889,12.5966667` URL (home defaults to Buchegg Resort, which equals the first track point here → distance ~0, destination = that point); the `no-track` line prints `null null`.

- [ ] **Step 3: Commit**

```bash
git add quartier.js
git commit -m "feat: distance + Route button target the nearest tour point, not the start"
```

---

## Task 4: badge wording (`app.js`)

**Files:**
- Modify: `app.js`

- [ ] **Step 1: Update the distance badge text + tooltip**

In `app.js` (in `renderTours`), the current line reads:
```js
    const distHtml = distStr
      ? `<div class="tour-distance" title="Luftlinie vom Quartier">${Quartier.isNear(tour) ? '<span class="near-tag">🏠 ab Quartier</span> · ' : ''}📍 ${distStr} Luftlinie</div>`
      : '';
```
Change it to:
```js
    const distHtml = distStr
      ? `<div class="tour-distance" title="Luftlinie zum nächstgelegenen Punkt der Tour">${Quartier.isNear(tour) ? '<span class="near-tag">🏠 ab Quartier</span> · ' : ''}📍 ${distStr} zur Tour</div>`
      : '';
```
Nothing else in `app.js` changes (sort + Route button already call through `Quartier`).

- [ ] **Step 2: Verify it parses**

Run: `node --check app.js`
Expected: no output, exit 0.

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "copy: distance badge reads 'zur Tour' (nearest point), updated tooltip"
```

---

## Task 5: cache bump, full rebuild, verify, commit data

**Files:**
- Modify: `service-worker.js`
- Generated: `tours_db.json`

- [ ] **Step 1: Bump the service-worker cache version**

In `service-worker.js`, change:
```js
const CACHE_NAME = "saalbach-tours-v11";
```
to:
```js
const CACHE_NAME = "saalbach-tours-v12";
```

- [ ] **Step 2: Commit the cache bump**

```bash
git add service-worker.js
git commit -m "chore: bump SW cache to v12 (tours_db gains track field)"
```

- [ ] **Step 3: Run the geo tests (guard)**

Run: `node tests/geo.test.js`
Expected: `geo.test.js: all assertions passed`

- [ ] **Step 4: Run the full build**

Run: `python3 build_maps.py`
Expected: ~64 `[n/64]` lines, an `overview written (...)` line, then `tours_db.json updated`. (Needs network; tiles are cached under `.tilecache`.)

- [ ] **Step 5: Verify the data**

Run:
```bash
python3 -c "
import json
d=json.load(open('tours_db.json'))
withtrack=[t for t in d if t.get('track')]
print('tours with track:', len(withtrack))
mx=max(len(t['track']) for t in withtrack)
print('max track points:', mx)
ok=all(len(t['track'])<=80 and len(t['track'][0])==2 for t in withtrack)
print('all tracks <=80 pts and [lon,lat]:', ok)
assert mx<=80 and ok
print('DATA OK')
"
```
Expected: `tours with track:` ~64, `max track points:` ≤80, `all tracks <=80 ...: True`, `DATA OK`.

- [ ] **Step 6: App walkthrough (manual)**

Run: `python3 dev_server.py`, open `http://localhost:8000`.
Expected: distance badges now read "📍 … km zur Tour" with the new tooltip; for a loop that passes near the Quartier, the badge shows the small distance to the nearest point (not the larger distance to the far start); the Route button opens Maps with the nearest point as destination; "Nächste zum Quartier" sorts by nearest-point distance; dragging the pin updates everything live. Stop the server.

- [ ] **Step 7: Commit the rebuilt data**

```bash
git add tours_db.json
git commit -m "data: add coarse track per tour"
```

---

## Self-Review Notes (for the implementer)
- **Spec coverage:** coarse track (Task 2) · nearestTrackPoint (Task 1) · distance+route via nearest point (Task 3) · badge wording (Task 4) · sort/isNear inherit via distanceKm (Tasks 1+3) · SW bump + rebuild (Task 5) · edge case no-track → null (Tasks 1+3). Overview map keeps start_lat/lng (untouched).
- **Names consistent across tasks:** `nearestTrackPoint(lat, lng, track)` returns `{lat, lng, km}`; track field `track` = `[[lon, lat], …]` (lon first, matching build geometry order); internal `nearest(tour)` in quartier.js not exported; exported API unchanged.
- **Order:** Task 3's parse check and Task 5's walkthrough read the new `track` field; the live data is rebuilt in Task 5. Task 3's check uses an inline synthetic tour, so it does not depend on the rebuild.
