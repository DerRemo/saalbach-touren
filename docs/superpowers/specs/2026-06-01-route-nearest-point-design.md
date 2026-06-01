# Route/Distanz zum nächstgelegenen Tour-Punkt — Design-Spec

**Datum:** 2026-06-01
**Projekt:** Saalbach Tourenfinder (PWA)
**Baut auf:** [Quartier-Features](2026-06-01-quartier-features-design.md)
**Status:** Approved (Brainstorming abgeschlossen)

## Problem

Die Quartier-Features beziehen Distanz, „🏠 ab Quartier"-Badge, Sortierung und den
„Route"-Button heute auf den **aufgezeichneten Startpunkt** der Tour. Das Quartier
liegt aber so gut wie nie am offiziellen Start — eine Runde kann dicht an der
Unterkunft vorbeiführen, während ihr Startpunkt weit weg im Tal liegt. Das Badge
zeigt dann „3 km zum Start", obwohl die Tour 300 m an der Tür vorbeikommt, und der
Route-Button navigiert zum falschen (entfernten) Punkt.

## Verworfene Idee: die Tour-GPX umbauen

Ursprünglich angedacht war, die heruntergeladene GPX so zu verändern, dass sie am
Quartier beginnt. Das ist der falsche Weg:

- **Unmöglichkeits-Dreieck:** Einstieg am nächsten Punkt + Runde *nicht* drehen +
  *eine* durchgehende GPX — davon sind nur zwei gleichzeitig erreichbar. Hängt man
  ohne Drehen [Quartier→nächster Punkt P] vor die Originalrunde [ab Start A], springt
  die Strecke von P zu A.
- Jeder Eingriff macht aus der offiziellen Route eine Eigenkreation.
- CORS: Die Outdooractive-GPX sendet kein `Access-Control-Allow-Origin`, lässt sich
  im Browser also gar nicht auslesen/umbauen.

## Gewählter Ansatz (Variante B)

Die Tour-GPX bleibt **komplett unangetastet**. Stattdessen zielen Distanz, Badge,
Sortierung und der „Route"-Button auf den **nächstgelegenen Punkt der Tour** statt
auf den Start. Die Anfahrt-Navigation übernimmt weiterhin Google/Apple Maps (über
den bestehenden Deep-Link) — wir liefern nur das bessere Ziel. Kein Routing-Backend,
keine kombinierte/separate GPX, kein Drehen von Runden.

## Komponenten

### 1. Daten — `build_maps.py`
- Pro Bike-Tour einen **groben Track** `track` in `tours_db.json` speichern: die volle
  Geometrie gleichmäßig heruntergerechnet auf **höchstens ~80 Punkte**, Index 0 und
  der letzte Punkt immer enthalten. Format `[[lon, lat], …]`, Koordinaten auf 5
  Nachkommastellen gerundet.
- `start_lat` / `start_lng` bleiben erhalten (die Übersichtskarte nutzt sie weiter
  für die Start-Punkte).
- Skript einmal neu laufen lassen.

### 2. Logik — `geo.js`
- Neue reine Funktion `nearestTrackPoint(lat, lng, track)` → `{ lat, lng, km }` des
  Track-Punkts mit der kleinsten Luftlinie zum gegebenen Punkt, oder `null` wenn
  `track` leer/fehlt. Nutzt das vorhandene `haversineKm`. Mit Node-Test.

### 3. Verhalten — `quartier.js`
- `distanceKm(tour)`: statt Luftlinie zum Start → kleinste Luftlinie zu einem
  Track-Punkt via `nearestTrackPoint`. `null`, wenn die Tour keinen `track` hat.
- `routeUrl(tour)`: Ziel = der **nächstgelegene Track-Punkt** (nicht `start_lat/lng`).
  `null`, wenn kein `track`.
- `isNear` / `formatDistance` leiten sich unverändert aus `distanceKm` ab → arbeiten
  damit automatisch mit dem nächsten Punkt.

### 4. Darstellung — `app.js`
- Badge-Text von „📍 X Luftlinie" auf **„📍 X zur Tour"** ändern, Tooltip
  **„Luftlinie zum nächstgelegenen Punkt der Tour"**.
- „🏠 ab Quartier"-Badge und die Sortierung „Nächste zum Quartier" bleiben im Code
  gleich (sie rufen `Quartier.isNear` / `Quartier.distanceKm`) — sie spiegeln nun
  automatisch den nächsten Punkt.

### 5. Drumherum
- `service-worker.js`: Cache-Version auf **v12** bumpen (Daten haben sich geändert).
- Daten neu bauen (`tours_db.json`).

## Edge Cases
- **Tour ohne `track`** (fehlende Geometrie): `distanceKm` → `null` → Badge und
  Route-Button ausgeblendet, in der Distanz-Sortierung ans Ende (bestehendes
  Verhalten, unverändert).
- **Grober Track vs. echter nächster Punkt:** ~80 Punkte über eine Mehr-km-Runde
  bedeuten Abstände von einigen zehn Metern. Für „bring mich zum Einstieg" via Maps
  völlig ausreichend.
- **Lift-/Bergstart:** Der nächste Track-Punkt kann theoretisch oben liegen; Maps
  routet dann dorthin. Akzeptiert (keine Sonderbehandlung) — die Übersichtskarte und
  der Use-Case bleiben sinnvoll.

## Bewusst NICHT im Scope (YAGNI)
- Keine Änderung/Erzeugung von GPX-Dateien, keine kombinierte oder Anfahrt-GPX.
- Kein Routing-Dienst (BRouter o. Ä.) — Maps routet.
- Kein Drehen/Rotieren von Runden.
- Die Übersichtskarte zeigt weiterhin Start-Punkte (nicht den nächsten Punkt).

## Verifikation
- `node tests/geo.test.js` grün (inkl. neuem `nearestTrackPoint`-Test).
- Build: alle Bike-Touren haben ein nicht-leeres `track`-Array (≤ 80 Punkte).
- Frontend (`dev_server.py`): Für eine Runde, die nah am Quartier vorbeiführt, zeigt
  das Badge nun die kleine Distanz zum nächsten Punkt (nicht die große zum Start);
  der Route-Button öffnet Maps mit diesem nächsten Punkt als Ziel; Sortierung „Nächste
  zum Quartier" ordnet entsprechend. Pin-Verschieben aktualisiert alles live.
