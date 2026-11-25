// Lifestyle measures for each area from OpenStreetMap, using downloaded
// Geofabrik "free" Shapefile extracts (no online queries).
//
// For each area's map point it records, within RADIUS_M (about a mile) unless noted:
//   nightlife   bars, pubs and nightclubs
//   cafes       cafés
//   culture     museums, theatres, cinemas, arts centres, libraries
//   amenities   all shops and amenities (how busy the area is, for "quietness")
//   mainRoadKm  km of motorway, trunk and primary roads (also for "quietness")
//   greenShare  % of land that is green: parks, playing fields, woods, fields,
//               grass, meadows, heath, scrub, allotments, cemeteries, golf
//               courses, nature reserves and beaches. Countryside counts.
//   cycleKm     km of cycle paths within CYCLE_RADIUS_M
//   motorwayKm  straight-line km to the nearest motorway junction
//   station     a railway station within STATION_RADIUS_M (and its name)
//
// These are raw measures; apply.mjs turns them into 1-5 ratings.
// Map data © OpenStreetMap contributors, Open Database Licence; extracts by Geofabrik.
//
// Usage: node scripts/data/osm-ratings.mjs <extract folder> [<extract folder> ...] --city=liverpool
//   Each folder is an unzipped Geofabrik *-latest-free.shp.zip
//   (e.g. merseyside and cheshire for Liverpool City Region).
// Writes osm-ratings.json in the city's out folder.

import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { CITY, OUT, args, readOut } from "./city.mjs";
import { distanceKm, toBNG } from "./geo.mjs";
import { readShapefile } from "./shapefile.mjs";

const RADIUS_M = 1000;
const CYCLE_RADIUS_M = 1500;
const STATION_RADIUS_M = 1600; // about a mile

const NIGHTLIFE = new Set(["pub", "bar", "nightclub"]);
const CULTURE = new Set(["museum", "theatre", "cinema", "arts_centre", "library"]);
const GREEN_LANDUSE = new Set(["grass", "forest", "scrub", "farmland", "park", "meadow", "heath", "recreation_ground", "allotments", "nature_reserve", "cemetery", "orchard", "vineyard"]);
const GREEN_POIS_A = new Set(["park", "pitch", "playground", "golf_course", "garden", "nature_reserve", "dog_park"]);
const GREEN_NATURAL = new Set(["beach", "heath", "scrub", "wood", "grassland", "wetland"]);

if (!args.length) throw new Error("Pass one or more unzipped Geofabrik extract folders");
const locations = await readOut("locations.json");

// Area of interest: all area points plus a margin, to skip far-away features.
const margin = 0.06;
const box = [
  Math.min(...locations.map((l) => l.lng)) - margin,
  Math.min(...locations.map((l) => l.lat)) - margin,
  Math.max(...locations.map((l) => l.lng)) + margin,
  Math.max(...locations.map((l) => l.lat)) + margin,
];
const near = ([lng, lat]) => lng >= box[0] && lng <= box[2] && lat >= box[1] && lat <= box[3];
const bboxNear = (b) => b[2] >= box[0] && b[0] <= box[2] && b[3] >= box[1] && b[1] <= box[3];
const centroid = (ring) => [ring.reduce((s, p) => s + p[0], 0) / ring.length, ring.reduce((s, p) => s + p[1], 0) / ring.length];

// Collect what we need from every extract (features on a boundary can appear
// in two extracts; OpenStreetMap ids are used to count each only once).
const pois = new Map(); // osm_id -> { kind, lng, lat }
const greens = []; // { bbox, rings in metres }
const mainRoads = [];
const cycleways = [];
const junctions = [];
const stations = new Map();
const seenGreen = new Set();
const seenLine = new Set();

const ringsToMetres = (parts) => parts.map((r) => r.map(([lng, lat]) => toBNG(lat, lng)).map(({ e, n }) => [e, n]));

