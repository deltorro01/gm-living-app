// Merge the calculated figures into the area dataset.
//
//   averageHousePrice  <- median Land Registry sale price (house-prices.mjs)
//   safety (1-5)       <- IoD 2025 crime level (safety.mjs), see SAFETY_METHOD
//   lat, lng           <- added (fetch-locations.mjs)
//   dataSources        <- added: where the price and safety figures came from
//
// No existing fields are removed or renamed; all other values are unchanged.
//
// Usage:
//   node scripts/data/apply.mjs [rank|national]            preview only, writes scripts/data/out/areas.candidate.json
//   node scripts/data/apply.mjs [rank|national] --write    also overwrites src/areas.json
//
// Safety methods:
//   rank      Areas are put in order by real crime level, then given the same
//             spread of 1-5 ratings the dataset already has (relative to the
//             other 86 areas). Keeps the app's balance; reorders who is safest.
//   national  1-5 from the national crime decile (1-2 -> 1, 3-4 -> 2, ... 9-10 -> 5).
//             Compares with all of England; most Greater Manchester areas score 1-3.

import { readFile, writeFile } from "node:fs/promises";

const method = process.argv[2] ?? "rank";
const write = process.argv.includes("--write");
if (!["rank", "national"].includes(method)) throw new Error("method must be rank or national");

const read = async (p) => JSON.parse(await readFile(new URL(p, import.meta.url), "utf8"));
const areasFile = new URL("../../src/areas.json", import.meta.url);
const areas = JSON.parse(await readFile(areasFile, "utf8"));
const locations = await read("./out/locations.json");
const prices = await read("./out/house-prices.json");
const safety = await read("./out/safety.json");

const byArea = (list) => Object.fromEntries(list.map((x) => [x.area, x]));
const loc = byArea(locations);
const price = byArea(prices.results);
const crime = byArea(safety.results);

let safetyRating;
if (method === "national") {
  safetyRating = (area) => Math.min(5, Math.max(1, Math.ceil(crime[area].crimeDecile / 2)));
} else {
  // Same spread of ratings as today, assigned in order of real crime level.
  const spread = areas.map((a) => a.safety).sort((x, y) => x - y);
  const ordered = [...areas].sort(
    (a, b) => crime[a.area].crimeDecile - crime[b.area].crimeDecile || a.area.localeCompare(b.area)
  );
  const rating = Object.fromEntries(ordered.map((a, i) => [a.area, spread[i]]));
  safetyRating = (area) => rating[area];
}

const updated = areas.map((a) => {
  const p = price[a.area];
  const c = crime[a.area];
  const l = loc[a.area];
  if (!p || !c || !l) throw new Error(`missing data for ${a.area}`);
  return {
    ...a,
    averageHousePrice: p.medianPrice,
    safety: safetyRating(a.area),
    lat: l.lat,
    lng: l.lng,
    dataSources: {
      averageHousePrice: `Median of ${p.sales} HM Land Registry sales within ${p.radiusKm} km, ${prices.period}`,
      safety: `English Indices of Deprivation 2025 crime domain, average national decile ${c.crimeDecile} (${method === "rank" ? "ranked against the other areas" : "national bands"})`,
    },
  };
});

// Keep the file's existing style: 2-space JSON, Windows line endings, no final newline.
const text = JSON.stringify(updated, null, 2).replace(/\n/g, "\r\n");
await writeFile(new URL("./out/areas.candidate.json", import.meta.url), text);
if (write) await writeFile(areasFile, text);
console.log(`safety method: ${method}${write ? " (written to src/areas.json)" : " (preview only)"}`);
