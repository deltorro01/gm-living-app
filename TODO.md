# To do

Open items only. When an item is done, mark it `[x]` and add the commit hash. Don't delete it.

## Next

- [x] Check the live site after the latest deploy: the home page city chooser, `/manchester`, `/liverpool`, the results map, the area guide pages, the favicon and the share images. (`3c9da6e`)
- [ ] Decide the product name (see `DECISIONS.md`).

## Clean-up (once confirmed unused)

- [ ] Delete the old `Images/` folder at the project root. It is no longer referenced, and `public/images/manchester.jpg` replaces it.
- [ ] Delete `public/favicon.svg`. It is no longer referenced, and `public/favicon-pin.svg` replaces it.

## Decisions needed

- [ ] Commute option names: the app says "Hybrid" and "Work from home", the handover says "MediaCity / Salford Quays" and "Remote / flexible".
- [ ] Non-negotiables: the app has tram-only and train-only settings. The handover lists seven requirements, and the rest are not implemented. Adding any changes rankings.

## Data

- [x] Green space for Liverpool: calculated from OpenStreetMap by `osm-ratings.mjs`. (`426bfc5`)
- [ ] Green space for Manchester: still hand-set. Either measure it from OpenStreetMap like Liverpool (needs the free Greater Manchester extract from Geofabrik, about 92 MB), or combine OS Open Greenspace with OS Open Built Up Areas (see `README.md`).
- [ ] Refresh figures when new official data is published, using the steps in `README.md`.

## Later

- [ ] Add a third city, starting in `src/cities.js`.
- [ ] Improve the scoring approach, with a plan and sign-off first (see `SCORING.md`).