for (const dir of args) {
  const layer = (name) => readShapefile(join(dir, name));
  for (const f of layer("gis_osm_pois_free_1")) {
    if (near(f.point)) pois.set(f.props.osm_id, { kind: f.props.fclass, lng: f.point[0], lat: f.point[1] });
  }
  for (const f of layer("gis_osm_pois_a_free_1")) {
    if (!bboxNear(f.bbox)) continue;
    const [lng, lat] = centroid(f.parts[0]);
    pois.set(f.props.osm_id, { kind: f.props.fclass, lng, lat });
    if (GREEN_POIS_A.has(f.props.fclass) && !seenGreen.has(f.props.osm_id)) {
      seenGreen.add(f.props.osm_id);
      greens.push({ bbox: f.bbox, rings: ringsToMetres(f.parts) });
    }
  }
  for (const name of ["gis_osm_landuse_a_free_1", "gis_osm_natural_a_free_1"]) {
    const wanted = name.includes("landuse") ? GREEN_LANDUSE : GREEN_NATURAL;
    for (const f of layer(name)) {
      if (!wanted.has(f.props.fclass) || !bboxNear(f.bbox) || seenGreen.has(f.props.osm_id)) continue;
      seenGreen.add(f.props.osm_id);
      greens.push({ bbox: f.bbox, rings: ringsToMetres(f.parts) });
    }
  }
  for (const f of layer("gis_osm_roads_free_1")) {
    if (!bboxNear(f.bbox) || seenLine.has(f.props.osm_id)) continue;
    const c = f.props.fclass;
    if (c === "motorway" || c === "trunk" || c === "primary") (seenLine.add(f.props.osm_id), mainRoads.push(f.parts));
    else if (c === "cycleway") (seenLine.add(f.props.osm_id), cycleways.push(f.parts));
  }
  for (const f of layer("gis_osm_traffic_free_1")) {
    if (f.props.fclass === "motorway_junction") junctions.push({ lng: f.point[0], lat: f.point[1] });
  }
  for (const f of layer("gis_osm_transport_free_1")) {
    if (f.props.fclass === "railway_station" && near(f.point)) stations.set(f.props.osm_id, { name: f.props.name, lng: f.point[0], lat: f.point[1] });
  }
}
console.log(`loaded: ${pois.size} places, ${greens.length} green areas, ${mainRoads.length} main roads, ${cycleways.length} cycleways, ${junctions.length} motorway junctions, ${stations.size} stations`);

const P = (lng, lat) => ({ lat, lng });

function lengthKmWithin(lines, centre, radiusM) {
  let km = 0;
  for (const parts of lines) {
    for (const line of parts) {
      for (let i = 1; i < line.length; i++) {
        const a = P(...line[i - 1]);
        const b = P(...line[i]);
        if (distanceKm(centre, P((line[i - 1][0] + line[i][0]) / 2, (line[i - 1][1] + line[i][1]) / 2)) * 1000 <= radiusM) km += distanceKm(a, b);
      }
    }
  }
  return Math.round(km * 10) / 10;
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

function greenShare(centre) {
  const { e, n } = toBNG(centre.lat, centre.lng);
  // Only polygons whose bounding box overlaps the circle.
  const dLat = RADIUS_M / 111000;
  const dLng = RADIUS_M / (111000 * Math.cos((centre.lat * Math.PI) / 180));
  const candidates = greens.filter(
    (g) => g.bbox[2] >= centre.lng - dLng && g.bbox[0] <= centre.lng + dLng && g.bbox[3] >= centre.lat - dLat && g.bbox[1] <= centre.lat + dLat
  );
  const STEP = 40;
  let samples = 0;
  let green = 0;
  for (let dx = -RADIUS_M; dx <= RADIUS_M; dx += STEP) {
    for (let dy = -RADIUS_M; dy <= RADIUS_M; dy += STEP) {
      if (dx * dx + dy * dy > RADIUS_M * RADIUS_M) continue;
      samples++;
      // A polygon's first ring is its outline; any later rings are holes.
      if (candidates.some((g) => g.rings.reduce((hit, ring) => hit !== inside(e + dx, n + dy, ring), false))) green++;
    }
  }
  return Math.round((green / samples) * 1000) / 10;
}

const results = locations.map((loc) => {
  const within = (m) => [...pois.values()].filter((p) => distanceKm(loc, p) * 1000 <= m);
  const local = within(RADIUS_M);
  const nearStations = [...stations.values()].filter((s) => distanceKm(loc, s) * 1000 <= STATION_RADIUS_M);
  return {
    area: loc.area,
    nightlife: local.filter((p) => NIGHTLIFE.has(p.kind)).length,
    cafes: local.filter((p) => p.kind === "cafe").length,
    culture: local.filter((p) => CULTURE.has(p.kind)).length,
    amenities: local.length,
    mainRoadKm: lengthKmWithin(mainRoads, loc, RADIUS_M),
    cycleKm: lengthKmWithin(cycleways, loc, CYCLE_RADIUS_M),
    motorwayKm: junctions.length ? Math.round(Math.min(...junctions.map((j) => distanceKm(loc, j))) * 10) / 10 : null,
    station: nearStations.length > 0,
    stationNames: [...new Set(nearStations.map((s) => s.name).filter(Boolean))],
    greenShare: greenShare(loc),
  };
});

await writeFile(
  new URL("osm-ratings.json", OUT),
  JSON.stringify({ source: "OpenStreetMap (Geofabrik extracts)", radiusM: RADIUS_M, results }, null, 2) + "\n"
);
console.log(`written osm-ratings.json for ${CITY}`);
