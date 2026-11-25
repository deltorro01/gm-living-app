// Which city a data script works on, and that city's data settings.
//
//   node scripts/data/<script>.mjs [folder or file] --city=liverpool
//
// Without --city the scripts work on Manchester, exactly as before.
// Manchester's working files stay in scripts/data/out/; other cities use
// scripts/data/out/<city>/. The postcode cache is shared by all cities.

import { readFile } from "node:fs/promises";

const flag = process.argv.find((a) => a.startsWith("--city="));
export const CITY = flag ? flag.slice("--city=".length) : "manchester";

// Arguments that aren't --flags (e.g. the downloads folder), in order.
export const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));

export const OUT = new URL(CITY === "manchester" ? "./out/" : `./out/${CITY}/`, import.meta.url);
export const AREAS_FILE = new URL(`../../src/data/${CITY}/areas.json`, import.meta.url);
export const PHOTOS_FILE = new URL(`../../src/data/${CITY}/areaPhotos.json`, import.meta.url);

const SETTINGS = {
  manchester: {
    // Land Registry: sales in these counties, plus these districts (Whitworth is in Rossendale).
    priceCounties: ["GREATER MANCHESTER"],
    priceDistricts: ["ROSSENDALE"],
    // Commute destination.
    cityCentre: { lat: 53.4808, lng: -2.2384, name: "Piccadilly Gardens / Market Street" },
  },
  liverpool: {
    // The City Region (Merseyside + Halton), plus neighbouring counties so
    // areas near a boundary (e.g. Billinge, Heswall, Ainsdale) get nearby sales.
    priceCounties: ["MERSEYSIDE", "HALTON", "GREATER MANCHESTER", "LANCASHIRE", "CHESHIRE WEST AND CHESTER", "WARRINGTON"],
    priceDistricts: [],
    cityCentre: { lat: 53.4048, lng: -2.9847, name: "Church Street / Liverpool ONE" },
    // Tuesday 15 Dec 2026: first full week of the December 2026 rail timetable, and a
    // normal bus day (Bus Open Data has very few trips on 1 Dec, a data quirk).
    travelDate: "20261215",
  },
};

export const SETTINGS_FOR_CITY = SETTINGS[CITY];
if (!SETTINGS_FOR_CITY) throw new Error(`No data settings for city "${CITY}" in scripts/data/city.mjs`);

// Read a JSON working file from this city's out folder (optionalOut returns null if missing).
export async function readOut(name) {
  return JSON.parse(await readFile(new URL(name, OUT), "utf8"));
}
export async function optionalOut(name) {
  try {
    return await readOut(name);
  } catch {
    return null;
  }
}
