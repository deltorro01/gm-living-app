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

- `src/App.jsx`: the app, including the preference form, scoring and results.
- `src/styles.css`: all styling.
- `src/areas.json`: the area dataset that the app uses. Edit this file to change area data.
- `index.html`: the home page. It includes a short fallback text that search engines can read.
- `manchester.html`: the Manchester page served at `/manchester`, with the same fallback text.
- `vercel.json`: routing for the Manchester page.
- `public/`: files served as they are, such as the favicon, robots file, sitemap and the Manchester share image.
- `SCORING.md`: how the match score is calculated.
- `scripts/prerender.mjs`: runs after `vite build` and writes the app's HTML into the built pages so search engines can read it.
- `scripts/data/`: scripts that calculate house prices and safety from official data (see "Data sources" below).

## Data sources

House prices and safety come from official open data. The other ratings (nightlife, green space, schools and so on), rents and commute times are hand-set estimates.

- **Map points (`lat`, `lng`):** Ordnance Survey Open Names, via postcodes.io. A few areas need a manual choice; these are listed in `scripts/data/fetch-locations.mjs`.
- **House price (`averageHousePrice`):** the median price of standard sales within 1.5 km of the area's point over 12 months, from HM Land Registry Price Paid Data. Contains HM Land Registry data © Crown copyright and database right 2026, licensed under the Open Government Licence v3.0.
- **Safety (`safety`):** the crime domain of the English Indices of Deprivation 2025 (Ministry of Housing, Communities and Local Government), averaged over the neighbourhoods within 1.5 km. Areas are put in order by crime level and given the same spread of 1 to 5 ratings as before, so a 5 means "among the safest of these areas", not "among the safest in England". police.uk is not used because it has almost no Greater Manchester Police data.
- Each area's `dataSources` field records the exact basis for its figures.

To refresh the figures, download the Land Registry yearly files (`pp-YYYY.csv`) and File 7 of the Indices of Deprivation into one folder outside the project, change the months at the top of `house-prices.mjs` if needed, then run:

1. `node scripts/data/fetch-locations.mjs`
2. `node scripts/data/house-prices.mjs <folder>`
3. `node scripts/data/safety.mjs <folder>`
4. `node scripts/data/apply.mjs rank` to preview, then `node scripts/data/apply.mjs rank --write` to update `src/areas.json`.

Whitworth is in Rossendale (Lancashire), just outside Greater Manchester, but is kept under Rochdale in the dataset because that is its post town.

## Hosting

The site is hosted on Vercel and deploys automatically when changes are pushed to the `main` branch on GitHub.

## Notes

- Rents and the hand-set ratings are indicative. House prices are recent sale prices, not valuations or asking prices.
- Any change to the scoring rules changes existing rankings. Read `SCORING.md` before changing them.
