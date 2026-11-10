// Vorlagen: kompakte Beschreibung, aus der Boards erzeugt werden
import { A } from './util.js';
import { tx, add, set, get, uid, maxZ } from './store.js';

/* Arten:
   K  Spalten:   'Titel: Karte|Karte; Titel: …'   (Karte mit ☐ am Anfang = Aufgabe)
   M  Moodboard: 'Überschrift; Stichwort|Stichwort'  Bildplätze, Farbfelder, Notizen
   B  Briefing:  'Abschnitt: Text; Abschnitt: Text'  Notizen im Raster
   S  Storyboard:'Szene|Szene|…'                      Bildplatz plus Text je Szene
   T  Tabelle:   'Kopf|Kopf; Zelle|Zelle; …'
   L  Liste:     'Titel: Aufgabe|Aufgabe; …'          To-do-Listen
   X  Mindmap:   'Mitte; Ast|Ast|…'                   mit Linien verbunden            */
const D = `Moodboard|Moodboards|🎨|M|Stimmung und Richtung; Farben|Typografie|Texturen|Licht
Moodboard Grafikdesign|Moodboards|🖌|M|Visuelle Richtung; Layout|Schrift|Farbe|Bildsprache
Moodboard Fotografie|Moodboards|📷|M|Look des Shootings; Licht|Posen|Styling|Location
Moodboard Mode|Moodboards|👗|M|Kollektion; Silhouetten|Stoffe|Farben|Details
Moodboard Illustration|Moodboards|✏️|M|Stil; Linien|Farbwelt|Figuren|Referenzen
Moodboard Interior|Moodboards|🛋|M|Raumgefühl; Möbel|Materialien|Farben|Licht
Moodboard Film|Moodboards|🎬|M|Look des Films; Kamera|Licht|Farbe|Ausstattung
Moodboard Architektur|Moodboards|🏗|M|Entwurfsidee; Formen|Materialien|Umgebung|Licht
Moodboard UI|Moodboards|💻|M|Oberfläche; Farben|Komponenten|Typografie|Icons
Inspirationsboard|Moodboards|💡|M|Sammlung; Ideen|Zitate|Bilder|Links
Moodboard Motion Design|Moodboards|🎞|M|Bewegung; Übergänge|Tempo|Formen|Farbe
Brand Board|Moodboards|⭐|M|Markenauftritt; Logo|Farben|Schriften|Bildwelt
Charakterdesign|Moodboards|🎭|M|Figur; Gesicht|Kleidung|Haltung|Requisiten
Moodboard Event|Moodboards|🎉|M|Veranstaltung; Deko|Licht|Bühne|Einladung
Moodboard Spieldesign|Moodboards|🎮|M|Spielwelt; Umgebung|Figuren|UI|Farbstimmung
Moodboard Logo|Moodboards|🔑|M|Zeichen; Formen|Typo|Farbe|Anwendungen
Moodboard Kampagne|Moodboards|📣|M|Kampagnenlook; Motive|Claims|Farben|Formate
Moodboard Verpackung|Moodboards|📦|M|Packaging; Formen|Material|Druck|Regal
Vision Board|Moodboards|🌍|M|Meine Ziele; Arbeit|Gesundheit|Reisen|Menschen
Moodboard Hochzeit|Moodboards|💍|M|Unser Tag; Blumen|Kleidung|Tisch|Ort
Moodboard Tattoo|Moodboards|🖼|M|Motiv; Stil|Platzierung|Linien|Schattierung
Creative Brief|Creative Briefs|📝|B|Ausgangslage: Worum geht es und warum jetzt?; Ziel: Was soll erreicht werden?; Zielgruppe: Für wen ist es gedacht?; Kernbotschaft: Ein Satz, der hängen bleibt; Tonalität: Wie soll es klingen und aussehen?; Lieferumfang: Formate, Längen, Varianten; Zeitplan: Meilensteine und Abgabe; Budget: Rahmen und Freigaben
Designbriefing|Creative Briefs|🎯|B|Projekt: Kurzbeschreibung; Marke: Werte und Auftreten; Aufgabe: Was wird gestaltet?; Muss enthalten: Pflichtinhalte; Darf nicht: Ausschlüsse; Referenzen: Beispiele, die gefallen; Abgabe: Formate und Termin
Videobriefing|Creative Briefs|🎥|B|Zweck: Wofür ist der Film?; Publikum: Wer sieht ihn wo?; Botschaft: Was soll bleiben?; Stil: Look, Musik, Tempo; Länge und Formate: 16:9, 9:16, Cutdowns; Dreh: Ort, Personen, Termine; Abnahme: Wer gibt frei?
Website-Briefing|Creative Briefs|💻|B|Ziel der Seite: Was sollen Besucher tun?; Zielgruppen: Wer kommt?; Inhalte: Seiten und Texte; Funktionen: Formulare, Shop, CMS; Design: Vorgaben und Beispiele; Technik: Hosting, Domain; Zeitplan: Start und Livegang
Storyboard|Storyboards|🎞|S|Eröffnung|Einführung der Figur|Konflikt|Wendepunkt|Höhepunkt|Auflösung|Schlussbild|Abspann
Storyboard Werbespot|Storyboards|📣|S|Hook|Problem|Produkt tritt auf|Nutzen|Beweis|Packshot und Claim
Storyboard Musikvideo|Storyboards|🎵|S|Intro|Strophe 1|Refrain|Strophe 2|Bridge|Finaler Refrain|Outro
Storyboard Erklärfilm|Storyboards|💡|S|Ausgangsfrage|Das Problem|Die Idee|So funktioniert es|Der Vorteil|Aufruf
Storyboard Social Clip|Storyboards|📱|S|Hook in 2 Sekunden|Aussage|Beweis|Punchline|Call to Action
Brainstorming|Brainstorming|💡|X|Thema; Idee 1|Idee 2|Idee 3|Idee 4|Idee 5|Idee 6
Mindmap|Brainstorming|🧠|X|Kernthema; Aspekt A|Aspekt B|Aspekt C|Aspekt D|Aspekt E
Ideensammlung|Brainstorming|🧩|K|Rohideen: Alles ist erlaubt|Noch eine Idee; Vielversprechend: ; Prüfen: ; Verworfen:
Crazy 8s|Brainstorming|⚡|S|Skizze 1|Skizze 2|Skizze 3|Skizze 4|Skizze 5|Skizze 6|Skizze 7|Skizze 8
SWOT-Analyse|Brainstorming|📊|K|Stärken: Was können wir besonders gut?; Schwächen: Wo hakt es?; Chancen: Was spielt uns in die Karten?; Risiken: Was kann schiefgehen?
Pro und Contra|Brainstorming|🤔|K|Dafür: ; Dagegen: ; Offene Fragen: ; Entscheidung:
Projektplan|Projektpläne|🗓|K|Ziele: Was ist am Ende fertig?; Phase 1 Konzept: ☐ Recherche|☐ Briefing abstimmen; Phase 2 Umsetzung: ☐ Erste Fassung|☐ Feedbackrunde; Phase 3 Abschluss: ☐ Finalisierung|☐ Übergabe; Risiken:
Projekt-Kickoff|Projektpläne|🚀|B|Projekt: Titel und Kurzbeschreibung; Team: Wer macht was?; Ziele: Woran messen wir Erfolg?; Umfang: Was gehört dazu, was nicht?; Termine: Meilensteine; Kommunikation: Wo und wie oft?; Nächste Schritte: Wer, was, bis wann?
Roadmap|Projektpläne|📈|K|Jetzt: ; Als Nächstes: ; Später: ; Irgendwann:
Meilensteinplan|Projektpläne|⏱|T|Meilenstein|Verantwortlich|Termin|Status; Konzept freigegeben|||; Erste Fassung|||; Abnahme|||; Auslieferung|||
Retrospektive|Projektpläne|🔬|K|Lief gut: ; Lief nicht gut: ; Ideen: ; Maßnahmen: ☐
Besprechungsnotizen|Projektpläne|📝|B|Termin: Datum, Ort, Teilnehmende; Themen: Was steht an?; Notizen: ; Entscheidungen: ; Aufgaben: Wer macht was bis wann?
Film-Vorproduktion|Film|🎬|K|Drehbuch: Aktuelle Fassung|Anmerkungen; Besetzung: ; Motive: ; Technik: ; Zeitplan: ☐ Drehplan erstellen|☐ Genehmigungen einholen; Budget:
Beat Sheet|Film|✍️|K|Akt 1: Eröffnungsbild|Auslösendes Ereignis|Erster Wendepunkt; Akt 2: Neue Welt|Mittelpunkt|Tiefpunkt; Akt 3: Entschluss|Finale|Schlussbild
Motivsuche|Film|📍|S|Motiv 1|Motiv 2|Motiv 3|Motiv 4|Motiv 5|Motiv 6
Shotlist|Film|🎥|T|Nr.|Szene|Einstellung|Bewegung|Objektiv|Beschreibung|Erledigt; 1||Totale|Statisch|24 mm||FALSE; 2||Halbnah|Fahrt|35 mm||FALSE; 3||Nah|Handkamera|50 mm||FALSE; 4||Detail|Statisch|85 mm||FALSE
Dispo (Call Sheet)|Film|🗓|T|Zeit|Was|Wer|Ort; 07:00|Aufbau|Technik|; 08:00|Maske und Kostüm|Cast|; 09:00|Drehbeginn|Alle|; 13:00|Mittagspause|Alle|; 18:00|Drehschluss|Alle|
Equipment-Checkliste|Film|🎧|L|Kamera: Kamerabody|Objektive|Akkus|Speicherkarten|Stativ; Licht: Leuchten|Stative|Diffusion|Verlängerungen; Ton: Funkstrecken|Angel|Rekorder|Kopfhörer; Sonstiges: Klappe|Gaffa|Festplatten
Postproduktion|Film|🎞|K|Sichtung: ☐ Material sichern|☐ Selects markieren; Schnitt: ☐ Rohschnitt|☐ Feinschnitt; Farbe und Ton: ☐ Grading|☐ Mischung; Abgabe: ☐ Master|☐ Social-Formate
Dokumentarfilm an einem Tag|Film|📷|K|Thema: Worum geht es?; Protagonisten: ; Fragen: ; Bilder: ; Tagesablauf:
Marketingplan Film|Film|📣|K|Zielgruppe: ; Kanäle: ; Assets: ☐ Trailer|☐ Poster|☐ Stills; Termine:
Romanplan|Schreiben|📚|K|Prämisse: Ein Satz zur Geschichte; Figuren: Hauptfigur|Gegenspieler; Welt: ; Handlung: Anfang|Mitte|Ende; Offene Fragen:
Figurenprofil|Schreiben|🎭|B|Name: ; Aussehen: ; Herkunft: ; Will: Äußeres Ziel; Braucht: Inneres Bedürfnis; Schwäche: ; Stimme: Wie spricht die Figur?
Kapitelübersicht|Schreiben|✍️|K|Kapitel 1: ; Kapitel 2: ; Kapitel 3: ; Kapitel 4: ; Kapitel 5:
Drei-Akt-Struktur|Schreiben|📝|K|Akt 1 Aufbau: ; Akt 2 Konfrontation: ; Akt 3 Auflösung:
Heldenreise|Schreiben|🗺|S|Gewohnte Welt|Ruf des Abenteuers|Weigerung|Mentor|Erste Schwelle|Prüfungen|Tiefste Höhle|Entscheidende Prüfung|Belohnung|Rückweg|Auferstehung|Rückkehr
Weltenbau|Schreiben|🌍|B|Geografie: ; Geschichte: ; Gesellschaft: ; Regeln: Was ist möglich, was nicht?; Konflikte: ; Alltag:
Recherche|Schreiben|🔬|K|Quellen: ; Zitate: ; Fakten: ; Fragen:
Shooting-Plan|Fotografie|📷|K|Konzept: ; Motive: ; Team: ; Ausrüstung: ☐ Kamera|☐ Objektive|☐ Licht; Ablauf:
Shotlist Fotografie|Fotografie|🖼|T|Nr.|Motiv|Ausschnitt|Licht|Erledigt; 1||Porträt||FALSE; 2||Ganzkörper||FALSE; 3||Detail||FALSE
Bildauswahl|Fotografie|⭐|K|Favoriten: ; Vielleicht: ; Nicht verwenden:
Wochenplan|Produktivität|🗓|K|Montag: ; Dienstag: ; Mittwoch: ; Donnerstag: ; Freitag: ; Wochenende:
Teamplaner|Produktivität|👥|K|Person 1: ; Person 2: ; Person 3: ; Offen:
Kanban-Board|Produktivität|✅|K|Zu erledigen: Erste Aufgabe|Zweite Aufgabe; In Arbeit: ; Zur Prüfung: ; Erledigt:
Eisenhower-Matrix|Produktivität|🎯|K|Wichtig und dringend: Sofort tun; Wichtig, nicht dringend: Einplanen; Dringend, nicht wichtig: Abgeben; Weder noch: Streichen
Tagesplan|Produktivität|☀️|L|Heute wichtig: Die eine Sache|Zweitwichtigstes|Drittwichtigstes; Wenn Zeit bleibt: |
Ziele (OKR)|Produktivität|📈|K|Ziel 1: Schlüsselergebnis A|Schlüsselergebnis B; Ziel 2: ; Ziel 3:
Lesenotizen|Produktivität|📚|B|Buch: Titel und Autor; Kernaussage: ; Wichtige Gedanken: ; Zitate: ; Was ich umsetze:
Marketingstrategie|Marketing|📣|B|Ausgangslage: ; Zielgruppe: ; Positionierung: ; Ziele: ; Kanäle: ; Budget: ; Erfolgsmessung:
Kampagnenplan|Marketing|🎯|K|Idee: ; Botschaften: ; Assets: ☐ Key Visual|☐ Video|☐ Texte; Kanäle: ; Zeitplan:
Redaktionsplan|Marketing|🗓|T|Datum|Kanal|Thema|Format|Status; |Instagram||Reel|Idee; |LinkedIn||Beitrag|Idee; |Website||Artikel|Idee
Social-Media-Plan|Marketing|📱|K|Ideen: ; In Produktion: ; Geplant: ; Veröffentlicht:
Persona|Marketing|👥|B|Name und Alter: ; Beruf: ; Ziele: ; Probleme: ; Mediennutzung: ; Zitat: Ein typischer Satz
Wettbewerbsanalyse|Marketing|📊|T|Wettbewerber|Stärken|Schwächen|Preis|Auffällig; ||||; ||||; ||||
Markenstrategie|Marke|⭐|B|Warum: Wofür gibt es uns?; Werte: ; Versprechen: ; Persönlichkeit: ; Zielgruppe: ; Abgrenzung: Was uns unterscheidet
Markenworkshop|Marke|🤝|K|Wer sind wir: ; Für wen: ; Wie klingen wir: ; Wie sehen wir aus: ; Nächste Schritte: ☐
Namensfindung|Marke|💡|K|Kriterien: ; Kandidaten: ; Engere Wahl: ; Geprüft:
UX-Research-Plan|UX|🔬|B|Forschungsfrage: ; Methode: ; Teilnehmende: ; Leitfaden: ; Zeitplan: ; Erkenntnisse:
Interviewauswertung|UX|🎤|K|Zitate: ; Beobachtungen: ; Muster: ; Chancen:
User Journey|UX|🗺|K|Aufmerksam werden: ; Abwägen: ; Entscheiden: ; Nutzen: ; Weiterempfehlen:
Userflow|UX|🧩|X|Start; Schritt 1|Schritt 2|Entscheidung|Erfolg|Abbruch
Wireframe-Sammlung|UX|💻|S|Startseite|Übersicht|Detailseite|Formular|Bestätigung|Fehlerfall
Design-Review|UX|👀|K|Funktioniert: ; Unklar: ; Ändern: ☐ ; Fragen:
Designsystem|Grafikdesign|🎨|K|Farben: ; Typografie: ; Komponenten: ; Icons: ; Abstände:
Logo-Entwicklung|Grafikdesign|🔑|K|Briefing: ; Skizzen: ; Varianten: ; Finale Fassung:
Styleguide|Grafikdesign|🖌|B|Logo: Verwendung und Schutzraum; Farben: Primär und Sekundär; Schriften: ; Bildsprache: ; Beispiele: ; Nicht erlaubt:
Website-Planung|Web|💻|K|Sitemap: Startseite|Über uns|Leistungen|Kontakt; Inhalte: ; Design: ; Technik: ; Launch: ☐ Tests|☐ Weiterleitungen|☐ Livegang
Sitemap|Web|🗂|X|Startseite; Über uns|Leistungen|Projekte|Blog|Kontakt
Motion-Design-Projekt|Motion|🎞|K|Skript: ; Styleframes: ; Animatic: ; Animation: ; Ton: ; Abgabe:
Styleframes|Motion|🖼|S|Frame 1|Frame 2|Frame 3|Frame 4|Frame 5|Frame 6
Spielkonzept|Spiele|🎮|B|Idee: In einem Satz; Spielgefühl: ; Kernmechanik: ; Welt: ; Fortschritt: ; Zielgruppe: ; Besonderheit:
Leveldesign|Spiele|🗺|S|Einstieg|Erste Hürde|Neue Mechanik|Verschnaufpause|Höhepunkt|Belohnung
Agentur-Pitch|Agentur|🚀|K|Aufgabe: ; Erkenntnis: ; Idee: ; Umsetzung: ; Team: ; Angebot:
Kundenprojekt|Agentur|🤝|K|Briefing: ; Angebot: ; Umsetzung: ☐ ; Feedback: ; Abrechnung: ☐ Rechnung stellen
Angebotskalkulation|Agentur|💰|T|Position|Menge|Einzelpreis|Summe; Konzept|1|0|=B2*C2; Drehtag|1|0|=B3*C3; Schnitt|1|0|=B4*C4; Gesamt|||=SUM(D2:D4)
Business Model Canvas|Startup|🏢|K|Kundensegmente: ; Wertangebot: ; Kanäle: ; Kundenbeziehung: ; Einnahmen: ; Ressourcen: ; Aktivitäten: ; Partner: ; Kosten:
Lean Canvas|Startup|📈|K|Problem: ; Lösung: ; Alleinstellung: ; Kunden: ; Kanäle: ; Einnahmen: ; Kosten: ; Kennzahlen: ; Vorteil:
Pitchdeck-Gliederung|Startup|🚀|S|Problem|Lösung|Markt|Produkt|Geschäftsmodell|Team|Zahlen|Ask
Produkt-Roadmap|Produkt|🧩|K|Jetzt: ; Nächstes Quartal: ; Später: ; Ideenparkplatz:
Feature-Spezifikation|Produkt|⚙️|B|Problem: ; Lösung: ; Nutzergeschichten: ; Nicht im Umfang: ; Offene Fragen: ; Erfolgskriterien:
Release-Plan|Produkt|📦|L|Vor dem Release: Tests abgeschlossen|Texte geprüft|Changelog geschrieben; Release: Veröffentlichen|Team informieren; Danach: Feedback sammeln|Zahlen prüfen
Strategie-Canvas|Strategie|🧠|K|Vision: ; Ziele: ; Maßnahmen: ; Kennzahlen: ; Risiken:
Entscheidungsmatrix|Strategie|📊|T|Option|Kosten|Nutzen|Risiko|Punkte; A|0|0|0|=C2-B2-D2; B|0|0|0|=C3-B3-D3; C|0|0|0|=C4-B4-D4
Stakeholder-Karte|Strategie|👥|K|Entscheiden: ; Beraten: ; Umsetzen: ; Informieren:
Marktforschung|Recherche|🔬|K|Fragen: ; Quellen: ; Daten: ; Erkenntnisse: ; Empfehlungen:
Trendboard|Recherche|🔥|M|Trends; Beobachtung|Beispiele|Bedeutung|Chancen
Eventplanung|Events|🎉|K|Konzept: ; Ort: ; Gäste: ; Programm: ; Catering: ; Aufgaben: ☐ Einladungen|☐ Technik|☐ Deko
Ablaufplan|Events|⏱|T|Zeit|Programmpunkt|Verantwortlich|Notiz; 18:00|Einlass||; 19:00|Begrüßung||; 20:00|Essen||; 22:00|Party||
Hochzeitsplanung|Events|💍|K|Ort und Termin: ; Gäste: ; Dienstleister: ☐ Fotograf|☐ Musik|☐ Catering; Budget: ; Zeitplan:
Softwareprojekt|Software|💻|K|Backlog: ; In Arbeit: ; Review: ; Fertig: ; Fehler:
Architekturübersicht|Software|⚙️|X|System; Frontend|API|Datenbank|Auth|Speicher|Dienste
Sprintplanung|Software|🚀|K|Sprintziel: ; Aufgaben: ☐ ; Blocker: ; Demo:
Kursplanung|Bildung|🎓|K|Lernziele: ; Einheit 1: ; Einheit 2: ; Einheit 3: ; Material: ; Prüfung:
Lernplan|Bildung|📚|L|Diese Woche: Kapitel lesen|Zusammenfassung schreiben|Übungen; Wiederholen: |
Referat|Bildung|🎤|K|Thema: ; Gliederung: Einleitung|Hauptteil|Schluss; Quellen: ; Folien:
Podcast-Folge|Podcast|🎧|K|Thema: ; Gast: ; Fragen: ; Ablauf: Intro|Gespräch|Outro; Nachbereitung: ☐ Schnitt|☐ Shownotes|☐ Veröffentlichen
Podcast-Konzept|Podcast|🎤|B|Titel: ; Idee: ; Publikum: ; Format: Länge, Rhythmus; Themenliste: ; Technik:
Architekturprojekt|Architektur|🏗|K|Aufgabe: ; Grundstück: ; Entwurf: ; Materialien: ; Termine:
Renovierung|Zuhause|🛠|K|Räume: ; Ideen: ; Material: ; Handwerker: ; Aufgaben: ☐ ; Budget:
Raumplanung|Zuhause|🏠|K|Wohnzimmer: ; Küche: ; Schlafzimmer: ; Bad: ; Einkaufsliste: ☐
Umzug|Zuhause|📦|L|Vorher: Kartons besorgen|Ummelden|Nachsendeauftrag; Umzugstag: Schlüsselübergabe|Zählerstände; Danach: Einrichten|Kaution klären
Interior-Konzept|Interior|🛋|M|Raumkonzept; Möbel|Farben|Stoffe|Leuchten
Kunstprojekt|Kunst|🖼|K|Idee: ; Referenzen: ; Studien: ; Umsetzung: ; Ausstellung:
Ausstellungsplanung|Kunst|🎭|K|Werke: ; Raum: ; Hängung: ; Texte: ; Eröffnung: ☐ Einladungen
DIY-Projekt|Handwerk|🛠|K|Idee: ; Material: ☐ ; Schritte: ; Ergebnis:
Modekollektion|Mode|👗|K|Thema: ; Silhouetten: ; Stoffe: ; Farbkarte: ; Teile: ; Produktion:
Lookbook|Mode|👟|S|Look 1|Look 2|Look 3|Look 4|Look 5|Look 6
Content-Plan|Content|📱|K|Ideen: ; Skript: ; Dreh: ; Schnitt: ; Veröffentlicht:
YouTube-Video|Content|🎥|K|Idee und Titel: ; Hook: ; Skript: ; B-Roll: ; Thumbnail: ; Veröffentlichung: ☐ Beschreibung|☐ Kapitel|☐ Endcard
Reel-Planung|Content|🎬|S|Hook|Aufbau|Wendung|Auflösung|Call to Action
Reiseplanung|Reisen|✈️|K|Ziele: ; Unterkunft: ; Anreise: ; Tag für Tag: ; Packliste: ☐ Pass|☐ Ladegeräte
Rezeptsammlung|Kochen|🍽|K|Vorspeisen: ; Hauptgerichte: ; Desserts: ; Ausprobieren: `;
const COL = { Moodboards: '#fde2e4', 'Creative Briefs': '#d6e8ff', Storyboards: '#e7defa', Brainstorming: '#fff3bf', 'Projektpläne': '#cfe3d4', Film: '#2c2c2e', Schreiben: '#f2e3c9', Fotografie: '#e5e5ea', 'Produktivität': '#d3f9d8', Marketing: '#ffd8a8', Marke: '#ffe066' };
const PAL = ['#fde2e4', '#d6e8ff', '#e7defa', '#fff3bf', '#cfe3d4', '#f2e3c9', '#d3f9d8', '#ffd8a8', '#e5e5ea', '#ffe3e3', '#d0ebff', '#f3d9fa'];
export const TEMPLATES = D.split('\n').map(l => { const [n, c, i, k, ...d] = l.split('|'); return { n, c, i, k, d: d.join('|') }; });
export const CATS = [...new Set(TEMPLATES.map(t => t.c))];
TEMPLATES.forEach(t => (t.col = PAL[CATS.indexOf(t.c) % PAL.length]));

