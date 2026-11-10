# 228 Board

Eigene Board-App im Browser: freie Leinwand für Ideen, Moodboards, Drehpläne und Projekte.
Läuft ohne Build-Schritt als statische Seite (GitHub Pages) und ist als App installierbar.

## Starten

Lokal: `python3 _dashboard/serve.py 8832`, dann http://localhost:8832/ öffnen.
Das Baustand-Dashboard liegt unter http://localhost:8832/_dashboard/ (wird nicht veröffentlicht).

## Aufbau

- `index.html`, `css/app.css` – Seite und Gestaltung (hell, dunkel, Handy)
- `js/store.js` – Daten in IndexedDB, Transaktionen, Undo und Redo, Dateien
- `js/app.js` – Leinwand, Zoom, Ziehen, Linien, Tastatur, Zwischenablage
- `js/cards.js` – die 16 Kartentypen
- `js/rich.js`, `js/table.js`, `js/sketch.js` – Texteditor, Tabellen mit Formeln, Zeichnen
- `js/ui.js`, `js/actions.js` – Leisten, Menüs, Betrachter, Suche, Papierkorb, Aktionen
- `js/exporter.js` – PDF, PNG, Word, Markdown, Text, ZIP, Sicherung
- `js/templates.js` – 132 Vorlagen in 34 Kategorien
- `sw.js`, `manifest.webmanifest` – Offline-Betrieb und Installation

## Daten

Alle Inhalte liegen im Browser auf dem jeweiligen Gerät (IndexedDB). Sicherung und Weitergabe
über Einstellungen › Daten oder Teilen › Board-Datei (`.228board`).

## Externe Dienste, die beim Benutzen angesprochen werden

- cdn.jsdelivr.net: Rechen-Engine für Tabellenformeln (HyperFormula, GPL-3.0), PDF, ZIP, Bildexport, Freistellen
- api.microlink.io: Vorschau (Titel, Bild) für eingefügte Links
- api.openverse.org oder Pexels (eigener Schlüssel): Bildsuche
- Einbettungen laden vom jeweiligen Anbieter (YouTube, Vimeo, Spotify, Google Maps usw.)

## Stufe 2 (offen)

Konten, Abgleich zwischen Geräten, Teilen mit Rollen, Links und Passwort, Arbeit in Echtzeit,
E-Mail-Benachrichtigungen, Browser-Erweiterung zum Sammeln von Webinhalten. Dafür braucht es
eine Datenbank (geplant: Firebase). Die Datenschicht ist darauf vorbereitet
(`S.sync` und `applyRemote` in `js/store.js`).
