// Typical house price for each area from HM Land Registry Price Paid Data.
//
// Method:
//   - Greater Manchester (plus Rossendale) sales from FROM_MONTH to TO_MONTH (inclusive).
//   - Standard sales only (PPD category "A"): excludes repossessions,
//     buy-to-let portfolio and other non-market transfers.
//   - Each sale is placed on the map by its postcode (postcodes.io).
//   - For each area, take the MEDIAN price of sales within RADII[0] km of the
//     area's point, widening the circle until there are at least MIN_SALES.
//
// Contains HM Land Registry data © Crown copyright and database right 2026.
// Licensed under the Open Government Licence v3.0.
//
// Usage: node scripts/data/house-prices.mjs <folder containing pp-2025.csv and pp-2026.csv>
// Needs scripts/data/out/locations.json (from fetch-locations.mjs).
// Writes scripts/data/out/house-prices.json and caches postcode lookups in
// scripts/data/out/postcodes-cache.json (also used by safety.mjs).

import { createReadStream } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { join } from "node:path";
import { lookupPostcodes, distanceKm } from "./geo.mjs";

const FROM_MONTH = "2025-09";
const TO_MONTH = "2026-08";
const RADII = [1.5, 2, 2.5, 3];
const MIN_SALES = 30;

const dir = process.argv[2];
if (!dir) throw new Error("Pass the folder that holds pp-2025.csv and pp-2026.csv");

const locations = JSON.parse(await readFile(new URL("./out/locations.json", import.meta.url)));

// 1. Read Greater Manchester standard sales in the window.
const sales = [];
for (const file of ["pp-2025.csv", "pp-2026.csv"]) {
  const lines = createInterface({ input: createReadStream(join(dir, file)) });
  for await (const line of lines) {
    if (!line.includes('"GREATER MANCHESTER"') && !line.includes('"ROSSENDALE"')) continue;
    const f = line.slice(1, -1).split('","');
    const [, price, date, postcode, type, , , , , , , , district, county, category] = f;
    const month = date.slice(0, 7);
    // Rossendale (Lancashire) is included because Whitworth sits just over the boundary.
    if ((county !== "GREATER MANCHESTER" && district !== "ROSSENDALE") || category !== "A") continue;
    if (month < FROM_MONTH || month > TO_MONTH || !postcode) continue;
    sales.push({ price: Number(price), postcode, type });
  }
}
console.log(`sales in window: ${sales.length}`);

// 2. Put each sale on the map.
const coords = await lookupPostcodes([...new Set(sales.map((s) => s.postcode))]);
const placed = sales.filter((s) => coords[s.postcode]);
console.log(`sales with a known postcode location: ${placed.length}`);

// 3. Median price near each area.
function median(values) {
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

const results = locations.map((loc) => {
  for (const radius of RADII) {
    const near = placed.filter((s) => distanceKm(loc, coords[s.postcode]) <= radius);
    if (near.length >= MIN_SALES || radius === RADII.at(-1)) {
      const flats = near.filter((s) => s.type === "F").length;
      return {
        area: loc.area,
        medianPrice: Math.round(median(near.map((s) => s.price)) / 1000) * 1000,
        sales: near.length,
        radiusKm: radius,
        flatShare: near.length ? Math.round((flats / near.length) * 100) : null,
      };
    }
  }
});

await writeFile(
  new URL("./out/house-prices.json", import.meta.url),
  JSON.stringify({ period: `${FROM_MONTH} to ${TO_MONTH}`, results }, null, 2) + "\n"
);
console.log("written scripts/data/out/house-prices.json");
