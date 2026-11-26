# Project rules for Claude Code

Read this file first in every session. Then read `DECISIONS.md` before changing anything, and `TODO.md` for open items. The `README.md` has the full file guide and the data-refresh steps.

## What the app is

"Where Should I Live?" is a React + Vite site that helps people find the best place to live, based on life stage, budget, commute and lifestyle. It covers two areas:

- **Greater Manchester**: 86 areas, at `/manchester`.
- **Liverpool City Region**: 55 areas, at `/liverpool`.

The home page (`/`) is a city chooser. Live at https://www.whereshouldiliveinthe.uk/, hosted on Vercel from the `main` branch.

Stack: React 18, Vite 6, Framer Motion, Lucide React, Leaflet (results map), plain CSS. No TypeScript, no router library. The build is `vite build && node scripts/prerender.mjs`. The prerender step writes the HTML that search engines read, the area guide pages and the sitemap, so a build is not complete until it has run.

## Key files

- `src/App.jsx`: the finder (form, scoring, results).
- `src/cities.js`: settings for each city. Adding a city starts here.
- `src/data/<city>/areas.json`: each city's dataset. This is the only place area data lives. It includes `BuyURL` and `RentURL`, which must be kept.
- `src/explain.js`, `src/ResultParts.jsx`, `src/bands.js`, `src/urlState.js`: explanations, result panels, fit labels, and settings shared in the web address.
- `src/AreaMap.jsx`: the results map. `src/AreaPage.jsx`: the guide page for each area.
- `src/SiteHeader.jsx`: the header on every page (logo, site name, Home and Cities menu).
- `src/HomePage.jsx`, `src/SiteFooter.jsx`, `src/PrivacyPage.jsx`, `src/site.js`: home page, footer, privacy notice, site-wide settings.
- `public/consent.js`: the cookie banner. Google Analytics only loads after "Accept".
- `scripts/prerender.mjs`: the build step described above. `scripts/data/`: scripts that calculate the figures from official data.
- `vercel.json`: page routing and the security headers, including the Content-Security-Policy.
- `SCORING.md`: how scores are calculated.

## Rules

1. **Don't change scoring** (weights, life-stage mixes, commute bands, affordability bands, or the preference-matching rule) without asking first. Any change moves existing rankings. Explain the impact and wait for approval.
2. **Don't change routing or headers** in `vercel.json` without reading the current file first. If you add an outside service (a font, a map tile server, analytics), add its address to the Content-Security-Policy too, or the browser will block it.
3. **Edit area data only in `src/data/<city>/areas.json`.** Don't remove or rename fields, don't change the JSON structure, and don't create other copies of the data. To refresh figures, follow the steps in `README.md`.
4. **Keep photo credits.** Each photo in `src/data/<city>/areaPhotos.json` has its photographer and licence. Don't remove them.
5. **Keep the contact address real.** `src/site.js` must not use the `@example.com` placeholder, because production builds stop with an error if it does.
6. **Privacy.** If a new service receives visitors' information, update `src/PrivacyPage.jsx`. Analytics must not load before a visitor accepts it.
7. **Explain before large changes.** For anything that touches more than a couple of files or changes how the site is built, give a short plan and wait for approval.
8. **Keep the build working.** Run `npm run build` (which includes the prerender step) and check it finishes before calling a change done.
9. **Work on a branch** for anything beyond a small fix. Vercel creates a preview link for branches, so check there before merging to `main`.
10. **Commit small and often**, with a clear message. Add the Co-Authored-By line.
11. **Git safety.** Never run destructive commands (reset, force-push, deleting branches, discarding changes) without first checking `git status` for uncommitted work.
12. **Record decisions.** When a decision is made, add a line to `DECISIONS.md` in the same commit.
13. **Explain steps.** The product owner is not a professional developer. Give exact commands, say which folder to be in, explain what each does, and say what success looks like.

## Things not to do

- Don't add paid services (for example, a paid map provider) without listing costs and alternatives first.
- Don't add dependencies unless they're clearly needed. Say why.
- Don't load fonts from Google Fonts or another outside server. Montserrat and Hind are self-hosted (see `README.md`).
- Don't treat area scores or prices as verified live market data. Many ratings are hand-set estimates; the README lists which figures come from official data.
</content>
