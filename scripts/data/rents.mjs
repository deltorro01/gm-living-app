// Rents based on the official ONS average for each borough.
//
// ONS Price Index of Private Rents (PIPR) gives an average monthly private
// rent for each local authority, but nothing smaller. Two methods:
//
// "scaled" (a city whose areas.json already has rents, e.g. Manchester):
//   - each borough's average of the existing area rents is scaled to match the
//     latest ONS borough average ("Rental price", all property sizes);
//   - the differences between areas inside a borough are kept as they are.
//
// "modelled" (a new city with no rents yet, e.g. Liverpool):
//   - each area gets a local price level: for each type of home (detached,
//     semi, terraced, flat), its median sale price divided by the borough's
//     median for the same type, averaged by the area's mix of homes (so a
//     flat-heavy area is compared flat-for-flat, not with houses);
//   - rent = borough rent x (price level ^ RENT_ELASTICITY), because rents
//     vary less between areas than prices do;
//   - then each borough's areas are scaled so they average the ONS figure.
//
// Either way the borough level is official; the differences between areas are
// estimates. Results are rounded to the nearest £10.
//
// Source: Office for National Statistics, Price Index of Private Rents, UK:
// monthly price statistics. Open Government Licence v3.0.
//
// Usage: node scripts/data/rents.mjs <folder with the UNZIPPED .xlsx (contains xl/)>
// Writes scripts/data/out/rents.json

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { CITY, args, OUT, AREAS_FILE, PHOTOS_FILE, SETTINGS_FOR_CITY, readOut, optionalOut } from "./city.mjs";

const dir = args[0];
if (!dir) throw new Error("Pass the folder holding the unzipped PIPR spreadsheet");

// ONS spells some boroughs differently from the area list.
const ONS_NAME = { "St Helens": "St. Helens" };
const onsName = (b) => ONS_NAME[b] ?? b;
const RENT_ELASTICITY = 0.5;

let areas = null;
try {
  areas = JSON.parse(await readFile(AREAS_FILE, "utf8"));
} catch {
  // new city: no areas.json yet
}
const method = areas?.every((a) => a.averageRent) ? "scaled" : "modelled";
const list = areas ?? (await readOut("locations.json"));
const boroughs = [...new Set(list.map((a) => a.borough))];

// --- minimal .xlsx reading: shared strings + the data sheet ("Table 1") ---
const decode = (s) =>
  s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
const shared = [...(await readFile(join(dir, "xl/sharedStrings.xml"), "utf8")).matchAll(/<si>([\s\S]*?)<\/si>/g)].map(
  (m) => decode(m[1].replace(/<[^>]+>/g, ""))
);
const workbook = await readFile(join(dir, "xl/workbook.xml"), "utf8");
const rels = await readFile(join(dir, "xl/_rels/workbook.xml.rels"), "utf8");
const rid = workbook.match(/<sheet [^>]*name="Table 1"[^>]*r:id="([^"]+)"/)?.[1];
const target = rels.match(new RegExp(`Id="${rid}"[^>]*Target="([^"]+)"`))?.[1] ?? rels.match(new RegExp(`Target="([^"]+)"[^>]*Id="${rid}"`))?.[1];
if (!target) throw new Error('could not find the "Table 1" sheet');
const sheet = await readFile(join(dir, "xl", target.replace(/^\/?xl\//, "")), "utf8");

function cells(row) {
  const out = {};
  for (const m of row.matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const inner = m[3] ?? "";
    let v = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? inner.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? "";
    if (/t="s"/.test(m[2])) v = shared[Number(v)];
    out[m[1]] = decode(v);
  }
  return out;
}

const rows = sheet.match(/<row [^>]*>[\s\S]*?<\/row>/g).map(cells);
const headerIndex = rows.findIndex((r) => r.A === "Time period");
const header = rows[headerIndex];
const colOf = (name) => Object.keys(header).find((k) => header[k] === name);
const cTime = colOf("Time period");
const cName = colOf("Area name");
const cRent = colOf("Rental price");
const cRent2 = colOf("Rental price two bed");

const excelDate = (n) => new Date(Date.UTC(1899, 11, 30) + Number(n) * 86400000).toISOString().slice(0, 7);

const official = {};
for (const r of rows.slice(headerIndex + 1)) {
  const borough = boroughs.find((b) => onsName(b) === r[cName]);
  if (!borough) continue;
  const month = excelDate(r[cTime]);
  const rent = Number(r[cRent]);
  if (!rent) continue;
  if (!official[borough] || month > official[borough].month) {
    official[borough] = { month, rent, twoBed: Number(r[cRent2]) || null };
  }
}

const missing = boroughs.filter((b) => !official[b]);
if (missing.length) throw new Error(`no ONS rent for: ${missing.join(", ")}`);

let results;
if (method === "scaled") {
  results = areas.map((a) => {
    const inBorough = areas.filter((x) => x.borough === a.borough);
    const handSetAverage = inBorough.reduce((s, x) => s + x.averageRent, 0) / inBorough.length;
    const factor = official[a.borough].rent / handSetAverage;
    return {
      area: a.area,
      borough: a.borough,
      oldRent: a.averageRent,
      rent: Math.round((a.averageRent * factor) / 10) * 10,
      boroughOfficial: official[a.borough].rent,
      month: official[a.borough].month,
    };
  });
} else {
  const prices = await readOut("house-prices.json");
  const SHARE_KEY = { D: "detached", S: "semi", T: "terraced", F: "flat" };
  const level = (a) => {
    const p = prices.results.find((r) => r.area === a.area);
    const b = prices.boroughTypeMedian[a.borough];
    let weight = 0;
    let sum = 0;
    for (const t of ["D", "S", "T", "F"]) {
      const w = p.typeShare[SHARE_KEY[t]];
      if (w > 0 && p.typeMedian[t] && b[t]) {
        sum += w * (p.typeMedian[t] / b[t]);
        weight += w;
      }
    }
    return weight ? sum / weight : 1;
  };
  const raw = list.map((a) => ({ a, priceLevel: level(a) }));
  results = raw.map(({ a, priceLevel }) => {
    const inBorough = raw.filter((x) => x.a.borough === a.borough);
    const unscaled = (x) => official[x.a.borough].rent * Math.pow(x.priceLevel, RENT_ELASTICITY);
    const average = inBorough.reduce((s, x) => s + unscaled(x), 0) / inBorough.length;
    const rent = unscaled({ a, priceLevel }) * (official[a.borough].rent / average);
    return {
      area: a.area,
      borough: a.borough,
      priceLevel: Math.round(priceLevel * 100) / 100,
      rent: Math.round(rent / 10) * 10,
      boroughOfficial: official[a.borough].rent,
      month: official[a.borough].month,
    };
  });
}

await writeFile(
  new URL("rents.json", OUT),
  JSON.stringify({ source: "ONS Price Index of Private Rents", method, official, results }, null, 2) + "\n"
);
console.log(`method: ${method}. ONS borough averages:`);
for (const b of boroughs.sort()) console.log(`  ${b.padEnd(11)} £${official[b].rent} (${official[b].month})`);
console.log(`written rents.json for ${CITY}`);