export function useTemplate(t, into, keepEx = true) {
  const els = [], G = 20; let board = into;
  tx(() => {
    if (!board) { const [cx, cy] = A.center(); const b = add({ id: uid(), type: 'board', title: t.n, icon: t.i, board: A.board, loc: 'canvas', x: Math.round(cx / G) * G, y: Math.round(cy / G) * G, z: maxZ(A.board) + 1 }); board = b.id; }
    else { const b = get(board); set(board, { title: b.title || t.n, icon: b.icon || t.i }); }
    let z = 1; const mk = o => add({ id: uid(), board, loc: 'canvas', z: z++, ...o });
    const ex = s => (keepEx ? s : '');
    const parts = t.d.split(';').map(s => s.trim());
    if (t.k === 'K' || t.k === 'L') {
      parts.forEach((p, ci) => { const [title, rest = ''] = p.split(/:(.*)/s).map(s => s.trim()); const items = rest.split('|').map(s => s.trim()).filter(Boolean);
        if (t.k === 'L') return mk({ type: 'todo', x: 80 + ci * 300, y: 80, w: 260, hasTitle: true, title, items: (items.length ? items : ['']).map(text => ({ id: uid(), text: ex(text), done: false })) });
        const col = mk({ type: 'column', x: 80 + ci * 320, y: 80, w: 300, title }); const todos = items.filter(i => i[0] === '☐'), notes = items.filter(i => i[0] !== '☐'); let ord = 0;
        notes.forEach(text => mk({ type: 'note', col: col.id, ord: ord++, html: `<p>${ex(text)}</p>` })); if (!notes.length && !todos.length) mk({ type: 'note', col: col.id, ord: ord++, html: '' });
        if (todos.length) mk({ type: 'todo', col: col.id, ord: ord++, items: todos.map(text => ({ id: uid(), text: ex(text.replace(/^☐\s*/, '')), done: false })) }); });
    } else if (t.k === 'B') {
      mk({ type: 'note', x: 80, y: 80, w: 620, color: 'transparent', html: `<h1>${t.n}</h1>` });
      parts.forEach((p, i) => { const [title, text = ''] = p.split(/:(.*)/s).map(s => s.trim()); mk({ type: 'note', x: 80 + (i % 2) * 320, y: 180 + Math.floor(i / 2) * 180, w: 300, html: `<h2>${title}</h2><p>${ex(text) || '<br>'}</p>` }); });
    } else if (t.k === 'M') {
      const [head, kw = ''] = parts; mk({ type: 'note', x: 80, y: 80, w: 560, color: 'transparent', html: `<h1>${head}</h1><p>${ex('Bilder hierher ziehen oder über die Bildsuche hinzufügen.')}</p>` });
      const hs = [200, 260, 180, 240, 220, 180];[0, 1, 2, 3, 4, 5].forEach(i => mk({ type: 'note', x: 80 + (i % 3) * 300, y: 220 + Math.floor(i / 3) * 300, w: 280, color: '#e5e5ea', ink: '#6e6e73', html: `<p style="text-align:center">${'<br>'.repeat(Math.round(hs[i] / 44))}Bild ${i + 1}${'<br>'.repeat(Math.round(hs[i] / 44))}</p>` }));
      ['#2c2c2e', '#8e8e93', '#d6e8ff', '#ff9f0a', '#ff6b5e'].forEach((hex, i) => mk({ type: 'swatch', x: 1000 + (i % 2) * 180, y: 220 + Math.floor(i / 2) * 200, w: 160, hex }));
      kw.split('|').filter(Boolean).forEach((k, i) => mk({ type: 'note', x: 1380, y: 220 + i * 140, w: 240, html: `<h2>${k}</h2><p><br></p>` }));
    } else if (t.k === 'S') {
      t.d.split('|').forEach((s, i) => { const col = mk({ type: 'column', x: 80 + (i % 4) * 320, y: 80 + Math.floor(i / 4) * 420, w: 300, title: `${i + 1}. ${s}` }); mk({ type: 'sketch', col: col.id, ord: 0, strokes: [], vw: 400, vh: 225 }); mk({ type: 'note', col: col.id, ord: 1, html: `<p>${ex('Was passiert? Kamera, Ton, Text.')}</p>` }); });
    } else if (t.k === 'T') {
      const cells = parts.map(r => r.split('|').map(s => s.trim())), w = Math.max(...cells.map(r => r.length)); cells.forEach(r => { while (r.length < w) r.push(''); });
      const types = {}; cells.forEach((r, ri) => r.forEach((c, ci) => { if (/^(TRUE|FALSE)$/.test(c)) types[ri + ',' + ci] = 'checkbox'; })); const fmt = {}; cells[0].forEach((_, ci) => (fmt['0,' + ci] = { bg: '#e9ecef' }));
      mk({ type: 'note', x: 80, y: 80, w: 560, color: 'transparent', html: `<h1>${t.n}</h1>` }); mk({ type: 'table', x: 80, y: 180, cells: keepEx ? cells : cells.map((r, i) => (i ? r.map(c => (c[0] === '=' || /^(TRUE|FALSE)$/.test(c) ? c : '')) : r)), colW: cells[0].map(() => 130), types, fmt });
    } else if (t.k === 'X') {
      const [center, br = ''] = parts, bs = br.split('|').filter(Boolean), c = mk({ type: 'note', x: 600, y: 400, w: 220, color: '#0a84ff', ink: '#fff', html: `<h2 style="text-align:center">${center}</h2>` });
      bs.forEach((b, i) => { const an = (i / bs.length) * Math.PI * 2 - Math.PI / 2, n = mk({ type: 'note', x: Math.round((610 + Math.cos(an) * 420) / G) * G, y: Math.round((400 + Math.sin(an) * 280) / G) * G, w: 200, html: `<p>${b}</p>` }); mk({ type: 'line', a: { el: c.id }, b: { el: n.id }, headB: false, z: 0 }); });
    }
  });
  return board;
}
