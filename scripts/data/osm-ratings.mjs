// Lifestyle measures for each area from OpenStreetMap (via the Overpass API).
//
// For each area's map point it records, within RADIUS_M (about a mile) unless noted:
//   nightlife   bars, pubs and nightclubs
//   cafes       cafés
//   culture     museums, galleries, theatres, cinemas, arts centres, libraries
//   busyness    shops + other amenities, and km of main roads (for "quietness")
//   greenShare  % of land that is green: parks, playing fields, woods, fields,
//               meadows, heath, golf courses, nature reserves, beaches.
//               Countryside counts, not just parks.
//   cycleKm     km of cycle paths and cycle lanes within CYCLE_RADIUS_M
//   motorwayKm  straight-line km to the nearest motorway junction
//   station     whether there is a railway station within STATION_RADIUS_M
//
// These are raw measures; apply.mjs turns them into 1-5 ratings.
// Map data © OpenStreetMap contributors, available under the Open Database Licence.
//
// Usage: node scripts/data/osm-ratings.mjs --city=liverpool
// Writes osm-ratings.json in the city's out folder. Queries are sent slowly,
// one at a time, as the public Overpass service asks.

import { writeFile } from "node:fs/promises";
import { CITY, OUT, readOut } from "./city.mjs";
import { distanceKm, toBNG } from "./geo.mjs";

const RADIUS_M = 1000;
const CYCLE_RADIUS_M = 1500;
const STATION_RADIUS_M = 1200;
const JUNCTION_SEARCH_M = 20000;
const PAUSE_MS = 2500;
const ENDPOINT = "https://overpass-api.de/api/interpreter";
const HEADERS = { "User-Agent": "area-guide-data-script/1.0 (Node.js; small batch)", "Content-Type": "application/x-www-form-urlencoded" };

const locations = await readOut("locations.json");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function overpass(query) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    await sleep(PAUSE_MS);
    const res = await fetch(ENDPOINT, { method: "POST", headers: HEADERS, body: "data=" + encodeURIComponent(query) });
    if (res.ok) return res.json();
    console.log(`  Overpass busy (${res.status}), waiting ${30 * attempt}s`);
    await sleep(30000 * attempt);
  }
  throw new Error("Overpass did not respond; run again later");
}

const GREEN =
  'way(around:R,LAT,LNG)[leisure~"^(park|garden|playground|pitch|recreation_ground|common|nature_reserve|golf_course)$"];' +
  'way(around:R,LAT,LNG)[landuse~"^(grass|meadow|forest|farmland|recreation_ground|village_green|cemetery|allotments|orchard)$"];' +
  'way(around:R,LAT,LNG)[natural~"^(wood|scrub|heath|grassland|wetland|beach|sand)$"];' +
  'relation(around:R,LAT,LNG)[leisure~"^(park|nature_reserve|golf_course|common)$"];' +
  'relation(around:R,LAT,LNG)[landuse~"^(grass|meadow|forest|farmland|recreation_ground)$"];' +
  'relation(around:R,LAT,LNG)[natural~"^(wood|scrub|heath|grassland|wetland|beach)$"];';

function buildQuery({ lat, lng }) {
  const sub = (s, r = RADIUS_M) => s.replaceAll("R", r).replaceAll("LAT", lat).replaceAll("LNG", lng);
  return `[out:json][timeout:120];
${sub('nwr(around:R,LAT,LNG)[amenity~"^(bar|pub|nightclub)$"];')}out count;
${sub('nwr(around:R,LAT,LNG)[amenity=cafe];')}out count;
(${sub('nwr(around:R,LAT,LNG)[tourism~"^(museum|gallery)$"];nwr(around:R,LAT,LNG)[amenity~"^(theatre|cinema|arts_centre|library)$"];')});out count;
(${sub("nwr(around:R,LAT,LNG)[shop];nwr(around:R,LAT,LNG)[amenity];")});out count;
${sub('way(around:R,LAT,LNG)[highway~"^(motorway|trunk|primary)$"];')}out geom;
(${sub('way(around:R,LAT,LNG)[highway=cycleway];way(around:R,LAT,LNG)[~"^cycleway(:both|:left|:right)?$"~"^(lane|track)$"];', CYCLE_RADIUS_M)});out geom;
${sub("node(around:R,LAT,LNG)[highway=motorway_junction];", JUNCTION_SEARCH_M)}out;
${sub("node(around:R,LAT,LNG)[railway=station];", STATION_RADIUS_M)}out;
(${sub(GREEN)});out geom;`;
}

