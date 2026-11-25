// Weekday morning public transport time to the city centre (set in city.mjs),
// from one or more GTFS timetables: for Manchester the TfGM buses and trams;
// for Liverpool the Bus Open Data buses and ferries plus trains converted
// from the national rail timetable (cif-to-gtfs.mjs).
//
// Method (Connection Scan Algorithm):
//   - Services running on TRAVEL_DATE (a normal weekday).
//   - Start at the area's point at each time in DEPART_TIMES; walk up to
//     MAX_ACCESS_M to a stop; ride, change (walking up to MAX_TRANSFER_M between
//     stops, plus a TRANSFER_BUFFER_MIN minute buffer) and finally walk to
//     CITY_CENTRE.
//   - Walking: straight-line distance x WALK_DETOUR at WALK_M_PER_MIN.
//   - The commute is the AVERAGE door-to-door time over DEPART_TIMES, so it
//     includes typical waiting time, not just the fastest possible trip.
//
// Source: Transport for Greater Manchester, GM public transport schedules (GTFS).
//
// Usage: node scripts/data/commute.mjs <GTFS folder> [<GTFS folder> ...] [--city=liverpool]
// Writes scripts/data/out/commute.json

import { createReadStream } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { join } from "node:path";
import { distanceKm } from "./geo.mjs";
import { CITY, args, OUT, AREAS_FILE, PHOTOS_FILE, SETTINGS_FOR_CITY, readOut, optionalOut } from "./city.mjs";

// A normal weekday (city.mjs can set a different one if a timetable has an odd day).
const TRAVEL_DATE = SETTINGS_FOR_CITY.travelDate ?? "20261201"; // default: Tuesday 1 December 2026
const DEPART_TIMES = ["07:30", "07:45", "08:00", "08:15", "08:30"];
const CITY_CENTRE = SETTINGS_FOR_CITY.cityCentre;
const MAX_ACCESS_M = 1200;
const MAX_TRANSFER_M = 400;
const MAX_EGRESS_M = 1200;
const WALK_M_PER_MIN = 80; // about 4.8 km/h
const WALK_DETOUR = 1.25;
const TRANSFER_BUFFER_MIN = 1;
const WINDOW_END = "11:00";

const dirs = args; // one or more timetable folders, e.g. buses and trains
if (!dirs.length) throw new Error("Pass the folder(s) holding the GTFS files");

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

async function* readCsv(dir, name) {
  let header = null;
  for await (const raw of createInterface({ input: createReadStream(join(dir, name)) })) {
    const line = raw.replace(/^﻿/, "");
    if (!line) continue;
    const cells = parseCsvLine(line);
    if (!header) {
      header = cells;
      continue;
    }
    yield Object.fromEntries(header.map((h, i) => [h, cells[i]]));
  }
}

const toSec = (t) => {
  const [h, m, s = 0] = t.split(":").map(Number);
  return h * 3600 + m * 60 + s;
};
const walkSec = (metres) => ((metres * WALK_DETOUR) / WALK_M_PER_MIN) * 60;

// 1-3. Read every timetable folder (e.g. buses, then trains). IDs are
// prefixed with the folder's position so the timetables can't clash.
const weekday = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][
  new Date(`${TRAVEL_DATE.slice(0, 4)}-${TRAVEL_DATE.slice(4, 6)}-${TRAVEL_DATE.slice(6)}T12:00:00Z`).getUTCDay()
];
const startSec = toSec(DEPART_TIMES[0]);
const endSec = toSec(WINDOW_END);
const stops = [];
const stopIndex = new Map();
const connections = [];
const tripNumbers = new Map();

for (const [feed, dir] of dirs.entries()) {
  // Services running on the travel date.
  const active = new Set();
  for await (const c of readCsv(dir, "calendar.txt")) {
    if (c[weekday] === "1" && c.start_date <= TRAVEL_DATE && c.end_date >= TRAVEL_DATE) active.add(c.service_id);
  }
  for await (const d of readCsv(dir, "calendar_dates.txt")) {
    if (d.date !== TRAVEL_DATE) continue;
    if (d.exception_type === "1") active.add(d.service_id);
    if (d.exception_type === "2") active.delete(d.service_id);
  }
  const trips = new Set();
  for await (const t of readCsv(dir, "trips.txt")) if (active.has(t.service_id)) trips.add(t.trip_id);
  console.log(`${dir}: ${weekday} ${TRAVEL_DATE}: ${active.size} services, ${trips.size} trips`);

  // Stops.
  for await (const s of readCsv(dir, "stops.txt")) {
    if (!s.stop_lat) continue;
    stopIndex.set(`${feed}:${s.stop_id}`, stops.length);
    stops.push({ id: s.stop_id, lat: Number(s.stop_lat), lng: Number(s.stop_lon) });
  }

  // Connections (one per hop between consecutive stops of a trip).
  let prev = null;
  for await (const st of readCsv(dir, "stop_times.txt")) {
    if (!trips.has(st.trip_id)) {
      prev = null;
      continue;
    }
    const cur = {
      trip: `${feed}:${st.trip_id}`,
      stop: stopIndex.get(`${feed}:${st.stop_id}`),
      arr: toSec(st.arrival_time || st.departure_time),
      dep: toSec(st.departure_time || st.arrival_time),
      seq: Number(st.stop_sequence),
      pickup: st.pickup_type !== "1",
      dropoff: st.drop_off_type !== "1",
    };
    if (prev && prev.trip === cur.trip && prev.seq < cur.seq && prev.stop !== undefined && cur.stop !== undefined) {
      if (prev.dep >= startSec && prev.dep <= endSec) {
        if (!tripNumbers.has(cur.trip)) tripNumbers.set(cur.trip, tripNumbers.size);
        connections.push({
          from: prev.stop,
          to: cur.stop,
          dep: prev.dep,
          arr: cur.arr,
          trip: tripNumbers.get(cur.trip),
          pickup: prev.pickup,
          dropoff: cur.dropoff,
        });
      }
    }
    prev = cur;
  }
}
connections.sort((a, b) => a.dep - b.dep || a.arr - b.arr);
console.log(`connections ${DEPART_TIMES[0]}-${WINDOW_END}: ${connections.length}`);

