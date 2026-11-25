# Where Should I Live? (Greater Manchester and Liverpool City Region)

A React web app that helps people find the best area to live in, based on their life stage, budget, commute and lifestyle priorities. It ranks 86 Greater Manchester areas (at `/manchester`) and 55 Liverpool City Region areas (at `/liverpool`) by match score.

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
- `src/cities.js`: settings for each city (name, region, web address, city-centre point, transport operator, map centre). Adding a city starts here.
- `src/data/<city>/areas.json`: each city's area dataset, for example `src/data/manchester/areas.json`. Edit this to change area data.
- `index.html` and `src/HomePage.jsx`: the home page, where visitors choose a city. It is built as a plain page with no app JavaScript. Each city card's photo and credit are set in `src/cities.js` (`homePhoto`). `public/home-redirect.js` sends old shared links such as `/?rent=1200` on to `/manchester`, because the home page used to be the Manchester finder. The page title and description mention the total number of areas, so update `index.html` if areas are added.
- `manchester.html` and `liverpool.html`: the city pages served at `/manchester` and `/liverpool`, with the same fallback text.
- `vercel.json`: routing for the city pages, and the security headers sent with every page. The Content-Security-Policy lists the only outside places the site may load from (Google Analytics and OpenStreetMap map tiles). If you add another outside service, such as a font, video or new analytics tool, add it there too or the browser will block it.
- `public/`: files served as they are, such as the favicon, robots file and the city share images (`images/manchester.jpg`, `images/liverpool.jpg`).
- `SCORING.md`: how the match score is calculated.
- `src/AreaPage.jsx`: the guide page for each area (for example `/manchester/ancoats`). These are plain pages built at build time and load no JavaScript.
- `src/data/<city>/areaPhotos.json` and `public/images/areas/` (Manchester) or `public/images/areas/<city>/` (other cities): the photo shown on each area guide, with its photographer and licence for the credit line. The photos are from Wikimedia Commons under Creative Commons or public domain licences, so the credit must stay with each photo.
- `src/site.js`: site name, copyright year and the contact email used by the footer and privacy notice. While the contact email is the `@example.com` placeholder, builds on the live (production) site stop with an error.
- `src/SiteFooter.jsx`: the footer on every page (copyright, Privacy, Cookie settings and Contact links).
- `public/consent.js`: the cookie banner. Google Analytics only loads after a visitor clicks "Accept"; "Reject" is just as easy, the choice is remembered in the browser, and "Cookie settings" in the footer reopens the banner. The Google Analytics ID lives here, not in the HTML pages.
- `src/PrivacyPage.jsx`: the privacy notice at `/privacy`. Update it if the site starts using another service that handles visitors' information.
- `src/slug.js`: turns area names into page addresses (`Hale Barns` becomes `/manchester/hale-barns`).
- `scripts/prerender.mjs`: runs after `vite build`. It writes the app's HTML into the home and city pages so search engines can read it, links the area names on each city page, writes the area guide pages to `dist/<city>/<area>/index.html`, and writes `dist/sitemap.xml`. The sitemap is generated, so there is no `public/sitemap.xml` to edit.
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
7. `node scripts/data/apply.mjs` to preview, then `node scripts/data/apply.mjs --write` to update `src/data/manchester/areas.json`.

Whitworth is in Rossendale (Lancashire), just outside Greater Manchester, but is kept under Rochdale in the dataset because that is its post town.

### Liverpool City Region (and other new cities)

The scripts take `--city=liverpool`. Settings for each city (which Land Registry counties to read, the city-centre point, the timetable date, hand-set Rightmove postcode districts) are in `scripts/data/city.mjs`. Manchester's results go to `scripts/data/out/`, other cities' to `scripts/data/out/<city>/`. Liverpool's area list is `scripts/data/liverpool/area-list.json`, and its map points are in `scripts/data/out/liverpool/locations.json` (a few set by hand).

Unlike Manchester, every Liverpool figure is calculated; none are hand-set:

- **House prices, safety, rents, schools:** the same sources as Manchester. Rents start from the ONS borough average, and the differences between areas are estimated from local house prices.
- **Commute:** buses and ferries from the Bus Open Data Service timetable (GTFS) and trains from the national rail timetable (`timetable_full.zip` from the Rail Data Marketplace, converted by `cif-to-gtfs.mjs`), to Church Street / Liverpool ONE.
- **Green space, nightlife, cafés, culture, quietness, cycling, driving, train station:** counted from OpenStreetMap by `osm-ratings.mjs`, using the free Geofabrik shapefile extracts for Merseyside and Cheshire. © OpenStreetMap contributors, Open Database Licence.
- **1 to 5 ratings:** areas are put in order by each measure, then given the same spread of ratings Manchester has, so a rating means roughly the same in both cities.
- **Rightmove links:** each area's main postcode district (for example L7), because place names alone can open the wrong town.

To refresh: run `house-prices.mjs`, `safety.mjs`, `rents.mjs` and `schools.mjs` as above with `--city=liverpool`, then `cif-to-gtfs.mjs <unzipped rail timetable> <output folder> --city=liverpool`, `commute.mjs <bus GTFS folder> <rail GTFS folder> --city=liverpool`, `osm-ratings.mjs <extract folders> --city=liverpool`, and finally `build-city.mjs --city=liverpool`, which writes `src/data/liverpool/areas.json`.

## Hosting

The site is hosted on Vercel and deploys automatically when changes are pushed to the `main` branch on GitHub.

## Notes

- The hand-set ratings and the neighbourhood differences in rent are indicative. House prices are recent sale prices, not valuations or asking prices.
- Any change to the scoring rules changes existing rankings. Read `SCORING.md` before changing them.

## Area photos

Each area guide shows one photo chosen by hand from Wikimedia Commons. To change them:

1. `node scripts/data/fetch-photos.mjs` finds up to four freely licensed photos per area and saves them to `scripts/data/out/photo-candidates.json`.
2. `npx vite scripts/data --port 4173`, then open `http://localhost:4173/photo-review.html` to pick one photo (or none) per area. Use "Download choices" and save the file as `scripts/data/out/photo-choices.json`.
3. `node scripts/data/apply-photos.mjs` downloads the chosen photos (960 pixels wide) to `public/images/areas/` and writes the credits to `src/data/manchester/areaPhotos.json`. It goes slowly and can be run again to resume if Wikimedia is busy.

For another city, add `--city=liverpool` to both scripts and open `photo-review.html?city=liverpool`. The review page remembers each city's choices separately.

The scripts identify themselves to Wikimedia with the site's address, as Wikimedia asks of automated tools.
