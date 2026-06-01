# Quartier-Features — Design-Spec

**Datum:** 2026-06-01
**Projekt:** Saalbach Tourenfinder (PWA, Vanilla HTML/CSS/JS, GitHub Pages)
**Status:** Approved (Brainstorming abgeschlossen, bereit für Implementierungsplan)

## Ziel

Die Unterkunft des Nutzers (Default: **Buchegg Resort**, 47.3663889, 12.5966667)
als wählbaren Bezugspunkt in die App bringen und daraus vier Features bauen:

1. **Distanz-Badge** pro Tour (Luftlinie vom Quartier).
2. **Sortierung** „Nächste zum Quartier".
3. **„Route"-Button** pro Tour (Deep-Link zu Maps mit Route Quartier → Startpunkt).
4. **Übersichtskarte** mit Quartier-Pin + allen Tour-Startpunkten.

Das Quartier ist per Default vorbelegt, aber vom Nutzer **überschreibbar** und in
`localStorage` gespeichert — die App ist öffentlich, also muss sie auch für fremde
Nutzer sinnvoll sein.

## Gewählter Ansatz (A): Offline-Übersicht mit statischem Basemap + SVG-Overlay

Die App rendert Karten heute **statisch** vor (WebP-Bilder, für Offline-Nutzung).
Für einen veränderbaren Quartier-Pin wird **kein** interaktives Map-Framework und
**keine** Online-Tiles zur Laufzeit eingeführt. Stattdessen:

- `build_maps.py` rendert **eine** zusätzliche statische Übersichts-Karte und legt
  die Projektions-Parameter offen.
- Das Frontend zeichnet Start-Punkte und den Quartier-Pin client-seitig als **SVG**
  über das statische Bild — mit derselben Web-Mercator-Mathematik, die das
  Python-Skript schon nutzt.

Das liefert alle vier Features, bleibt **100 % offline-fähig** (außer dem
Route-Deep-Link, der bewusst eine externe App öffnet) und führt keine neue
Abhängigkeit ein.

## Komponenten

### 1. Datenebene — `build_maps.py`

- **Start-Koordinaten je Bike-Tour:** In `main()` pro Tour `pts[0]` als
  `start_lng` / `start_lat` in `tours_db.json` schreiben. `pts[0]` ist exakt der
  Punkt, an dem heute der grüne Start-Dot gezeichnet wird (`line[0]` in `render()`).
  Nur Touren mit Geometrie (`len(pts) >= 2`) bekommen Koordinaten; Touren ohne
  Geometrie bleiben ohne (Frontend blendet dort Badge/Route aus).
- **Übersichts-Karte:** Neue Funktion `render_overview(all_starts)`:
  - Bbox über alle Start-Punkte, `pick_zoom`-Logik wiederverwenden (eigener,
    etwas großzügigerer Ausschnitt für das ganze Tal).
  - Tiles wie bisher von CARTO Light cachen/compositen → `maps/overview.webp`.
  - Start-Punkte werden **nicht** ins Bild gebrannt (macht das Frontend dynamisch),
    nur der Basemap-Ausschnitt.
  - Projektions-Parameter nach `maps/overview.json` schreiben:
    `{ "z": <zoom>, "originX": <px>, "originY": <px>, "w": <logical px>, "h": <logical px> }`
    — `originX/originY` = obere linke Ecke des Ausschnitts in globalen @1x-Mercator-Pixeln,
    `w/h` = logische Bildgröße. Damit ist lon/lat → Bildpixel deterministisch.
- **Ausführung:** Skript einmal regulär laufen lassen (`python3 build_maps.py`).
  Ergebnis: Koordinaten in der DB + `overview.webp` + `overview.json`.

### 2. Offline-Caching — `service-worker.js`

- `maps/overview.webp` und `maps/overview.json` in die Precache-Liste aufnehmen.
- Cache-Versions-String bumpen, damit der neue Stand ausgeliefert wird.

### 3. Quartier-Verwaltung — `app.js`

- Konstante: `const DEFAULT_HOME = { name: "Buchegg Resort", lat: 47.3663889, lng: 12.5966667 };`
- `getHome()`: liest `localStorage["saalbach.home"]` (JSON `{name?, lat, lng}`),
  fällt auf `DEFAULT_HOME` zurück.
- `setHome({lat, lng, name?})`: validiert, schreibt `localStorage`, triggert
  `applyFilters()` (Distanzen/Sortierung neu) und Neuzeichnen des Overlays.
