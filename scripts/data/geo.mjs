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

export function distanceKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
