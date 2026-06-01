<div align="center">
  <img src="icons/icon-192.png" width="96" alt="Saalbach Tourenfinder Icon">
  <h1>Saalbach Tourenfinder</h1>
  <p><strong>Finde, filtere und lade GPX-Bike-Touren in Saalbach-Hinterglemm – offline-tauglich für den Sigma Rox 4.0.</strong></p>
  <p>🌐 <a href="https://derremo.github.io/saalbach-touren/">derremo.github.io/saalbach-touren</a></p>
</div>

---

## Über die App

Eine **Progressive Web App** (PWA) zum schnellen Finden und Herunterladen von Mountainbike-, E-Bike- und Gravel-Touren rund um Saalbach-Hinterglemm. Tour aussuchen, GPX herunterladen und per *Sigma Ride* auf den **Sigma Rox 4.0** übertragen – die Anleitung dazu ist in der App hinterlegt.

Gebaut als reine PWA ohne Framework und ohne Backend: einmal geladen, läuft sie **vollständig offline** – ideal mitten in den Bergen.

## Funktionen

- 🚲 **64 Bike-Touren** (Mountainbike, E-Bike, Freeride, Gravel), Daten auf Deutsch
- 🗺️ **Streckenkarte pro Tour** – lokal gerenderte CARTO-Light-Karte mit eingezeichneter Route, offline gebündelt
- 🔀 **Touren / Trails-Umschalter** – echte Touren oder einzelne Bikepark-Lines
- 🔎 **Filter** nach Suche, Kategorie, Länge, Dauer und Schwierigkeit, plus Sortierung
- ⬇️ **GPX-Download** direkt aufs iPhone, inkl. Schritt-für-Schritt-Anleitung zur Sigma-Übertragung
- 📲 **Installierbar** (Zum Home-Bildschirm hinzufügen) und **offline-fähig** dank Service Worker

## Auf dem iPhone installieren

1. In **Safari** die [Live-URL](https://derremo.github.io/saalbach-touren/) öffnen
2. Teilen-Symbol → **„Zum Home-Bildschirm hinzufügen"**
3. Läuft danach als eigenständige App – auch ohne Netz

## Technik

| Bereich | Umsetzung |
|---|---|
| Frontend | Vanilla HTML / CSS / JavaScript, kein Build-Schritt, kein Framework |
| Offline | Service Worker (network-first für die App, Precache der Streckenkarten) |
| Daten | [Outdooractive](https://www.outdooractive.com/) Projekt `api-saalbach` |
| Karten | Lokal aus der Streckengeometrie gerendert auf [CARTO](https://carto.com/) Light + OpenStreetMap-Kacheln |
| Fonts | [Inter](https://fonts.google.com/specimen/Inter) & [Outfit](https://fonts.google.com/specimen/Outfit), lokal gebündelt |
| Hosting | GitHub Pages |

## Projektstruktur

```
index.html            App-Markup
style.css             Styling (Dark Theme, Orange-Akzent)
app.js                Filter-/Render-Logik, Touren/Trails-Modus, GPX-Download
service-worker.js     Offline-Caching
manifest.json         PWA-Manifest
tours_db.json         Tour-Datenbank
maps/                 Streckenkarten (WebP, eine pro Tour)
fonts/                Lokale Fonts (woff2 + fonts.css)
icons/                App-Icons (192 / 512 / 1024)

build_maps.py         Erzeugt Streckenkarten + Startpunkte aus der Outdooractive-API
localize_de.py        Holt deutsche Titel/Startpunkte/Beschreibungen
dev_server.py         Lokaler No-Cache-Dev-Server (Port 8000)
```

## Lokal entwickeln

```bash
python3 dev_server.py      # http://localhost:8000 (ohne Caching, immer frischer Stand)
```

Daten neu erzeugen (benötigt `requests` und `Pillow`):

```bash
python3 build_maps.py      # Streckenkarten + Startpunkte rendern
python3 localize_de.py     # Texte auf Deutsch aktualisieren
```

## Deployen

Push auf `main` – GitHub Pages baut automatisch neu:

```bash
git add -A && git commit -m "…" && git push
```

## Daten & Lizenzen

- Tourdaten © [Outdooractive](https://www.outdooractive.com/) / Tourismusverband Saalbach Hinterglemm
- Kartenkacheln © [OpenStreetMap](https://www.openstreetmap.org/copyright)-Mitwirkende, Stil © [CARTO](https://carto.com/attributions)

Privates Projekt – keine offizielle App von Saalbach-Hinterglemm.
