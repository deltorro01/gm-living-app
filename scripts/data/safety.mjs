// Safety for each area from the English Indices of Deprivation 2025, Crime domain.
//
// The Crime domain measures the risk of personal and material victimisation
// in each small neighbourhood (LSOA, about 1,500 residents), using police
// recorded crime per head of population.
//
// Method:
//   - Neighbourhoods (LSOAs) are found from the postcodes near each area's
//     point (within RADIUS_KM), using the postcode cache built by house-prices.mjs.
//   - The area's crime decile is the population-weighted average of those
//     neighbourhoods' national Crime deciles (1 = the 10% highest-crime
//     neighbourhoods in England, 10 = the 10% lowest).
//
// Source: Ministry of Housing, Communities and Local Government,
// English Indices of Deprivation 2025, File 7. Open Government Licence v3.0.
//
// Usage: node scripts/data/safety.mjs <folder containing iod2025-file7.csv>
// Writes scripts/data/out/safety.json

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { distanceKm } from "./geo.mjs";

const RADIUS_KM = 1.5;

const dir = process.argv[2];
if (!dir) throw new Error("Pass the folder that holds iod2025-file7.csv");

const locations = JSON.parse(await readFile(new URL("./out/locations.json", import.meta.url)));
const postcodes = JSON.parse(await readFile(new URL("./out/postcodes-cache.json", import.meta.url)));

// Parse File 7 (quoted CSV; some names contain commas).
function parseCsvLine(line) {
  const cells = [];
  let cur = "";
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === "," && !quoted) {
      cells.push(cur);
      cur = "";
    } else cur += ch;
  }
  cells.push(cur);
  return cells;
}

const [header, ...rows] = (await readFile(join(dir, "iod2025-file7.csv"), "utf8")).trim().split(/\r?\n/);
const cols = parseCsvLine(header);
const col = (name) => {
  const i = cols.findIndex((c) => c.startsWith(name));
  if (i === -1) throw new Error(`column not found: ${name}`);
  return i;
};
const iCode = col("LSOA code (2021)");
const iDecile = col("Crime Decile");
const iScore = col("Crime Score");
const iPop = col("Total population");

const lsoas = {};
for (const row of rows) {
  const c = parseCsvLine(row);
  lsoas[c[iCode]] = { decile: Number(c[iDecile]), score: Number(c[iScore]), pop: Number(c[iPop]) };
}

const placed = Object.values(postcodes).filter(Boolean);

const results = locations.map((loc) => {
  const codes = new Set(
    placed.filter((p) => p.lsoa && distanceKm(loc, p) <= RADIUS_KM).map((p) => p.lsoa)
  );
  const found = [...codes].map((c) => lsoas[c]).filter(Boolean);
  const pop = found.reduce((s, l) => s + l.pop, 0);
  const weighted = (key) => found.reduce((s, l) => s + l[key] * l.pop, 0) / pop;
  return {
    area: loc.area,
    neighbourhoods: found.length,
    population: pop,
    crimeDecile: Math.round(weighted("decile") * 10) / 10,
    crimeScore: Math.round(weighted("score") * 1000) / 1000,
  };
});

await writeFile(
  new URL("./out/safety.json", import.meta.url),
  JSON.stringify({ source: "English Indices of Deprivation 2025, Crime domain", results }, null, 2) + "\n"
);
console.log("written scripts/data/out/safety.json");
