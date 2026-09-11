# Presenter Nova

Een zelfstandige, moderne interactieve whiteboard/presentatie-webapp voor onderwijs, gebouwd als statische GitHub Pages-app.

> Dit project gebruikt eigen code, eigen vormgeving en eigen assets. Het is geen officiële Prowise-app en bevat geen gekopieerde proprietary broncode of merkassets.

## Nu werkend

- Meerdere pagina's, pagina dupliceren/verwijderen/navigeren
- Pen, markeerstift, gum, lijn, rechthoek, cirkel, tekst en laserpointer
- Selecteren, verplaatsen, dupliceren, verwijderen en lagen wijzigen
- Kleur, lijndikte en vormvulling
- Undo/redo en sneltoetsen
- Achtergronden: blanco, raster, lijnen, stippen, crème en donker
- Afbeeldingen uploaden
- Mediabibliotheek met les-sjablonen
- Widgets: timer, live klok, dobbelsteen, stoplicht, scorebord, naamkiezer en rekenmachine
- Lesgereedschap en visuele onderwijsobjecten
- Pagina-notities voor de docent
- Presentatiemodus en fullscreen
- Zoom en passend maken
- Automatisch lokaal opslaan in de browser
- Project export/import als JSON
- Pagina exporteren als PNG voor vectorobjecten
- Connect/klassessie UI als voorbereid onderdeel
- Responsive desktop/tablet/mobile interface

## GitHub Pages

1. Open de repository op GitHub.
2. Ga naar **Settings → Pages**.
3. Kies **Deploy from a branch**.
4. Kies branch `main` en map `/ (root)`.
5. Sla op.

Omdat de app volledig statisch is, is geen Node.js-server nodig.

## Belangrijk voor de volgende fase

Functies zoals echte realtime samenwerking, accounts/cloudopslag, leerlingdevices, live screen sharing, server-side AI en centrale contentbibliotheken vereisen een backend of externe service. De interface en lokale flows kunnen statisch draaien, maar echte multi-user synchronisatie niet.

## Structuur

- `index.html` — volledige applicatieshell
- `styles.css` — moderne interface en responsive layout
- `app.js` — whiteboard engine, pagina's, tools, widgets, opslag en export
