# Decisions log

One line per decision: what was decided, why, and the commit where it happened. Newest entries at the bottom. Add a new line whenever a decision is made. Where a later decision replaces an earlier one, keep the old line and mark it "superseded" rather than deleting it.

## Decided

- **Keep the current scoring behaviour.** Sliders reward closeness to the user's setting, not high ratings. Kept as it is and documented in `SCORING.md`. Changing it would move every ranking. (`b42ed5c`)
- **One dataset per city.** Each city's areas live in `src/data/<city>/areas.json`. The earlier single file `src/areas.json` was replaced when the app became multi-city. (`96fb46e` superseded by `11065e0`)
- **Social share image.** Images are served from `public/images/` so the `og:image` URLs work on Vercel. The old `Images/manchester.jpg` at the project root is still there. (`b98d2f4`)
- **Crawlable fallback text.** Early static text was replaced by build-time prerendering, which writes the app's HTML into each page. (`4ef4a53` superseded by `d207ddc`)
- **Area guide pages and sitemap at build time.** Each area has its own static guide page, and the sitemap is generated. (`6cc4bef`)
- **Tidy-up.** Unused stylesheet, starter images and icon sprite removed. The template README was replaced; the README has since been rewritten for the multi-city site. (`db1d0ab`)
- **Favicon.** A purple gradient map pin (`public/favicon-pin.svg`) is used on all city pages. The old `public/favicon.svg` is no longer referenced. (`ec46707`)
- **Liverpool City Region launched.** Liverpool is live at `/liverpool`, with 55 areas, area guides and a city chooser on the home page. This superseded "improve before Liverpool". (`fc70e53`, `2bceab3`, `3c9da6e`)
- **Cookie consent.** Google Analytics only loads after a visitor clicks "Accept". (`9eccb45`)
- **Security headers.** A Content-Security-Policy and other security headers are set in `vercel.json`. (`e7bc063`)
- **Contact address.** The footer and privacy notice use `contact@whereshouldiliveinthe.uk`. (`6b00fc6`)
- **Map view.** A results map (Leaflet with OpenStreetMap tiles) is built, and only downloads when opened. This replaces the earlier note that a map was missing from the code. (see `src/AreaMap.jsx`)
- **Handover features still open.** The original handover's seven non-negotiables and the "MediaCity / Salford Quays" and "Remote / flexible" commute options are not implemented. The app uses "Hybrid" and "Work from home" instead. The handover is not the source of truth for these.
- **Site header.** Every page has the same header (`src/SiteHeader.jsx`): the purple pin logo, the site name, and a menu with Home and a Cities dropdown built from `src/cities.js`. The dropdown is a plain `<details>` element so it works on the pages that load no app JavaScript. The header is not sticky, because the finder already has sticky filters. It replaces the "Where Should I Live In…" eyebrow text; the finder eyebrow now shows just the region name. (this commit)
- **Fonts.** Headings (and the site name in the header) use Montserrat; everything else uses Hind. They are self-hosted through the `@fontsource-variable/montserrat` and `@fontsource/hind` packages rather than loaded from Google Fonts, so visitors' browsers don't contact Google and the Content-Security-Policy and privacy notice don't change. Hind has no extra-bold, so weight 800 text shows in bold (700). Replaces the earlier Inter setting, which was never actually loaded. (this commit)

## Open

- **Product name.** The site and README say "Where Should I Live?". The handover says "Greater Manchester Living". The domain is `whereshouldiliveinthe.uk`. Not yet decided.
