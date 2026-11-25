// Minimal reader for ESRI Shapefiles (.shp geometry + .dbf attributes), enough
// for the Geofabrik OpenStreetMap extracts: points, lines and polygons in
// longitude/latitude, with UTF-8 attribute text. No dependencies.
//
//   for (const f of readShapefile("path/to/gis_osm_pois_free_1")) { f.props.fclass; f.points; f.parts }
//
// Each feature has: props (attributes), and either `point` [lng, lat] or
// `parts` (array of rings/lines, each an array of [lng, lat]). `bbox` is
// [minLng, minLat, maxLng, maxLat] for lines and polygons.

import { readFileSync } from "node:fs";

function readDbf(buf) {
  const count = buf.readUInt32LE(4);
  const headerLength = buf.readUInt16LE(8);
  const recordLength = buf.readUInt16LE(10);
  const fields = [];
  for (let o = 32; buf[o] !== 0x0d; o += 32) {
    fields.push({ name: buf.toString("latin1", o, o + 11).replace(/\0.*$/s, ""), length: buf[o + 16] });
  }
  const records = [];
  for (let i = 0; i < count; i++) {
    let o = headerLength + i * recordLength + 1; // skip deletion flag
    const rec = {};
    for (const f of fields) {
      rec[f.name] = buf.toString("utf8", o, o + f.length).trim();
      o += f.length;
    }
    records.push(rec);
  }
  return records;
}

export function* readShapefile(basePath) {
  const shp = readFileSync(`${basePath}.shp`);
  const props = readDbf(readFileSync(`${basePath}.dbf`));
  let o = 100;
  let i = 0;
  while (o < shp.length) {
    const contentBytes = shp.readInt32BE(o + 4) * 2;
    const c = o + 8;
    const type = shp.readInt32LE(c);
    const feature = { props: props[i] };
    if (type === 1) {
      feature.point = [shp.readDoubleLE(c + 4), shp.readDoubleLE(c + 12)];
    } else if (type === 3 || type === 5) {
      feature.bbox = [shp.readDoubleLE(c + 4), shp.readDoubleLE(c + 12), shp.readDoubleLE(c + 20), shp.readDoubleLE(c + 28)];
      const numParts = shp.readInt32LE(c + 36);
      const numPoints = shp.readInt32LE(c + 40);
      const partStarts = [];
      for (let p = 0; p < numParts; p++) partStarts.push(shp.readInt32LE(c + 44 + p * 4));
      const pts = c + 44 + numParts * 4;
      feature.parts = partStarts.map((start, p) => {
        const end = p + 1 < numParts ? partStarts[p + 1] : numPoints;
        const ring = [];
        for (let k = start; k < end; k++) ring.push([shp.readDoubleLE(pts + k * 16), shp.readDoubleLE(pts + k * 16 + 8)]);
        return ring;
      });
    }
    if (type !== 0) yield feature;
    o = c + contentBytes;
    i++;
  }
}
