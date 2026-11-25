// Merge the calculated figures into the area dataset.
//
//   averageHousePrice   <- median Land Registry sale price (house-prices.mjs)
//   averageRent         <- scaled to the ONS borough average (rents.mjs)
//   safety (1-5)        <- IoD 2025 crime level (safety.mjs)
//   schools (1-5)       <- Ofsted grades of nearby schools (schools.mjs)
//   greenSpace (1-5)    <- OS green space near the area (greenspace.mjs), only
//                          when out/greenspace.json has a "score" per area
//   commuteCityMinutes  <- on-board bus/tram time (commute.mjs); for areas with
//                          a train station the existing figure is kept when it
//                          is faster, as the timetable data has no trains
//   lat, lng            <- added (fetch-locations.mjs)
//   dataSources         <- added: where each calculated figure came from
//
// 1-5 ratings ("rank" method): areas are put in order by the real measure, then
// given the same spread of 1-5 ratings the dataset already has, so a 5 means
// "among the best of these 86 areas". Ties are broken by area name.
//
// No existing fields are removed or renamed; other values are unchanged.
//
// Usage:
//   node scripts/data/apply.mjs            preview only: writes scripts/data/out/areas.candidate.json
//   node scripts/data/apply.mjs --write    also overwrites src/data/manchester/areas.json
// Optional: --skip=rents,schools,commute,greenspace  leaves those fields unchanged.

import { readFile, writeFile } from "node:fs/promises";
import { CITY, args, OUT, AREAS_FILE, PHOTOS_FILE, SETTINGS_FOR_CITY, readOut, optionalOut } from "./city.mjs";

const write = process.argv.includes("--write");
const skip = new Set((process.argv.find((a) => a.startsWith("--skip=")) ?? "--skip=").slice(7).split(",").filter(Boolean));

const read = async (p) => JSON.parse(await readFile(new URL(p, import.meta.url), "utf8"));
const optional = async (p) => {
  try {
    return await read(p);
  } catch {
    return null;
  }
};
const areasFile = AREAS_FILE;
const areas = JSON.parse(await readFile(areasFile, "utf8"));

const byArea = (list) => Object.fromEntries(list.map((x) => [x.area, x]));
const loc = byArea(await readOut("locations.json"));
const prices = await readOut("house-prices.json");
const price = byArea(prices.results);
const crime = byArea((await readOut("safety.json")).results);
const rentsFile = skip.has("rents") ? null : await optionalOut("rents.json");
const schoolsFile = skip.has("schools") ? null : await optionalOut("schools.json");
const commuteFile = skip.has("commute") ? null : await optionalOut("commute.json");
const greenFile = skip.has("greenspace") ? null : await optionalOut("greenspace.json");
const rent = rentsFile && byArea(rentsFile.results);
const school = schoolsFile && byArea(schoolsFile.results);
const commute = commuteFile && byArea(commuteFile.results);
const green = greenFile?.results?.every((r) => typeof r.score === "number") ? byArea(greenFile.results) : null;

// Same spread of 1-5 ratings as `field` has today, assigned in order of `measure` (higher = better).
function rankRatings(field, measure) {
  const spread = areas.map((a) => a[field]).sort((x, y) => x - y);
  const ordered = [...areas].sort((a, b) => measure(a.area) - measure(b.area) || a.area.localeCompare(b.area));
  return Object.fromEntries(ordered.map((a, i) => [a.area, spread[i]]));
}

const safetyRating = rankRatings("safety", (n) => crime[n].crimeDecile);
const schoolRating = school && rankRatings("schools", (n) => school[n].score);
const greenRating = green && rankRatings("greenSpace", (n) => green[n].score);

const updated = areas.map((a) => {
  const p = price[a.area];
  const c = crime[a.area];
  const l = loc[a.area];
  if (!p || !c || !l) throw new Error(`missing data for ${a.area}`);
  const out = {
    ...a,
    averageHousePrice: p.medianPrice,
    safety: safetyRating[a.area],
    lat: l.lat,
    lng: l.lng,
    dataSources: {
      ...(a.dataSources ?? {}),
      averageHousePrice: `Median of ${p.sales} HM Land Registry sales within ${p.radiusKm} km, ${prices.period}`,
      safety: `English Indices of Deprivation 2025 crime domain, average national decile ${c.crimeDecile} (ranked against the other areas)`,
    },
  };

  if (rent) {
    const r = rent[a.area];
    out.averageRent = r.rent;
    out.dataSources.averageRent = `Scaled so the ${a.borough} areas average the ONS borough rent of £${r.boroughOfficial} (${r.month}); differences between areas are estimates`;
  }
  if (school) {
    const s = school[a.area];
    out.schools = schoolRating[a.area];
    out.dataSources.schools = `Ofsted grades of ${s.primarySchools} primary schools within ${s.primaryKm} km and ${s.secondarySchools} secondary schools within ${s.secondaryKm} km, average score ${s.score} of 5 (ranked against the other areas)`;
  }
  if (green) {
    const g = green[a.area];
    out.greenSpace = greenRating[a.area];
    out.dataSources.greenSpace = g.note;
  }
  if (commute) {
    const m = commute[a.area];
    const calculated = m.onBoardMinutes;
    const keepTrain = a.train && a.commuteCityMinutes < calculated;
    out.commuteCityMinutes = keepTrain ? a.commuteCityMinutes : calculated;
    out.dataSources.commuteCityMinutes = keepTrain
      ? `Train estimate (not recalculated); bus/tram on board ${calculated} min, door to door ${m.doorToDoorMinutes} min`
      : `TfGM timetable, weekday 07:30-08:30, average time on board bus/tram ${calculated} min (door to door ${m.doorToDoorMinutes} min)`;
  }
  return out;
});

// Keep the file's existing style: 2-space JSON, Windows line endings, no final newline.
const text = JSON.stringify(updated, null, 2).replace(/\n/g, "\r\n");
await writeFile(new URL("areas.candidate.json", OUT), text);
if (write) await writeFile(areasFile, text);
const used = ["prices", "safety", rent && "rents", school && "schools", commute && "commute", green && "greenspace"].filter(Boolean);
console.log(`applied: ${used.join(", ")}${write ? " (written to src/data/manchester/areas.json)" : " (preview only)"}`);
