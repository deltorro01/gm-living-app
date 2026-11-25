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
import { CITY, args, OUT, AREAS_FILE, PHOTOS_FILE, SETTINGS_FOR_CITY, readOut, optionalOut } from "./city.mjs";

const FROM_MONTH = "2025-09";
const TO_MONTH = "2026-08";
const RADII = [1.5, 2, 2.5, 3];
const MIN_SALES = 30;

const dir = args[0];
if (!dir) throw new Error("Pass the folder that holds pp-2025.csv and pp-2026.csv");

const locations = JSON.parse(await readFile(new URL("locations.json", OUT)));

// 1. Read standard sales in the window, in the counties/districts set for this city (city.mjs).
const { priceCounties, priceDistricts } = SETTINGS_FOR_CITY;
const wanted = [...priceCounties, ...priceDistricts].map((n) => `"${n}"`);
const sales = [];
for (const file of ["pp-2025.csv", "pp-2026.csv"]) {
  const lines = createInterface({ input: createReadStream(join(dir, file)) });
  for await (const line of lines) {
    if (!wanted.some((w) => line.includes(w))) continue;
    const f = line.slice(1, -1).split('","');
    const [, price, date, postcode, type, , , , , , , , district, county, category] = f;
    const month = date.slice(0, 7);
    if ((!priceCounties.includes(county) && !priceDistricts.includes(district)) || category !== "A") continue;
    if (month < FROM_MONTH || month > TO_MONTH || !postcode) continue;
    sales.push({ price: Number(price), postcode, type, district });
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

// Median price for each type of home (D, S, T, F) where there are at least 5 sales.
const TYPES = ["D", "S", "T", "F"];
function typeMedians(list) {
  return Object.fromEntries(
    TYPES.map((t) => {
      const prices = list.filter((s) => s.type === t).map((s) => s.price);
      return [t, prices.length >= 5 ? Math.round(median(prices) / 1000) * 1000 : null];
    })
  );
}

// The same for each borough as a whole (used to estimate rents: rents.mjs).
const boroughTypeMedian = Object.fromEntries(
  [...new Set(locations.map((l) => l.borough))].map((b) => [b, typeMedians(placed.filter((s) => s.district === b.toUpperCase()))])
);

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
        // Share of sales by type of home (%): used for the home-mix ratings.
        typeShare: Object.fromEntries(
          [["detached", "D"], ["semi", "S"], ["terraced", "T"], ["flat", "F"]].map(([name, code]) => [
            name,
            near.length ? Math.round((near.filter((s) => s.type === code).length / near.length) * 100) : 0,
          ])
        ),
        typeMedian: typeMedians(near),
      };
    }
  }
});

await writeFile(
  new URL("house-prices.json", OUT),
  JSON.stringify({ period: `${FROM_MONTH} to ${TO_MONTH}`, boroughTypeMedian, results }, null, 2) + "\n"
);
console.log(`written house-prices.json for ${CITY}`);
