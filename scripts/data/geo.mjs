// Shared helpers for the data scripts: postcode lookups (with a local cache)
// and straight-line distance.

import { readFile, writeFile } from "node:fs/promises";

const CACHE = new URL("./out/postcodes-cache.json", import.meta.url);

// Returns { [postcode]: { lat, lng, lsoa } } using postcodes.io bulk lookup,
// 100 postcodes per request. Postcodes that no longer exist are skipped.
export async function lookupPostcodes(postcodes) {
  let cache = {};
  try {
    cache = JSON.parse(await readFile(CACHE, "utf8"));
  } catch {
    // no cache yet
  }

  const todo = postcodes.filter((p) => !(p in cache));
  for (let i = 0; i < todo.length; i += 100) {
    const batch = todo.slice(i, i + 100);
    const res = await fetch("https://api.postcodes.io/postcodes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postcodes: batch }),
    });
    if (!res.ok) throw new Error(`postcodes.io HTTP ${res.status}`);
    for (const { query, result } of (await res.json()).result) {
      cache[query] = result
        ? { lat: result.latitude, lng: result.longitude, lsoa: result.codes?.lsoa21 ?? result.codes?.lsoa }
        : null;
    }
    if ((i / 100) % 25 === 0) process.stdout.write(`  postcodes looked up: ${i + batch.length}/${todo.length}\n`);
  }
  if (todo.length) await writeFile(CACHE, JSON.stringify(cache));

  return Object.fromEntries(postcodes.filter((p) => cache[p]).map((p) => [p, cache[p]]));
}

// Convert WGS84 latitude/longitude to British National Grid easting/northing
// (OSGB36), using the standard Helmert transformation and Transverse Mercator
// projection (Ordnance Survey's "A guide to coordinate systems in Great Britain").
// Accurate to a few metres, which is plenty here.
export function toBNG(lat, lng) {
  const rad = Math.PI / 180;
  // WGS84 lat/lng -> cartesian
  const a1 = 6378137, b1 = 6356752.3142;
  const e2a = 1 - (b1 * b1) / (a1 * a1);
  const phi = lat * rad, lam = lng * rad;
  const nu1 = a1 / Math.sqrt(1 - e2a * Math.sin(phi) ** 2);
  const x1 = nu1 * Math.cos(phi) * Math.cos(lam);
  const y1 = nu1 * Math.cos(phi) * Math.sin(lam);
  const z1 = nu1 * (1 - e2a) * Math.sin(phi);
  // Helmert WGS84 -> OSGB36
  const tx = -446.448, ty = 125.157, tz = -542.06, s = 20.4894e-6;
  const rx = (-0.1502 / 3600) * rad, ry = (-0.247 / 3600) * rad, rz = (-0.8421 / 3600) * rad;
  const x2 = tx + (1 + s) * x1 - rz * y1 + ry * z1;
  const y2 = ty + rz * x1 + (1 + s) * y1 - rx * z1;
  const z2 = tz - ry * x1 + rx * y1 + (1 + s) * z1;
  // cartesian -> Airy 1830 lat/lng
  const a = 6377563.396, b = 6356256.909;
  const e2 = 1 - (b * b) / (a * a);
  const p = Math.sqrt(x2 * x2 + y2 * y2);
  let lat2 = Math.atan2(z2, p * (1 - e2));
  for (let i = 0; i < 10; i++) {
    const nu = a / Math.sqrt(1 - e2 * Math.sin(lat2) ** 2);
    lat2 = Math.atan2(z2 + e2 * nu * Math.sin(lat2), p);
  }
  const lng2 = Math.atan2(y2, x2);
  // Transverse Mercator (National Grid)
  const F0 = 0.9996012717, lat0 = 49 * rad, lng0 = -2 * rad, N0 = -100000, E0 = 400000;
  const n = (a - b) / (a + b);
  const sinL = Math.sin(lat2), cosL = Math.cos(lat2), tanL = Math.tan(lat2);
  const nu = (a * F0) / Math.sqrt(1 - e2 * sinL * sinL);
  const rho = (a * F0 * (1 - e2)) / Math.pow(1 - e2 * sinL * sinL, 1.5);
  const eta2 = nu / rho - 1;
  const dLat = lat2 - lat0, sLat = lat2 + lat0;
  const M =
    b * F0 *
    ((1 + n + (5 / 4) * n ** 2 + (5 / 4) * n ** 3) * dLat -
      (3 * n + 3 * n ** 2 + (21 / 8) * n ** 3) * Math.sin(dLat) * Math.cos(sLat) +
      ((15 / 8) * n ** 2 + (15 / 8) * n ** 3) * Math.sin(2 * dLat) * Math.cos(2 * sLat) -
      (35 / 24) * n ** 3 * Math.sin(3 * dLat) * Math.cos(3 * sLat));
  const I = M + N0;
  const II = (nu / 2) * sinL * cosL;
  const III = (nu / 24) * sinL * cosL ** 3 * (5 - tanL ** 2 + 9 * eta2);
  const IIIA = (nu / 720) * sinL * cosL ** 5 * (61 - 58 * tanL ** 2 + tanL ** 4);
  const IV = nu * cosL;
  const V = (nu / 6) * cosL ** 3 * (nu / rho - tanL ** 2);
  const VI = (nu / 120) * cosL ** 5 * (5 - 18 * tanL ** 2 + tanL ** 4 + 14 * eta2 - 58 * tanL ** 2 * eta2);
  const dL = lng2 - lng0;
  return {
    e: E0 + IV * dL + V * dL ** 3 + VI * dL ** 5,
    n: I + II * dL ** 2 + III * dL ** 4 + IIIA * dL ** 6,
  };
}

export function distanceKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// British National Grid easting/northing -> WGS84 latitude/longitude, by
// refining a first guess with toBNG until it lands on the same grid point
// (converges to well under a metre in a few steps).
export function fromBNG(e, n) {
  const rad = Math.PI / 180;
  let lat = 49 + (n + 100000) / 111320;
  let lng = -2 + (e - 400000) / (111320 * Math.cos(lat * rad));
  for (let i = 0; i < 8; i++) {
    const p = toBNG(lat, lng);
    lat += (n - p.n) / 111320;
    lng += (e - p.e) / (111320 * Math.cos(lat * rad));
  }
  return { lat, lng };
}