// Length (km) of the parts of ways whose segment midpoints lie within radiusM.
function lengthKmWithin(ways, centre, radiusM) {
  let km = 0;
  for (const w of ways) {
    const g = w.geometry ?? [];
    for (let i = 1; i < g.length; i++) {
      const a = { lat: g[i - 1].lat, lng: g[i - 1].lon };
      const b = { lat: g[i].lat, lng: g[i].lon };
      const mid = { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
      if (distanceKm(centre, mid) * 1000 <= radiusM) km += distanceKm(a, b);
    }
  }
  return Math.round(km * 10) / 10;
}

// Green polygons as rings in metres (British National Grid), for point tests.
function greenRings(elements) {
  const rings = [];
  const toXY = (pts) => pts.map((p) => toBNG(p.lat, p.lon)).map(({ e, n }) => [e, n]);
  for (const el of elements) {
    if (el.type === "way" && el.geometry?.length > 3) rings.push(toXY(el.geometry));
    if (el.type === "relation") {
      for (const m of el.members ?? []) if (m.role === "outer" && m.geometry?.length > 3) rings.push(toXY(m.geometry));
    }
  }
  return rings;
}

function inside(x, y, ring) {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

function greenShare(rings, centre) {
  const { e, n } = toBNG(centre.lat, centre.lng);
  const STEP = 40;
  let samples = 0;
  let green = 0;
  for (let dx = -RADIUS_M; dx <= RADIUS_M; dx += STEP) {
    for (let dy = -RADIUS_M; dy <= RADIUS_M; dy += STEP) {
      if (dx * dx + dy * dy > RADIUS_M * RADIUS_M) continue;
      samples++;
      if (rings.some((r) => inside(e + dx, n + dy, r))) green++;
    }
  }
  return Math.round((green / samples) * 1000) / 10;
}

const results = [];
for (const [i, loc] of locations.entries()) {
  const data = await overpass(buildQuery(loc));
  const els = data.elements;
  // Output order: 4 counts, then main roads, cycleways, junctions, stations, green.
  const counts = els.filter((e) => e.type === "count").map((e) => Number(e.tags.total));
  const rest = els.filter((e) => e.type !== "count");
  const mainRoads = rest.filter((e) => e.type === "way" && /^(motorway|trunk|primary)$/.test(e.tags?.highway ?? ""));
  const cycleWays = rest.filter((e) => e.type === "way" && (e.tags?.highway === "cycleway" || Object.keys(e.tags ?? {}).some((k) => k.startsWith("cycleway"))));
  const junctions = rest.filter((e) => e.type === "node" && e.tags?.highway === "motorway_junction");
  const stations = rest.filter((e) => e.type === "node" && e.tags?.railway === "station");
  const greens = rest.filter((e) => !mainRoads.includes(e) && !cycleWays.includes(e) && !junctions.includes(e) && !stations.includes(e));

  results.push({
    area: loc.area,
    nightlife: counts[0],
    cafes: counts[1],
    culture: counts[2],
    amenities: counts[3],
    mainRoadKm: lengthKmWithin(mainRoads, loc, RADIUS_M),
    cycleKm: lengthKmWithin(cycleWays, loc, CYCLE_RADIUS_M),
    motorwayKm: junctions.length ? Math.round(Math.min(...junctions.map((j) => distanceKm(loc, { lat: j.lat, lng: j.lon }))) * 10) / 10 : null,
    station: stations.length > 0,
    stationNames: [...new Set(stations.map((s) => s.tags?.name).filter(Boolean))],
    greenShare: greenShare(greenRings(greens), loc),
  });
  console.log(`${i + 1}/${locations.length} ${loc.area}`);
}

await writeFile(new URL("osm-ratings.json", OUT), JSON.stringify({ source: "OpenStreetMap via Overpass", results }, null, 2) + "\n");
console.log(`written osm-ratings.json for ${CITY}`);
