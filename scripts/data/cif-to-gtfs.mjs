// Convert the national rail timetable (Rail Delivery Group "timetable_full",
// CIF format) into a small GTFS-style timetable that commute.mjs can read
// alongside the bus timetables.
//
// Keeps only passenger trains that run on the city's travel date (city.mjs)
// and stop at two or more stations near the city's areas. For each train
// UID it applies the timetable rules for that date: a cancellation (STP "C")
// removes the train, otherwise an overlay ("O") replaces the permanent ("P")
// or new ("N") schedule. Bus replacement services are left out.
// Station positions come from the timetable's own station list (MSN file).
//
// Source: Rail Delivery Group timetable data via the Rail Data Marketplace.
//
// Usage: node scripts/data/cif-to-gtfs.mjs <unzipped timetable folder> <output folder> --city=liverpool
// Writes stops.txt, trips.txt, stop_times.txt, calendar.txt and
// calendar_dates.txt into the output folder.

import { createReadStream, readdirSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { join } from "node:path";
import { args, readOut, SETTINGS_FOR_CITY } from "./city.mjs";
import { fromBNG } from "./geo.mjs";

const [cifDir, outDir] = args;
if (!cifDir || !outDir) throw new Error("Usage: cif-to-gtfs.mjs <timetable folder> <output folder> --city=<city>");

const DATE = SETTINGS_FOR_CITY.travelDate ?? "20261201"; // yyyymmdd
const D6 = DATE.slice(2); // yymmdd, as in the timetable
const weekday = (new Date(`${DATE.slice(0, 4)}-${DATE.slice(4, 6)}-${DATE.slice(6)}T12:00:00Z`).getUTCDay() + 6) % 7; // Mon = 0
const file = (suffix) => join(cifDir, readdirSync(cifDir).find((f) => f.toUpperCase().endsWith(suffix)));

// Area of interest: the city's areas plus a generous margin, so trains that
// pass through neighbouring towns on the way in are kept.
const locations = await readOut("locations.json");
const MARGIN = 0.2;
const box = {
  minLat: Math.min(...locations.map((l) => l.lat)) - MARGIN,
  maxLat: Math.max(...locations.map((l) => l.lat)) + MARGIN,
  minLng: Math.min(...locations.map((l) => l.lng)) - MARGIN,
  maxLng: Math.max(...locations.map((l) => l.lng)) + MARGIN,
};

// 1. Stations: TIPLOC -> { crs, name, lat, lng } from the MSN station list.
const stations = new Map();
for (const line of readFileSync(file("MSN.TXT"), "latin1").split(/\r?\n/)) {
  if (!line.startsWith("A    ") || line.length < 63) continue;
  const tiploc = line.slice(36, 43).trim();
  const crs = line.slice(49, 52).trim();
  const e = Number(line.slice(52, 57));
  const n = Number(line.slice(58, 63));
  if (!tiploc || !crs || !e || !n) continue;
  const { lat, lng } = fromBNG((e - 10000) * 100, (n - 60000) * 100);
  stations.set(tiploc, { crs, name: line.slice(5, 35).trim(), lat, lng });
}
const inBox = (s) => s && s.lat >= box.minLat && s.lat <= box.maxLat && s.lng >= box.minLng && s.lng <= box.maxLng;
console.log(`stations with positions: ${stations.size}`);

// 2. Schedules valid on the date.
const toSec = (hhmm, half = false) => Number(hhmm.slice(0, 2)) * 3600 + Number(hhmm.slice(2, 4)) * 60 + (half ? 30 : 0);
const validOnDate = new Map(); // uid -> list of { stp, stops | null }
let current = null;

function finish() {
  if (!current) return;
  const { uid, stp, stops, bus } = current;
  if (!validOnDate.has(uid)) validOnDate.set(uid, []);
  const local = stops.filter((s) => inBox(stations.get(s.tiploc)));
  validOnDate.get(uid).push({ stp, stops: !bus && local.length >= 2 ? stops : null });
  current = null;
}

const lines = createInterface({ input: createReadStream(file("MCA.TXT"), { encoding: "latin1" }) });
for await (const line of lines) {
  const type = line.slice(0, 2);
  if (type === "BS") {
    finish();
    const from = line.slice(9, 15);
    const to = line.slice(15, 21);
    const days = line.slice(21, 28);
    const stp = line[79];
    if (line[2] !== "N" && line[2] !== "R") continue; // only new/revised records in a full extract
    if (from <= D6 && to >= D6 && (stp === "C" || days[weekday] === "1")) {
      const category = line.slice(30, 32);
      current = { uid: line.slice(3, 9), stp, stops: [], bus: category === "BR" || category === "BS" || line[29] === "B" || line[29] === "5" };
    }
    continue;
  }
  if (!current) continue;
  if (type === "LO") {
    const pub = line.slice(15, 19);
    if (pub !== "0000" || current.stops.length === 0) {
      const t = pub.trim() && pub !== "0000" ? toSec(pub) : toSec(line.slice(10, 14), line[14] === "H");
      current.stops.push({ tiploc: line.slice(2, 9).trim(), arr: t, dep: t });
    }
  } else if (type === "LI") {
    if (line.slice(20, 25).trim()) continue; // passes without stopping
    const pubArr = line.slice(25, 29);
    const pubDep = line.slice(29, 33);
    if (pubArr === "0000" && pubDep === "0000") continue; // not a public stop
    const arr = pubArr !== "0000" ? toSec(pubArr) : toSec(line.slice(10, 14), line[14] === "H");
    const dep = pubDep !== "0000" ? toSec(pubDep) : toSec(line.slice(15, 19), line[19] === "H");
    current.stops.push({ tiploc: line.slice(2, 9).trim(), arr, dep });
  } else if (type === "LT") {
    const pub = line.slice(15, 19);
    const t = pub !== "0000" ? toSec(pub) : toSec(line.slice(10, 14), line[14] === "H");
    current.stops.push({ tiploc: line.slice(2, 9).trim(), arr: t, dep: t });
    finish();
  }
}
finish();

// 3. Apply the date's rules per train: C cancels; else O, then N, then P.
const PRIORITY = { O: 3, N: 2, P: 1 };
const trains = [];
for (const [uid, list] of validOnDate) {
  if (list.some((s) => s.stp === "C")) continue;
  const best = list.sort((a, b) => (PRIORITY[b.stp] ?? 0) - (PRIORITY[a.stp] ?? 0))[0];
  if (best?.stops) trains.push({ uid, stops: best.stops });
}

// 4. Write GTFS-style files. Times past midnight continue past 24:00.
const pad = (n) => String(n).padStart(2, "0");
const hms = (s) => `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
const usedStops = new Map();
const stopTimes = ["trip_id,arrival_time,departure_time,stop_id,stop_sequence,pickup_type,drop_off_type"];
const trips = ["route_id,service_id,trip_id"];
for (const [i, t] of trains.entries()) {
  const tripId = `RAIL_${t.uid}_${i}`;
  trips.push(`RAIL,RAIL,${tripId}`);
  let dayOffset = 0;
  let last = -1;
  t.stops.forEach((s, seq) => {
    const st = stations.get(s.tiploc);
    if (!st) return;
    if (s.arr + dayOffset < last) dayOffset += 86400;
    const arr = s.arr + dayOffset;
    const dep = Math.max(arr, s.dep + dayOffset);
    last = dep;
    const stopId = `RAIL_${st.crs}`;
    usedStops.set(stopId, st);
    stopTimes.push(`${tripId},${hms(arr)},${hms(dep)},${stopId},${seq},0,0`);
  });
}
const stopsTxt = ["stop_id,stop_name,stop_lat,stop_lon"];
for (const [id, s] of usedStops) stopsTxt.push(`${id},"${s.name}",${s.lat.toFixed(6)},${s.lng.toFixed(6)}`);

await mkdir(outDir, { recursive: true });
await writeFile(join(outDir, "stops.txt"), stopsTxt.join("\n") + "\n");
await writeFile(join(outDir, "trips.txt"), trips.join("\n") + "\n");
await writeFile(join(outDir, "stop_times.txt"), stopTimes.join("\n") + "\n");
await writeFile(
  join(outDir, "calendar.txt"),
  `service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\nRAIL,1,1,1,1,1,1,1,${DATE},${DATE}\n`
);
await writeFile(join(outDir, "calendar_dates.txt"), "service_id,date,exception_type\n");
console.log(`${DATE}: ${trains.length} trains, ${usedStops.size} stations, ${stopTimes.length - 1} calls written to ${outDir}`);