// 4. Walking links between nearby stops (grid lookup).
const CELL = 0.005;
const grid = new Map();
const key = (lat, lng) => `${Math.floor(lat / CELL)},${Math.floor(lng / CELL)}`;
stops.forEach((s, i) => {
  const k = key(s.lat, s.lng);
  if (!grid.has(k)) grid.set(k, []);
  grid.get(k).push(i);
});
function stopsNear(p, metres) {
  const span = Math.ceil(metres / 1000 / 111 / CELL) + 1;
  const [gy, gx] = key(p.lat, p.lng).split(",").map(Number);
  const out = [];
  for (let y = gy - span; y <= gy + span; y++) {
    for (let x = gx - span * 2; x <= gx + span * 2; x++) {
      for (const i of grid.get(`${y},${x}`) ?? []) {
        const d = distanceKm(p, stops[i]) * 1000;
        if (d <= metres) out.push({ i, d });
      }
    }
  }
  return out;
}
const transfers = new Map();
function transfersFrom(i) {
  if (!transfers.has(i)) {
    transfers.set(
      i,
      stopsNear(stops[i], MAX_TRANSFER_M)
        .filter((t) => t.i !== i)
        .map((t) => ({ i: t.i, sec: walkSec(t.d) + TRANSFER_BUFFER_MIN * 60 }))
    );
  }
  return transfers.get(i);
}
const egress = new Map(stopsNear(CITY_CENTRE, MAX_EGRESS_M).map((t) => [t.i, walkSec(t.d)]));

// 5. Connection scan for one origin and departure time.
// Returns the door-to-door arrival time and, for that journey, the time from
// first boarding to final alighting (on-board plus any waits between vehicles).
function earliestArrival(origin, departSec) {
  const best = new Float64Array(stops.length).fill(Infinity);
  const boardedAt = new Float64Array(stops.length).fill(NaN); // first boarding time of the journey that reached the stop
  const onTrip = new Uint8Array(tripNumbers.size);
  const tripBoarded = new Float64Array(tripNumbers.size).fill(NaN);
  let arrival = departSec + walkSec(distanceKm(origin, CITY_CENTRE) * 1000); // walk all the way
  let rideSec = 0;
  const reach = (i, t, firstBoard) => {
    if (t < best[i]) {
      best[i] = t;
      boardedAt[i] = firstBoard;
    }
  };
  for (const a of stopsNear(origin, MAX_ACCESS_M)) reach(a.i, departSec + walkSec(a.d), NaN);

  let lo = 0;
  let hi = connections.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (connections[mid].dep < departSec) lo = mid + 1;
    else hi = mid;
  }
  for (let k = lo; k < connections.length; k++) {
    const c = connections[k];
    if (c.dep >= arrival) break;
    if (!onTrip[c.trip] && c.pickup && best[c.from] <= c.dep) {
      onTrip[c.trip] = 1;
      tripBoarded[c.trip] = Number.isNaN(boardedAt[c.from]) ? c.dep : boardedAt[c.from];
    }
    if (onTrip[c.trip] && c.dropoff && c.arr < best[c.to]) {
      best[c.to] = c.arr;
      boardedAt[c.to] = tripBoarded[c.trip];
      const out = egress.get(c.to);
      if (out !== undefined && c.arr + out < arrival) {
        arrival = c.arr + out;
        rideSec = c.arr - tripBoarded[c.trip];
      }
      for (const t of transfersFrom(c.to)) reach(t.i, c.arr + t.sec, tripBoarded[c.trip]);
    }
  }
  return { arrival, rideSec };
}

const results = locations.map((loc) => {
  const runs = DEPART_TIMES.map((t) => earliestArrival(loc, toSec(t)));
  const door = runs.map((r, i) => (r.arrival - toSec(DEPART_TIMES[i])) / 60);
  const ride = runs.map((r) => r.rideSec / 60);
  const avg = (v) => Math.round(v.reduce((s, x) => s + x, 0) / v.length);
  return {
    area: loc.area,
    doorToDoorMinutes: avg(door), // includes walking at both ends and waiting for the first vehicle
    onBoardMinutes: avg(ride), // first boarding to final alighting, including changes
    accessStops: stopsNear(loc, MAX_ACCESS_M).length,
  };
});

await writeFile(
  new URL("commute.json", OUT),
  JSON.stringify(
    { source: "TfGM GTFS (bus and Metrolink)", travelDate: TRAVEL_DATE, departTimes: DEPART_TIMES, cityCentre: CITY_CENTRE, results },
    null,
    2
  ) + "\n"
);
console.log(`written commute.json for ${CITY}`);
