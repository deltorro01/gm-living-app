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
    // Wikipedia article titles use the county, e.g. "Allerton, Merseyside"; Halton is in Cheshire.
    wikiCounties: ["Merseyside", "Cheshire"],
    // Rightmove links search the area's main postcode district, worked out from
    // nearby postcodes; these are set by hand where the area's centre point sits
    // near a boundary and the nearest district isn't the one the area is known by.
    rightmoveOutcodes: { "Georgian Quarter": "L8", Kensington: "L7", Allerton: "L18", Aigburth: "L17", Bebington: "CH63", Crosby: "L23" },
  },
  leeds: {
    // West Yorkshire, plus neighbouring counties so areas near a boundary
    // (e.g. Wetherby, Boston Spa, Ilkley, Hemsworth, Todmorden, Marsden) get
    // nearby sales.
    priceCounties: ["WEST YORKSHIRE", "NORTH YORKSHIRE", "SOUTH YORKSHIRE", "GREATER MANCHESTER", "LANCASHIRE"],
    priceDistricts: [],
    // The main commute destination (the "Leeds city centre" work location).
    cityCentre: { lat: 53.7967, lng: -1.54286, name: "Briggate" },
    // Commute times are worked out to each of these (approved, see DECISIONS.md).
    // Each point is a postcode at the spot named, looked up on postcodes.io.
    workLocations: [
      { id: "leeds", name: "Leeds city centre", lat: 53.7967, lng: -1.54286, spot: "Briggate", postcode: "LS1 6HD" },
      { id: "bradford", name: "Bradford city centre", lat: 53.79233, lng: -1.7533, spot: "Centenary Square", postcode: "BD1 1HY" },
      { id: "wakefield", name: "Wakefield city centre", lat: 53.68318, lng: -1.49839, spot: "the Bull Ring", postcode: "WF1 1HB" },
      { id: "huddersfield", name: "Huddersfield town centre", lat: 53.64842, lng: -1.78445, spot: "St George's Square", postcode: "HD1 1JB" },
      { id: "halifax", name: "Halifax town centre", lat: 53.72207, lng: -1.85636, spot: "the Piece Hall", postcode: "HX1 1RE" },
    ],
    // Tuesday 15 Dec 2026, as for Liverpool: first full week of the December
    // 2026 rail timetable. Check the Yorkshire bus timetable has a normal
    // number of trips on this day before relying on it (step 4).
    travelDate: "20261215",
    wikiCounties: ["West Yorkshire"],
    // Hand-set Rightmove postcode districts, added at step 7 where needed.
    rightmoveOutcodes: {},
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
