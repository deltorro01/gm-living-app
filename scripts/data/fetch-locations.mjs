// Find a map point (latitude/longitude) for each area in src/data/manchester/areas.json,
// using the free postcodes.io "places" search (Ordnance Survey Open Names).
//
// Only matches inside the area's own borough are accepted. Results are written
// to scripts/data/out/locations.json for review; areas.json is not changed here.
//
// Usage: node scripts/data/fetch-locations.mjs

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { CITY, args, OUT, AREAS_FILE, PHOTOS_FILE, SETTINGS_FOR_CITY, readOut, optionalOut } from "./city.mjs";

const areas = JSON.parse(await readFile(AREAS_FILE));

// Where the area name is not the OS place name: search for this name instead,
// and accept it in this borough (OS sometimes files a place under a neighbouring
// district, or the dataset's borough needs checking).
const SEARCH_OVERRIDES = {
  Chorlton: { name: "Chorlton-cum-Hardy", borough: "Manchester" },
  Saddleworth: { name: "Uppermill", borough: "Oldham" }, // main village of Saddleworth parish
  Whitworth: { name: "Whitworth", borough: "Rossendale" }, // in Rossendale, Lancashire (post town Rochdale); dataset keeps Rochdale
};

// Not in OS Open Names at all: set by hand.
const MANUAL = {
  "Northern Quarter": { lat: 53.4835, lng: -2.2353, note: "Stevenson Square, set by hand" },
};

const PREFERRED_TYPES = ["Suburban Area", "Town", "City", "Village", "Hamlet", "Other Settlement"];

async function search(name) {
  const url = `https://api.postcodes.io/places?q=${encodeURIComponent(name)}&limit=50`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  return (await res.json()).result ?? [];
}

const out = [];
for (const area of areas) {
  if (MANUAL[area.area]) {
    const m = MANUAL[area.area];
    out.push({ area: area.area, borough: area.borough, lat: m.lat, lng: m.lng, matchType: "manual", note: m.note });
    continue;
  }
  const override = SEARCH_OVERRIDES[area.area];
  const name = override?.name ?? area.area;
  const borough = override?.borough ?? area.borough;
  const results = await search(name);
  const inBorough = results.filter(
    (r) => r.district_borough === borough && r.name_1.toLowerCase() === name.toLowerCase()
  );
  inBorough.sort(
    (a, b) => rank(a.local_type) - rank(b.local_type)
  );
  const best = inBorough[0];
  out.push({
    area: area.area,
    borough: area.borough,
    lat: best ? round(best.latitude) : null,
    lng: best ? round(best.longitude) : null,
    matchType: best?.local_type ?? null,
    candidatesInBorough: inBorough.length,
    ...(override ? { note: `searched "${name}" in ${borough}` } : {}),
  });
}

function rank(type) {
  const i = PREFERRED_TYPES.indexOf(type);
  return i === -1 ? PREFERRED_TYPES.length : i;
}

function round(n) {
  return Math.round(n * 100000) / 100000;
}

await mkdir(OUT, { recursive: true });
await writeFile(new URL("locations.json", OUT), JSON.stringify(out, null, 2) + "\n");

const missing = out.filter((o) => o.lat === null);
console.log(`found ${out.length - missing.length} of ${out.length}`);
if (missing.length) console.log("missing:", missing.map((m) => `${m.area} (${m.borough})`).join(", "));