- `resetHome()`: löscht den `localStorage`-Eintrag → zurück auf Default.
- **Setz-Wege (im Karten-Modal):**
  1. **Pin ziehen** auf der Übersichtskarte (zuverlässigste Methode, voll offline).
  2. **„Mein Standort"** über `navigator.geolocation` (Fehler/Verweigerung → Hinweis,
     Default bleibt).
  3. **Link/Koordinaten einfügen:** Textfeld, parst `…@<lat>,<lng>…` aus einer
     vollständigen Google-Maps-URL **oder** `lat, lng`.
     **Bekannte Grenze:** Kurzlinks (`maps.app.goo.gl/…`) lassen sich im Browser
     nicht auflösen (CORS + Redirect) → UI-Text weist darauf hin
     („vollständige Karten-URL oder Koordinaten, oder Pin ziehen").
  4. **„Auf Buchegg Resort zurücksetzen"**-Link.

### 4. Distanz, Sortierung, Badges — `app.js`

- `haversine(a, b)` → Luftlinie in km (pur im Browser).
- **Distanz-Badge** auf der Tour-Karte: `📍 2,3 km`, Tooltip **„Luftlinie vom Quartier"**.
  Bewusst *Luftlinie* — keine fingierte Fahrzeit (konsistent mit dem
  „Texte ehrlicher & geräteneutral"-Kurs des Projekts).
- **„🏠 ab Quartier"-Badge**, wenn Start ≤ **2 km** Luftlinie.
- **Sortier-Option** `Nächste zum Quartier`:
  - `<option value="distanceAsc">` im `sortSelect` (index.html).
  - Branch in der Sort-Logik von `applyFilters()`. Touren ohne Koordinate ans Ende.
- Distanzen werden beim Laden und bei jedem `setHome()` (neu) berechnet.

### 5. „Route"-Button — `app.js` (Card-Render)

- Neben „GPX Herunterladen" ein „Route"-Button.
- Öffnet `https://www.google.com/maps/dir/?api=1&origin=<homeLat,homeLng>&destination=<startLat,startLng>`
  (funktioniert universell, auch auf iOS).
- Reisemodus bewusst **offen** (Anfahrt mal per Auto, mal per Bike — Maps entscheidet/
  Nutzer wählt).
- *Nice-to-have (optional, nicht Pflicht):* auf iOS zusätzlich ein Apple-Maps-Link.
- Button wird ausgeblendet, wenn die Tour keine Start-Koordinate hat.

### 6. Übersichtskarte — Modal (`index.html` / `app.js` / `style.css`)

- Neues Modal nach Vorbild des bestehenden Help-Modals; geöffnet über einen
  Header-Button (📍 „Quartier & Karte").
- Inhalt: `<img src="./maps/overview.webp">` mit darüber positioniertem **SVG**
  (`viewBox="0 0 w h"`, skaliert responsiv mit dem Bild).
- JS-Port der Projektion aus `overview.json`:
  - `lonlatToXY(lon, lat)` (Web-Mercator, wie `lonlat_to_px`, minus `originX/originY`).
  - `xyToLonlat(x, y)` (Inverse, für Pin-Drag).
- **Start-Punkte:** klickbare Dots; Klick schließt das Modal und führt zur Tour
  (Suchfeld/Scroll auf die Karte).
- **Quartier-Pin:** ziehbar (Pointer-Events); Drop → `setHome` → Distanzen +
  Overlay neu.
- **Quartier außerhalb des Ausschnitts:** Pin an den Bildrand klemmen + kleiner
  Hinweistext.
- Im Modal ebenfalls die Setz-Wege aus Abschnitt 3 (Geolocation, Link/Koordinaten,
  Reset).

## UI-Platzierung (Zusammenfassung)

- **Header:** neuer Button „📍 Quartier & Karte" → öffnet das Modal.
- **Modal:** Übersichtskarte + Quartier-Setzen/Reset.
- **Tour-Karte:** Distanz-Badge, „ab Quartier"-Badge, „Route"-Button.
- **Filter-Drawer:** neue Sortier-Option „Nächste zum Quartier".

## Edge Cases

- **Keine Geolocation-Erlaubnis:** Default-Quartier greift; Hinweis statt Fehler.
- **Tour ohne Start-Koordinate:** Distanz-Badge + Route-Button ausgeblendet, in der
  Distanz-Sortierung ans Ende.
- **Quartier außerhalb des Karten-Ausschnitts:** Pin am Rand klemmen.
- **Kurzlink eingefügt:** klarer UI-Hinweis, dass nur volle URL / Koordinaten / Pin
  funktionieren.

## Bewusst NICHT im Scope (YAGNI)

- Keine echte Routing-/Fahrzeit-Berechnung (Route-Deep-Link übergibt an Maps).
- Kein Geocoding-Dienst (keine Adress-Suche, keine Kurzlink-Auflösung).
- Keine interaktive Slippy-Map-Library, keine Online-Tiles zur Laufzeit.
- Keine Mehrfach-Quartiere / Profile.

## Verifikation

- `build_maps.py` neu laufen lassen; stichprobenartig prüfen, dass `start_lat/lng`
  in `tours_db.json` stehen und `overview.webp` + `overview.json` existieren.
- Frontend lokal (`dev_server.py`): Distanz-Badges plausibel (Talschluss-Touren
  weiter weg als ortsnahe), Sortierung „Nächste zum Quartier" korrekt geordnet,
  Route-Button öffnet Maps mit beiden Punkten, Übersichts-Pin liegt am Buchegg
  Resort, Pin-Drag verändert Distanzen, Reset stellt Default wieder her.
- Offline-Check: Service Worker aktiv, dann offline neu laden — Karte + Overlay +
  Badges + Sortierung funktionieren (nur Route-Deep-Link braucht Netz/App).
