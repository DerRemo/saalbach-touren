#!/usr/bin/env python3
"""Re-fetch German text for the bike tours and update tours_db.json in place.
Updates title, short_description and starting_point to the German localization.
The `category` field is deliberately left English because app.js filters on it;
the German display label is handled in app.js instead. Maps are not touched.
"""
import json, os, time, xml.etree.ElementTree as ET
import requests

KEY = "IMBSMP7G-EMWGKTHO-4OSSYIOS"
PROJ = "api-saalbach"
NS = "{http://www.outdooractive.com/api/}"
BIKE = {"Mountain Biking", "E-Bike", "Freeride/ Downhill", "Gravel Bike"}
DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tours_db.json")

S = requests.Session()
S.headers["User-Agent"] = "SaalbachTourFinder/1.0 (personal)"


def fetch_de(tid):
    url = f"https://www.outdooractive.com/api/project/{PROJ}/oois/{tid}?key={KEY}&lang=de"
    r = S.get(url, timeout=30)
    r.raise_for_status()
    t = ET.fromstring(r.content).find(f"{NS}tour")
    return {
        "title": (t.findtext(f"{NS}title") or "").strip(),
        "start": (t.findtext(f"{NS}startingPointDescr") or "").strip(),
        "short": (t.findtext(f"{NS}shortText") or "").strip(),
    }


def main():
    db = json.load(open(DB, encoding="utf-8"))
    targets = [t for t in db if t["category"] in BIKE]
    print(f"localizing {len(targets)} bike tours -> de")
    changed_title = changed_start = 0
    for i, t in enumerate(targets, 1):
        try:
            de = fetch_de(t["id"])
            if de["title"]:
                if de["title"] != t["title"]:
                    changed_title += 1
                t["title"] = de["title"]
            if de["short"]:
                t["short_description"] = de["short"]
            if de["start"]:
                if de["start"] != t["starting_point"]:
                    changed_start += 1
                t["starting_point"] = de["start"]
            print(f"[{i}/{len(targets)}] {t['id']} | {t['title'][:42]} | start='{t['starting_point'][:30]}'")
        except Exception as e:
            print(f"[ERR] {t['id']}: {e}")
        time.sleep(0.1)
    json.dump(db, open(DB, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"\ntitles changed: {changed_title}, starting points changed: {changed_start}")


if __name__ == "__main__":
    main()
