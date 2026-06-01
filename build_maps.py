#!/usr/bin/env python3
"""Enrich tours_db.json with starting-point text and a CARTO-Light route-map
thumbnail per bike tour. Map tiles are fetched once, the track is drawn on top,
and the result is bundled locally under maps/ so the PWA stays offline-capable.

Usage:
  python3 build_maps.py            # process all bike tours (resumable)
  python3 build_maps.py 7851373    # process a single tour id (test)
"""
import json, math, os, sys, time, io, xml.etree.ElementTree as ET
import requests
from PIL import Image, ImageDraw

KEY = "IMBSMP7G-EMWGKTHO-4OSSYIOS"
PROJ = "api-saalbach"
NS = "{http://www.outdooractive.com/api/}"
BIKE = {"Mountain Biking", "E-Bike", "Freeride/ Downhill", "Gravel Bike"}

ROOT = os.path.dirname(os.path.abspath(__file__))
MAPS_DIR = os.path.join(ROOT, "maps")
DB_PATH = os.path.join(ROOT, "tours_db.json")
TILE_CACHE = os.path.join(ROOT, ".tilecache")

W, H = 640, 360            # thumbnail size (logical px) — 16:9 to match card media
SCALE = 2                  # use @2x retina tiles for crisp output
TILE = 256
PAD = 0.14                 # fraction of bbox added as breathing room
ROUTE = (227, 38, 54)      # red
CASING = (255, 255, 255)   # white halo under the route
START = (34, 197, 94)      # green start dot
END = (239, 68, 68)        # red end dot
OW, OH = 900, 600          # overview map logical size (wide valley view)

os.makedirs(MAPS_DIR, exist_ok=True)
os.makedirs(TILE_CACHE, exist_ok=True)
SESSION = requests.Session()
SESSION.headers["User-Agent"] = "SaalbachTourFinder/1.0 (personal project)"


def fetch_detail(tour_id):
    url = f"https://www.outdooractive.com/api/project/{PROJ}/oois/{tour_id}?key={KEY}"
    r = SESSION.get(url, timeout=30)
    r.raise_for_status()
    root = ET.fromstring(r.content)
    tour = root.find(f"{NS}tour")
    # starting point text
    sp = tour.find(f"{NS}startingPointDescr")
    start_txt = (sp.text or "").strip() if sp is not None else ""
    # geometry -> list of (lon, lat)
    geo = tour.find(f"{NS}geometry")
    pts = []
    if geo is not None and geo.text:
        for triple in geo.text.split():
            parts = triple.split(",")
            if len(parts) >= 2:
                pts.append((float(parts[0]), float(parts[1])))
    return start_txt, pts


# --- Web Mercator helpers (global pixel coords at given zoom) ---
def lonlat_to_px(lon, lat, z):
    n = TILE * (2 ** z)
    x = (lon + 180.0) / 360.0 * n
    lat_r = math.radians(lat)
    y = (1.0 - math.log(math.tan(lat_r) + 1.0 / math.cos(lat_r)) / math.pi) / 2.0 * n
    return x, y


def pick_zoom(min_lon, min_lat, max_lon, max_lat):
    avail_w = W * (1 - 2 * PAD)
    avail_h = H * (1 - 2 * PAD)
    for z in range(16, 8, -1):
        x0, y0 = lonlat_to_px(min_lon, max_lat, z)
        x1, y1 = lonlat_to_px(max_lon, min_lat, z)
        if (x1 - x0) <= avail_w and (y1 - y0) <= avail_h:
            return z
    return 9


def get_tile(z, x, y):
    fn = os.path.join(TILE_CACHE, f"{z}_{x}_{y}.png")
    if os.path.exists(fn):
        return Image.open(fn).convert("RGBA")
    url = f"https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png"
    r = SESSION.get(url, timeout=30)
    r.raise_for_status()
    with open(fn, "wb") as f:
        f.write(r.content)
    time.sleep(0.05)
    return Image.open(io.BytesIO(r.content)).convert("RGBA")


