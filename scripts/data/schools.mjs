// School quality near each area, from Ofsted's state-funded schools inspections
// and outcomes data.
//
// Each primary and secondary school gets a score on a 1-5 scale from its most
// relevant inspection, in this order:
//   1. Renewed framework report card (from November 2025): the average of its
//      graded evaluation areas, Exceptional = 5, Strong standard = 4,
//      Expected standard = 3, Needs attention = 2, Urgent improvement = 1.
//   2. Older graded inspection: overall effectiveness (or quality of education
//      if there is no overall grade): Outstanding = 4.5, Good = 3.25,
//      Requires improvement = 2, Inadequate = 1.
//   3. Older ungraded inspection: "School remains Outstanding" = 4.5,
//      "School remains Good" = 3.25 (other outcomes are not used).
// Schools with none of these are left out.
//
// An area's score is the average of:
//   - primary schools within PRIMARY_KM, and
//   - secondary schools within SECONDARY_KM,
// each weighted by number of pupils. Each circle widens 1 km at a time (up to
// 4 km more) until it holds at least MIN_PRIMARY / MIN_SECONDARY schools.
//
// Source: Ofsted, State-funded schools inspections and outcomes. Open Government Licence v3.0.
//
// Usage: node scripts/data/schools.mjs <path to the Ofsted CSV>
// Writes scripts/data/out/schools.json

import { readFile, writeFile } from "node:fs/promises";
import { lookupPostcodes, distanceKm } from "./geo.mjs";
import { CITY, args, OUT, AREAS_FILE, PHOTOS_FILE, SETTINGS_FOR_CITY, readOut, optionalOut } from "./city.mjs";

const PRIMARY_KM = 2;
const SECONDARY_KM = 3;
const MIN_PRIMARY = 3; // widen the circle until at least this many
const MIN_SECONDARY = 1;

const file = args[0];
if (!file) throw new Error("Pass the path to the Ofsted CSV");

const locations = JSON.parse(await readFile(new URL("locations.json", OUT), "utf8"));

function parseCsvLine(line) {
  const cells = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if (ch === "," && !quoted) {
      cells.push(cur);
      cur = "";
    } else cur += ch;
  }
  cells.push(cur);
  return cells;
}

const [headerLine, ...lines] = (await readFile(file, "utf8")).replace(/^﻿/, "").split(/\r?\n/).filter(Boolean);
const header = parseCsvLine(headerLine);
const col = (name) => {
  const i = header.indexOf(name);
  if (i === -1) throw new Error(`column not found: ${name}`);
  return i;
};

const NEW_AREAS = [
  "Inclusion",
  "Curriculum and teaching",
  "Achievement",
  "Attendance and behaviour",
  "Personal development and wellbeing",
  "Leadership and governance",
].map(col);
const NEW_GRADE = {
  Exceptional: 5,
  "Strong standard": 4,
  "Expected standard": 3,
  "Needs attention": 2,
  "Urgent improvement": 1,
};
const OLD_GRADE = { 1: 4.5, 2: 3.25, 3: 2, 4: 1 };
const UNGRADED = (outcome) =>
  outcome === "School remains Outstanding" ? 4.5 : outcome.startsWith("School remains Good") ? 3.25 : null;

const iPhase = col("Ofsted phase");
const iRegion = col("Ofsted region");
const iPostcode = col("Postcode");
const iPupils = col("Total number of pupils");
const iName = col("School name");
const iOverall = col("Latest OEIF overall effectiveness");
const iQuality = col("Latest OEIF quality of education");
const iUngraded = col("Ungraded inspection overall outcome");

function schoolScore(r) {
  const fresh = NEW_AREAS.map((i) => NEW_GRADE[r[i]]).filter(Boolean);
  if (fresh.length) return { score: fresh.reduce((s, v) => s + v, 0) / fresh.length, basis: "report card" };
  const old = OLD_GRADE[r[iOverall]] ?? OLD_GRADE[r[iQuality]];
  if (old) return { score: old, basis: "graded inspection" };
  const ungraded = UNGRADED(r[iUngraded] ?? "");
  if (ungraded) return { score: ungraded, basis: "ungraded inspection" };
  return null;
}

const schools = [];
for (const line of lines) {
  const r = parseCsvLine(line);
  const phase = r[iPhase];
  if (phase !== "Primary" && phase !== "Secondary") continue;
  if (!r[iRegion].includes("North West")) continue;
  const s = schoolScore(r);
  if (!s) continue;
  schools.push({ name: r[iName], phase, postcode: r[iPostcode], pupils: Number(r[iPupils]) || 0, ...s });
}

const coords = await lookupPostcodes([...new Set(schools.map((s) => s.postcode))]);
const placed = schools.filter((s) => coords[s.postcode]).map((s) => ({ ...s, ...coords[s.postcode] }));
console.log(`North West primary/secondary schools with a usable grade: ${schools.length} (placed: ${placed.length})`);

function weightedAverage(list) {
  const w = list.reduce((s, x) => s + (x.pupils || 1), 0);
  return list.reduce((s, x) => s + x.score * (x.pupils || 1), 0) / w;
}

// Widen the circle (1 km at a time) until there are enough schools to judge.
function nearby(loc, phase, startKm, minCount) {
  for (let km = startKm; km <= startKm + 4; km++) {
    const list = placed.filter((s) => s.phase === phase && distanceKm(loc, s) <= km);
    if (list.length >= minCount || km === startKm + 4) return { list, km };
  }
}

const results = locations.map((loc) => {
  const p = nearby(loc, "Primary", PRIMARY_KM, MIN_PRIMARY);
  const s2 = nearby(loc, "Secondary", SECONDARY_KM, MIN_SECONDARY);
  const primary = p.list;
  const secondary = s2.list;
  const parts = [primary, secondary].filter((l) => l.length).map(weightedAverage);
  return {
    area: loc.area,
    primarySchools: primary.length,
    primaryKm: p.km,
    secondarySchools: secondary.length,
    secondaryKm: s2.km,
    reportCards: [...primary, ...secondary].filter((s) => s.basis === "report card").length,
    score: parts.length ? Math.round((parts.reduce((s, v) => s + v, 0) / parts.length) * 100) / 100 : null,
  };
});

await writeFile(
  new URL("schools.json", OUT),
  JSON.stringify({ source: "Ofsted state-funded schools inspections and outcomes", results }, null, 2) + "\n"
);
console.log(`written schools.json for ${CITY}`);
