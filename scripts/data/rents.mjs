// Rents scaled to the official ONS average for each borough.
//
// ONS Price Index of Private Rents (PIPR) gives an average monthly private
// rent for each local authority, but nothing smaller. So:
//   - each borough's average of the area rents in src/areas.json is scaled to
//     match the latest ONS borough average ("Rental price", all property sizes);
//   - the differences between areas inside a borough are kept as they are
//     (they are still estimates);
//   - results are rounded to the nearest £10.
//
// Source: Office for National Statistics, Price Index of Private Rents, UK:
// monthly price statistics. Open Government Licence v3.0.
//
// Usage: node scripts/data/rents.mjs <folder with the UNZIPPED .xlsx (contains xl/)>
// Writes scripts/data/out/rents.json

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const dir = process.argv[2];
if (!dir) throw new Error("Pass the folder holding the unzipped PIPR spreadsheet");

const areas = JSON.parse(await readFile(new URL("../../src/areas.json", import.meta.url), "utf8"));
const boroughs = [...new Set(areas.map((a) => a.borough))];

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
  if (!boroughs.includes(r[cName])) continue;
  const month = excelDate(r[cTime]);
  const rent = Number(r[cRent]);
  if (!rent) continue;
  if (!official[r[cName]] || month > official[r[cName]].month) {
    official[r[cName]] = { month, rent, twoBed: Number(r[cRent2]) || null };
  }
}

const missing = boroughs.filter((b) => !official[b]);
if (missing.length) throw new Error(`no ONS rent for: ${missing.join(", ")}`);

const results = areas.map((a) => {
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

await writeFile(
  new URL("./out/rents.json", import.meta.url),
  JSON.stringify({ source: "ONS Price Index of Private Rents", official, results }, null, 2) + "\n"
);
console.log("ONS borough averages:");
for (const b of boroughs.sort()) console.log(`  ${b.padEnd(11)} £${official[b].rent} (${official[b].month})`);
console.log("written scripts/data/out/rents.json");
