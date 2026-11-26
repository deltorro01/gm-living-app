# Plan: add Leeds (West Yorkshire)

Status: approved, including the five work locations. Step 1 (area list, 65 areas) done and approved. Step 2 in progress on the `leeds` branch.

## What we're adding

- A third finder at **`/leeds`**, covering **West Yorkshire**: Leeds, Bradford, Wakefield, Kirklees (Huddersfield, Dewsbury) and Calderdale (Halifax, Hebden Bridge).
- About **60 areas**. Liverpool has 55 and Manchester 86.
- An area guide page for each area at `/leeds/<area>`, plus a Leeds card on the home page and a Leeds entry in the header's Cities menu.
- Commute times by bus and train to **five town and city centres**: Leeds, Bradford, Wakefield, Huddersfield and Halifax. A new **"Where do you work?"** choice in the finder picks which one is used (see "Commute: more than one destination" below). West Yorkshire has no tram, so the "With a tram stop" filter is hidden, as it is for Liverpool.

We'll follow the same method as Liverpool, so every figure is worked out from official or open data and none are set by hand. **Scoring doesn't change.** Leeds ratings are given the same spread of 1 to 5 as Manchester's, so a 4 means roughly the same in every city.

## Decisions needed before we start

1. **Name and address.** I suggest "Leeds" at `/leeds`, with "West Yorkshire" as the region name shown on the page (like "Liverpool" and "Liverpool City Region").
2. **Commute destinations.** I suggest five work locations: Leeds (the default), Bradford, Wakefield, Huddersfield and Halifax. This needs a change to how the finder picks the commute time, so it needs your approval under the scoring rule. The details are below.
3. **The area list.** I'll draft about 60 areas (step 1 below) for you to check before any figures are worked out. Examples of what it will include:
   - **Leeds:** City Centre, Headingley, Chapel Allerton, Roundhay, Meanwood, Kirkstall, Horsforth, Otley, Wetherby, Garforth, Rothwell, Morley, Pudsey, Armley, Beeston
   - **Bradford:** City Centre, Saltaire, Shipley, Bingley, Ilkley, Keighley, Haworth, Baildon, Thornton
   - **Wakefield:** City Centre, Ossett, Horbury, Sandal, Castleford, Pontefract
   - **Kirklees:** Huddersfield, Holmfirth, Marsden, Dewsbury, Batley, Mirfield
   - **Calderdale:** Halifax, Hebden Bridge, Todmorden, Sowerby Bridge, Elland, Brighouse
4. **Home page photo.** A freely licensed photo of Leeds for the home page card and the share image, chosen from Wikimedia Commons in step 7.

## Commute: more than one destination

West Yorkshire has several big centres, not one. Many people who live in Shipley work in Bradford, and many who live in Holmfirth work in Huddersfield. If we only measured commutes to Leeds, the finder would rank places for Leeds workers only and give poor advice to everyone else.

**What the visitor sees**
- A new **"Where do you work?"** drop-down next to "Commute preference", shown only on cities with more than one work location. The options are Leeds city centre, Bradford, Wakefield, Huddersfield and Halifax, and the default is Leeds.
- Results, explanations ("about 18 minutes to Huddersfield") and the "shortest commute" sorting all use the chosen place.
- The choice is saved in the shareable link, like the other settings.
- Each area guide shows a small table of journey times to all five centres.

**How it works**
- The commute script runs once for each centre, and each area stores five journey times. Manchester and Liverpool keep their single figure, so their data files don't change.
- **The scoring bands stay exactly the same** (for example, up to 20 minutes scores 85). They are just applied to the chosen place's journey time instead of always the city centre's.
- **Manchester and Liverpool rankings don't move at all,** because they have only one destination. Leeds results with "Leeds city centre" selected work the same way the other cities do.

**Why this is worth doing now rather than later**
- It's much easier to work out all five commute times while the Leeds data is being built than to go back and add them.
- The same feature can later serve Manchester and Liverpool. For example, MediaCity / Salford Quays is still an open item in `TODO.md`, and Birkenhead would suit Wirral residents. That would be a separate, later decision.

**Extra work:** one more step (step 4b below), and a few more journey-time runs in step 4.

## Files you'll need to download

These are all free. Save them in one folder outside the project. Most are the same files used for Liverpool, so you may already have up-to-date copies.

