// Check a new city's draft area list and find a map point for each area.
//
//   node scripts/data/check-area-list.mjs --city=leeds
//
// Reads scripts/data/<city>/area-list.json: [{ area, borough }], where an entry
// can also have:
//   search    the Ordnance Survey place name to look up, if it differs from `area`
//   postcode  use this postcode's point instead (for town and city centres)
//   note      why the point was chosen
//
// Uses the free postcodes.io API (Ordnance Survey Open Names and the ONS
// postcode directory). Only places inside the area's own borough are accepted.
// Places with the same name in other boroughs are listed, so mix-ups (e.g. a
// second "Heaton") can be spotted.
//
// Writes:
//   scripts/data/<city>/area-check.json     full results, for review
//   scripts/data/out/<city>/locations.json  map points used by the other scripts
//
// Manchester's points come from fetch-locations.mjs instead.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { CITY, OUT } from "./city.mjs";

if (CITY === "manchester") throw new Error("Use fetch-locations.mjs for Manchester");

const LIST_FILE = new URL(`./${CITY}/area-list.json`, import.meta.url);
const CHECK_FILE = new URL(`./${CITY}/area-check.json`, import.meta.url);
const list = JSON.parse(await readFile(LIST_FILE, "utf8"));

const PREFERRED_TYPES = ["Suburban Area", "Town", "City", "Village", "Hamlet", "Other Settlement"];
const rank = (type) => (PREFERRED_TYPES.includes(type) ? PREFERRED_TYPES.indexOf(type) : PREFERRED_TYPES.length);
const round = (n) => Math.round(n * 100000) / 100000;
const sameName = (a, b) => a.toLowerCase().replace(/[-\s]+/g, " ") === b.toLowerCase().replace(/[-\s]+/g, " ");

async function getJson(url) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url);
    if (res.ok) return res.json();
    if (res.status === 404) return { result: null };
    if (attempt === 3) throw new Error(`${url}: HTTP ${res.status}`);
    await new Promise((r) => setTimeout(r, 1000 * attempt));
  }
}

const checks = [];
for (const entry of list) {
  const { area, borough } = entry;

  if (entry.postcode) {
    const { result } = await getJson(`https://api.postcodes.io/postcodes/${encodeURIComponent(entry.postcode)}`);
    const ok = result && result.admin_district === borough;
    checks.push({
      area,
      borough,
      found: Boolean(ok),
      type: "postcode",
      lat: ok ? round(result.latitude) : null,
      lng: ok ? round(result.longitude) : null,
      elsewhere: [],
      note: ok ? `${entry.note ?? "set from a postcode"} (${entry.postcode})` : `postcode ${entry.postcode} not found in ${borough}`,
    });
    continue;
  }

  const name = entry.search ?? area;
  const { result } = await getJson(`https://api.postcodes.io/places?q=${encodeURIComponent(name)}&limit=100`);
  const matches = (result ?? []).filter((r) => sameName(r.name_1, name));
  const inBorough = matches.filter((r) => r.district_borough === borough).sort((a, b) => rank(a.local_type) - rank(b.local_type));
  const best = inBorough[0];
  const elsewhere = [...new Set(matches.filter((r) => r.district_borough !== borough).map((r) => `${r.district_borough ?? r.county_unitary ?? "?"} (${r.local_type})`))];

  checks.push({
    area,
    borough,
    found: Boolean(best),
    type: best?.local_type ?? null,
    lat: best ? round(best.latitude) : null,
    lng: best ? round(best.longitude) : null,
    elsewhere,
    ...(entry.search ? { note: `searched "${name}"` } : {}),
    ...(entry.note && !entry.search ? { note: entry.note } : {}),
  });
}

await writeFile(CHECK_FILE, JSON.stringify(checks, null, 2) + "\n");

const locations = checks.map((c) => ({
  area: c.area,
  borough: c.borough,
  lat: c.lat,
  lng: c.lng,
  matchType: c.type === "postcode" ? "manual" : c.type,
  ...(c.note ? { note: c.note } : {}),
}));
await mkdir(OUT, { recursive: true });
await writeFile(new URL("locations.json", OUT), JSON.stringify(locations, null, 2) + "\n");

const missing = checks.filter((c) => !c.found);
console.log(`found ${checks.length - missing.length} of ${checks.length}`);
for (const m of missing) console.log(`  NOT FOUND: ${m.area} (${m.borough})${m.note ? ` - ${m.note}` : ""}`);
