// Green space around each area from Ordnance Survey Open Greenspace.
//
// Measures the share of land within RADIUS_M of each area's point that is
// covered by an OS Open Greenspace site (parks, playing fields, play spaces,
// allotments, cemeteries, religious grounds, golf courses, sports facilities).
// The circle is sampled on a SAMPLE_M grid; each sample point is checked
// against the green space polygons.
//
// Note: OS Open Greenspace maps green spaces in and around towns. Open
// countryside (fields, moorland) is not included, so rural areas can score
// lower than they feel.
//
// Contains OS data © Crown copyright and database right 2026.
// Licensed under the Open Government Licence v3.0.
//
// Usage: node scripts/data/greenspace.mjs <path to opgrsp_gb.gpkg>
// (Needs Node 22.5 or later for the built-in node:sqlite module.)
// Writes scripts/data/out/greenspace.json

import { DatabaseSync } from "node:sqlite";
import { readFile, writeFile } from "node:fs/promises";
import { toBNG } from "./geo.mjs";

const RADIUS_M = 1000;
const SAMPLE_M = 20;
const PARK_TYPES = new Set(["Public Park Or Garden", "Playing Field", "Play Space"]);

const file = process.argv[2];
if (!file) throw new Error("Pass the path to opgrsp_gb.gpkg");

const locations = JSON.parse(await readFile(new URL("./out/locations.json", import.meta.url), "utf8"));
const db = new DatabaseSync(file, { readOnly: true });

// --- GeoPackage geometry -> list of polygons (each a list of rings of [x, y]) ---
function parseGpkg(buf) {
  if (buf[0] !== 0x47 || buf[1] !== 0x50) throw new Error("not a GeoPackage geometry");
  const flags = buf[3];
  const envelopeBytes = [0, 32, 48, 48, 64][(flags >> 1) & 0b111];
  return parseWkb(buf, 8 + envelopeBytes).value;
}

function parseWkb(buf, offset) {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const le = buf[offset] === 1;
  const type = view.getUint32(offset + 1, le) % 1000;
  let o = offset + 5;
  const u32 = () => {
    const v = view.getUint32(o, le);
    o += 4;
    return v;
  };
  const f64 = () => {
    const v = view.getFloat64(o, le);
    o += 8;
    return v;
  };
  const polygon = () => {
    const rings = [];
    for (let r = 0, nr = u32(); r < nr; r++) {
      const ring = [];
      for (let p = 0, np = u32(); p < np; p++) ring.push([f64(), f64()]);
      rings.push(ring);
    }
    return rings;
  };
  if (type === 3) return { value: [polygon()], end: o };
  if (type === 6) {
    const polys = [];
    for (let i = 0, n = u32(); i < n; i++) {
      const sub = parseWkb(buf, o);
      polys.push(...sub.value);
      o = sub.end;
    }
    return { value: polys, end: o };
  }
  throw new Error(`unexpected geometry type ${type}`);
}

// Even-odd rule over all rings (outer + holes) of one polygon.
function inside(x, y, rings) {
  let hit = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
    }
  }
  return hit;
}

const query = db.prepare(`
  SELECT g.function AS fn, g.geometry AS geom
  FROM greenspace_site g
  JOIN rtree_greenspace_site_geometry r ON g.fid = r.id
  WHERE r.maxx >= ? AND r.minx <= ? AND r.maxy >= ? AND r.miny <= ?
`);

const results = locations.map((loc) => {
  const { e, n } = toBNG(loc.lat, loc.lng);
  const sites = query
    .all(e - RADIUS_M, e + RADIUS_M, n - RADIUS_M, n + RADIUS_M)
    .map((row) => ({ fn: row.fn, polys: parseGpkg(row.geom) }));

  let samples = 0;
  let green = 0;
  let park = 0;
  for (let dx = -RADIUS_M; dx <= RADIUS_M; dx += SAMPLE_M) {
    for (let dy = -RADIUS_M; dy <= RADIUS_M; dy += SAMPLE_M) {
      if (dx * dx + dy * dy > RADIUS_M * RADIUS_M) continue;
      samples++;
      const x = e + dx;
      const y = n + dy;
      const hit = sites.find((s) => s.polys.some((rings) => inside(x, y, rings)));
      if (hit) {
        green++;
        if (PARK_TYPES.has(hit.fn)) park++;
      }
    }
  }
  return {
    area: loc.area,
    sites: sites.length,
    greenShare: Math.round((green / samples) * 1000) / 10, // % of the 1 km circle
    parkShare: Math.round((park / samples) * 1000) / 10, // parks, playing fields and play spaces only
  };
});

await writeFile(
  new URL("./out/greenspace.json", import.meta.url),
  JSON.stringify({ source: "OS Open Greenspace", radiusM: RADIUS_M, results }, null, 2) + "\n"
);
console.log("written scripts/data/out/greenspace.json");