| File | From | New for Leeds? |
|---|---|---|
| Land Registry yearly price files (`pp-YYYY.csv`) | HM Land Registry | No, same files |
| Indices of Deprivation 2025, File 7 | GOV.UK | No, same file |
| Price Index of Private Rents spreadsheet | ONS | No, same file |
| State-funded schools inspections CSV | Ofsted | No, same file |
| National rail timetable (`timetable_full.zip`) | Rail Data Marketplace | No, same file |
| Bus timetable (GTFS) for **Yorkshire** | Bus Open Data Service | **Yes** |
| OpenStreetMap extract for **West Yorkshire** (shapefile) | Geofabrik | **Yes** |

## Steps

All work happens on a branch called `leeds`, with a small commit after each step, as we did for Liverpool. The live site doesn't change until you approve the merge at the end.

1. **Area list.** Draft the list in `scripts/data/leeds/area-list.json`, look up each area's map point and check them on a map. *You check the list.*
2. **Data settings.** Add Leeds to `scripts/data/city.mjs`:
   - the Land Registry counties to read (West Yorkshire plus neighbours, so boundary areas such as Ilkley get enough sales);
   - the city-centre point;
   - the timetable date;
   - the Wikipedia county name ("West Yorkshire").
3. **Prices, safety, rents and schools.** Run the four existing scripts with `--city=leeds`. No code changes expected.
4. **Commute times.** Convert the rail timetable for West Yorkshire and combine it with the Yorkshire bus timetable. Then work out morning journey times from every area to each of the five centres, starting with these points (to be confirmed):
   - Leeds: Briggate, by Leeds station
   - Bradford: Centenary Square, between Interchange and Forster Square stations
   - Wakefield: the Bull Ring, by Westgate station
   - Huddersfield: St George's Square, by the station
   - Halifax: the Piece Hall, by the station

   **4b. "Where do you work?" in the finder.** Add the work-location list to `src/cities.js` and the drop-down to `src/App.jsx`. Use the chosen place's journey time in the commute score, the explanations, the sorting, the shareable link and the area guide's journey-time table. Update `SCORING.md` to describe it. Before merging, check that Manchester and Liverpool results are exactly the same as before: same settings, same order.
5. **Lifestyle ratings.** Count green space, cafés, nightlife, culture, quietness, cycling, driving and train stations from the West Yorkshire OpenStreetMap extract.
6. **Build the dataset.** Run `build-city.mjs --city=leeds`, which writes `src/data/leeds/areas.json`. Check the results for anything odd, such as an area with a far-too-high rent or a missing station.
7. **Photos.** Find and choose a photo for each area with the existing photo review page, keeping each photographer's credit and licence. Then set up the Rightmove links for each area's postcode district (LS, BD, WF, HD, HX), with hand-set districts where an area sits near a boundary.
8. **Pages.**
   - Add Leeds to `src/cities.js` and `src/cityData.js`.
   - Add a `leeds.html` page (copied from `liverpool.html` with Leeds wording) and add it to `vite.config.js`.
   - Add a `/leeds` route to `vercel.json`. Only the routing list changes; the security headers stay the same.
   - The home page card, the Cities menu, the area guides and the sitemap all pick up Leeds automatically from `src/cities.js`.
9. **Docs.** Update `README.md` (Leeds data sources and refresh steps), `DECISIONS.md` and `TODO.md`.
10. **Check and launch.**
    - Run `npm run build`.
    - Check `/leeds`, a range of area guides, the map and phone layouts in the preview.
    - Push the branch so you can review the Vercel preview link.
    - Merge to `main` once you're happy.

## What doesn't change

- **Scoring weights and bands.** The only change is which journey time is fed in, and only where a city has more than one work location. Manchester and Liverpool rankings stay exactly as they are.
- **Security headers and the privacy notice.** No new outside services are added. Map tiles, analytics and fonts are unchanged.
- **Costs.** All the data sources are free, with no paid services or new dependencies.

## Risks and things to watch

- **Places that are far from every centre.** Some areas, such as Haworth or Marsden, are a long way from all five centres. They'll rank low for anyone who wants a short commute, which is correct, and the Work from home option still suits them.
- **Other work places.** Some people work at places that aren't one of the five centres, such as Leeds Bradford Airport, the White Rose Centre or Dewsbury. We could add more later, but each one is another journey-time run and another option in the list.
- **Bus timetable gaps.** The Bus Open Data Service sometimes has very few trips on particular days. For Liverpool we picked a normal weekday after checking, and we'll do the same here.
- **Photos.** Some smaller places may have no good freely licensed photo. Their guide pages will show no photo rather than a poor one.
- **Rents within a borough.** The ONS only publishes an average rent for each borough. Differences between areas in the same borough are estimated from local house prices, as for Liverpool. The README already says so.