def render(tour_id, pts):
    lons = [p[0] for p in pts]
    lats = [p[1] for p in pts]
    z = pick_zoom(min(lons), min(lats), max(lons), max(lats))
    ts = TILE * SCALE  # rendered tile size in px

    # center of route in global @2x px
    cx, cy = lonlat_to_px((min(lons) + max(lons)) / 2, (min(lats) + max(lats)) / 2, z)
    cx *= SCALE; cy *= SCALE
    out_w, out_h = W * SCALE, H * SCALE
    origin_x = cx - out_w / 2  # top-left of canvas in global px
    origin_y = cy - out_h / 2

    canvas = Image.new("RGBA", (out_w, out_h), (255, 255, 255, 255))
    tx0 = int(origin_x // ts)
    ty0 = int(origin_y // ts)
    tx1 = int((origin_x + out_w) // ts)
    ty1 = int((origin_y + out_h) // ts)
    maxt = 2 ** z
    for tx in range(tx0, tx1 + 1):
        for ty in range(ty0, ty1 + 1):
            if not (0 <= ty < maxt):
                continue
            tile = get_tile(z, tx % maxt, ty)
            px = int(tx * ts - origin_x)
            py = int(ty * ts - origin_y)
            canvas.alpha_composite(tile, (px, py))

    # project route to canvas px
    line = []
    for lon, lat in pts:
        gx, gy = lonlat_to_px(lon, lat, z)
        line.append((gx * SCALE - origin_x, gy * SCALE - origin_y))

    draw = ImageDraw.Draw(canvas)
    draw.line(line, fill=CASING + (255,), width=9 * 1, joint="curve")
    draw.line(line, fill=ROUTE + (255,), width=5 * 1, joint="curve")
    r = 9
    sx, sy = line[0]; ex, ey = line[-1]
    draw.ellipse([ex - r, ey - r, ex + r, ey + r], fill=END + (255,), outline=(255, 255, 255, 255), width=3)
    draw.ellipse([sx - r, sy - r, sx + r, sy + r], fill=START + (255,), outline=(255, 255, 255, 255), width=3)

    out = canvas.convert("RGB").resize((W, H), Image.LANCZOS)
    path = os.path.join(MAPS_DIR, f"{tour_id}.webp")
    out.save(path, "WEBP", quality=82, method=6)
    return path


def render_overview(starts):
    """Render one valley overview of all start points and emit the fixed
    Web-Mercator params to maps/overview.json so the frontend can place the
    draggable Quartier pin and clickable start dots over the static image.
    `starts` is a list of (lon, lat). Dots/pin are drawn client-side, not here."""
    lons = [p[0] for p in starts]
    lats = [p[1] for p in starts]
    min_lon, max_lon = min(lons), max(lons)
    min_lat, max_lat = min(lats), max(lats)

    # pick a zoom so the whole bbox fits OW x OH (logical) with breathing room
    avail_w = OW * (1 - 2 * PAD)
    avail_h = OH * (1 - 2 * PAD)
    z = 9
    for cand in range(16, 8, -1):
        x0, y0 = lonlat_to_px(min_lon, max_lat, cand)
        x1, y1 = lonlat_to_px(max_lon, min_lat, cand)
        if (x1 - x0) <= avail_w and (y1 - y0) <= avail_h:
            z = cand
            break

    cx, cy = lonlat_to_px((min_lon + max_lon) / 2, (min_lat + max_lat) / 2, z)
    origin_x = cx - OW / 2     # @1x global px = top-left of the logical canvas
    origin_y = cy - OH / 2

    ts = TILE * SCALE
    out_w, out_h = OW * SCALE, OH * SCALE
    ox2, oy2 = origin_x * SCALE, origin_y * SCALE   # @2x for tile compositing
    canvas = Image.new("RGBA", (out_w, out_h), (255, 255, 255, 255))
    tx0 = int(ox2 // ts); ty0 = int(oy2 // ts)
    tx1 = int((ox2 + out_w) // ts); ty1 = int((oy2 + out_h) // ts)
    maxt = 2 ** z
    for tx in range(tx0, tx1 + 1):
        for ty in range(ty0, ty1 + 1):
            if not (0 <= ty < maxt):
                continue
            tile = get_tile(z, tx % maxt, ty)
            canvas.alpha_composite(tile, (int(tx * ts - ox2), int(ty * ts - oy2)))

    out = canvas.convert("RGB").resize((OW, OH), Image.LANCZOS)
    out.save(os.path.join(MAPS_DIR, "overview.webp"), "WEBP", quality=82, method=6)

    meta = {"z": z, "originX": origin_x, "originY": origin_y, "w": OW, "h": OH}
    json.dump(meta, open(os.path.join(MAPS_DIR, "overview.json"), "w"), indent=2)
    print(f"overview written (z={z}, originX={origin_x:.1f}, originY={origin_y:.1f}, {len(starts)} starts)")


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


def main():
    db = json.load(open(DB_PATH, encoding="utf-8"))
    by_id = {t["id"]: t for t in db}
    only = sys.argv[1:] if len(sys.argv) > 1 else None
    if only:
        targets = [by_id[i] for i in only if i in by_id]
    else:
        targets = [t for t in db if t["category"] in BIKE]
    print(f"processing {len(targets)} tours")

    done = 0
    all_starts = []
    for t in targets:
        tid = t["id"]
        try:
            start_txt, pts = fetch_detail(tid)
            if start_txt:
                t["starting_point"] = start_txt
            if len(pts) >= 2:
                render(tid, pts)
                t["images"] = [f"./maps/{tid}.webp"]
                t["start_lng"] = round(pts[0][0], 6)
                t["start_lat"] = round(pts[0][1], 6)
                t["track"] = coarse_track(pts)
                all_starts.append((pts[0][0], pts[0][1]))
                tag = f"map({len(pts)}pts)"
            else:
                tag = "NO-GEOM"
            done += 1
            print(f"[{done}/{len(targets)}] {tid} {tag} | start='{start_txt[:40]}'")
        except Exception as e:
            print(f"[ERR] {tid}: {e}")
        time.sleep(0.1)

    if all_starts:
        render_overview(all_starts)
    json.dump(db, open(DB_PATH, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print("tours_db.json updated")


if __name__ == "__main__":
    main()
