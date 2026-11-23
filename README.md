# Where Should I Live? (Greater Manchester)

A React web app that helps people find the best Greater Manchester area to live in, based on their life stage, budget, commute and lifestyle priorities. It ranks 86 areas by match score.

## Running the app locally

You need Node.js installed.

1. Open a terminal in the project folder.
2. Install the packages: `npm install`
3. Start the development server: `npm run dev`
4. Open the address shown in the terminal (usually http://localhost:5173).

To create the production build, run `npm run build`. The output goes to the `dist` folder.

## Where things live

- `src/App.jsx`: the app, including the preference form, scoring, filters and results.
- `src/explain.js`: the plain-English "Why this match?" reasons for each area.
- `src/ResultParts.jsx`: the "Why this match?" panel, the Compare button and the comparison table.
- `src/bands.js`: the fit labels (Excellent, Strong, Good, Worth a look) and their score thresholds and map colours.
- `src/urlState.js`: keeps the settings, filters and compared areas in the web address so results can be shared.
- `src/AreaMap.jsx`: the results map (Leaflet with OpenStreetMap tiles). It only downloads when someone opens the map.
- `src/styles.css`: all styling.
- `src/areas.json`: the area dataset that the app uses. Edit this file to change area data.
- `index.html`: the home page. It includes a short fallback text that search engines can read.
- `manchester.html`: the Manchester page served at `/manchester`, with the same fallback text.
- `vercel.json`: routing for the Manchester page.
- `public/`: files served as they are, such as the favicon, robots file, sitemap and the Manchester share image.
- `SCORING.md`: how the match score is calculated.
- `scripts/prerender.mjs`: runs after `vite build` and writes the app's HTML into the built pages so search engines can read it.
- `scripts/data/`: scripts that calculate figures from official data (see "Data sources" below).

## Data sources

House prices, rents, safety, schools and commute times come from official open data. The other ratings (nightlife, cafés, culture, quietness, green space, value, cycling, driving) are hand-set estimates.

- **Map points (`lat`, `lng`):** Ordnance Survey Open Names, via postcodes.io. A few areas need a manual choice; these are listed in `scripts/data/fetch-locations.mjs`.
- **House price (`averageHousePrice`):** the median price of standard sales within 1.5 km of the area's point over 12 months, from HM Land Registry Price Paid Data. Contains HM Land Registry data © Crown copyright and database right 2026, licensed under the Open Government Licence v3.0.
- **Safety (`safety`):** the crime domain of the English Indices of Deprivation 2025 (Ministry of Housing, Communities and Local Government), averaged over the neighbourhoods within 1.5 km. Areas are put in order by crime level and given the same spread of 1 to 5 ratings as before, so a 5 means "among the safest of these areas", not "among the safest in England". police.uk is not used because it has almost no Greater Manchester Police data.
- **Rent (`averageRent`):** the ONS Price Index of Private Rents gives an average rent for each borough only. Each borough's areas are scaled so they average the ONS figure; the differences between areas within a borough are still estimates.
- **Schools (`schools`):** Ofsted's state-funded schools inspections and outcomes data. Each school is scored from its new report card if it has one, otherwise its older grade (Outstanding 4.5, Good 3.25, Requires improvement 2, Inadequate 1 on a 1 to 5 scale). Primary schools within 2 km and secondary schools within 3 km are averaged, weighted by pupil numbers, then ranked within the 86 areas like safety.
- **Commute (`commuteCityMinutes`):** time on board buses and trams to Piccadilly Gardens, averaged over departures between 07:30 and 08:30 on a weekday, worked out from the TfGM timetable (GTFS) by `commute.mjs`. The timetable has no trains, so areas with a station keep their earlier estimate where it is faster. Door-to-door times (including walking and waiting) are recorded in `dataSources`.
- **Green space:** not yet updated. `greenspace.mjs` measures OS Open Greenspace around each area, but that dataset leaves out open countryside, so on its own it rates rural villages lowest. It needs combining with OS Open Built Up Areas before it is used.
- Each area's `dataSources` field records the exact basis for its figures.

To refresh the figures, download these into one folder outside the project: the Land Registry yearly files (`pp-YYYY.csv`), File 7 of the Indices of Deprivation, the ONS Price Index of Private Rents spreadsheet (unzip it into a subfolder), the Ofsted state-funded schools inspections CSV and the TfGM GTFS zip (unzipped). Change the months or dates at the top of `house-prices.mjs` and `commute.mjs` if needed, then run:

1. `node scripts/data/fetch-locations.mjs`
2. `node scripts/data/house-prices.mjs <folder>`
3. `node scripts/data/safety.mjs <folder>`
4. `node scripts/data/rents.mjs <unzipped rents spreadsheet folder>`
5. `node scripts/data/schools.mjs <Ofsted CSV>`
6. `node scripts/data/commute.mjs <unzipped GTFS folder>`
7. `node scripts/data/apply.mjs` to preview, then `node scripts/data/apply.mjs --write` to update `src/areas.json`.

Whitworth is in Rossendale (Lancashire), just outside Greater Manchester, but is kept under Rochdale in the dataset because that is its post town.

## Hosting

The site is hosted on Vercel and deploys automatically when changes are pushed to the `main` branch on GitHub.

## Notes

- The hand-set ratings and the neighbourhood differences in rent are indicative. House prices are recent sale prices, not valuations or asking prices.
- Any change to the scoring rules changes existing rankings. Read `SCORING.md` before changing them.
