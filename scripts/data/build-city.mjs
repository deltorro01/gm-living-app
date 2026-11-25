// Build a new city's area dataset (src/data/<city>/areas.json) from the
// calculated measures, in the same format as Manchester's.
//
// Figures used as calculated:
//   averageHousePrice   house-prices.json (median sale price)
//   averageRent         rents.json (ONS borough level, modelled per area)
//   commuteCityMinutes  commute.json (time on board bus/train/ferry)
//   train               osm-ratings.json (a station within about a mile)
//   tram                false unless the city has trams (Liverpool doesn't)
//
// 1-5 ratings: areas are put in order by the measure, then given the same
// spread of ratings that Manchester has for that field, so a rating means
// about the same in both cities. Measures:
//   safety      crime decile (IoD 2025)           schools     Ofsted score
//   nightlife   bars, pubs, clubs (OSM)            cafes       cafés (OSM)
//   culture     museums, theatres etc. (OSM)       greenSpace  % green land (OSM)
//   quietness   fewest amenities + main roads      cycling     km of cycle paths
//   driving     nearest motorway junction          value       quality for the price
//   apartments / terraces / semis / detached: share of sales by type of home
//
// Usage: node scripts/data/build-city.mjs --city=liverpool
// (Run the other scripts first; this one only combines their results.)

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { CITY, AREAS_FILE, SETTINGS_FOR_CITY, readOut } from "./city.mjs";
import { distanceKm } from "./geo.mjs";

if (CITY === "manchester") throw new Error("Manchester's dataset is maintained with apply.mjs, not built from scratch");

const reference = JSON.parse(await readFile(new URL("../../src/data/manchester/areas.json", import.meta.url), "utf8"));
const locations = await readOut("locations.json");
const byArea = (r) => Object.fromEntries(r.results.map((x) => [x.area, x]));
const prices = await readOut("house-prices.json");
const price = byArea(prices);
const rentFile = await readOut("rents.json");
const rent = byArea(rentFile);
const commute = byArea(await readOut("commute.json"));
const safety = byArea(await readOut("safety.json"));
const schools = byArea(await readOut("schools.json"));
const osm = byArea(await readOut("osm-ratings.json"));

const names = locations.map((l) => l.area);

// Same spread of 1-5 values as Manchester's `field`, assigned in order of
// `measure` (higher = better rating). Ties broken by area name.
function ratings(field, measure) {
  const spread = reference.map((a) => a[field]).sort((x, y) => x - y);
  const pick = (i) => spread[Math.round((i * (spread.length - 1)) / (names.length - 1))];
  const ordered = [...names].sort((a, b) => measure(a) - measure(b) || a.localeCompare(b));
  return Object.fromEntries(ordered.map((name, i) => [name, pick(i)]));
}

// Rank position 0..1 within the city (for combining measures).
function rankShare(measure) {
  const sorted = [...names].sort((a, b) => measure(a) - measure(b));
  return (name) => sorted.indexOf(name) / (names.length - 1);
}

const amenityRank = rankShare((n) => osm[n].amenities);
const roadRank = rankShare((n) => osm[n].mainRoadKm);
const quietMeasure = (n) => -(amenityRank(n) + roadRank(n));

// Value for money: how an area does on safety, schools, green space and
// commute, compared with how expensive it is (higher = better value).
const r = {
  safety: rankShare((n) => safety[n].crimeDecile),
  schools: rankShare((n) => schools[n].score),
  green: rankShare((n) => osm[n].greenShare),
  commute: rankShare((n) => -commute[n].doorToDoorMinutes),
  price: rankShare((n) => price[n].medianPrice),
};
const valueMeasure = (n) => (r.safety(n) + r.schools(n) + r.green(n) + r.commute(n)) / 4 - r.price(n);

const R = {
  safety: ratings("safety", (n) => safety[n].crimeDecile),
  schools: ratings("schools", (n) => schools[n].score),
  nightlife: ratings("nightlife", (n) => osm[n].nightlife),
  cafes: ratings("cafes", (n) => osm[n].cafes),
  culture: ratings("culture", (n) => osm[n].culture),
  greenSpace: ratings("greenSpace", (n) => osm[n].greenShare),
  quietness: ratings("quietness", quietMeasure),
  cycling: ratings("cycling", (n) => osm[n].cycleKm),
  driving: ratings("driving", (n) => -(osm[n].motorwayKm ?? 99)),
  value: ratings("value", valueMeasure),
  apartments: ratings("apartments", (n) => price[n].typeShare.flat),
  terraces: ratings("terraces", (n) => price[n].typeShare.terraced),
  semis: ratings("semis", (n) => price[n].typeShare.semi),
  detached: ratings("detached", (n) => price[n].typeShare.detached),
};

// Rightmove search links by postcode district (e.g. L7): the district most
// common among known postcodes within 600 m of the area's centre, unless set by
// hand in city.mjs. Place names alone can open the wrong town (Kensington → London).
const postcodes = Object.entries(JSON.parse(await readFile(new URL("out/postcodes-cache.json", import.meta.url), "utf8"))).filter(
  ([, v]) => v?.lat
);
function outcode(l) {
  const fixed = SETTINGS_FOR_CITY.rightmoveOutcodes?.[l.area];
  if (fixed) return fixed;
  const count = {};
  for (const [pc, v] of postcodes) if (distanceKm(l, v) < 0.6) count[pc.split(" ")[0]] = (count[pc.split(" ")[0]] ?? 0) + 1;
  const best = Object.entries(count).sort((a, b) => b[1] - a[1])[0];
  if (!best) throw new Error(`No postcodes near ${l.area}; set its district in city.mjs rightmoveOutcodes`);
  return best[0];
}
const rightmove = (kind, l) => `https://www.rightmove.co.uk/property-${kind}/${outcode(l)}.html`;

const areas = locations.map((l) => {
  const n = l.area;
  const p = price[n];
  const c = commute[n];
  const s = schools[n];
  return {
    area: n,
    borough: l.borough,
    averageRent: rent[n].rent,
    averageHousePrice: p.medianPrice,
    nightlife: R.nightlife[n],
    cafes: R.cafes[n],
    greenSpace: R.greenSpace[n],
    culture: R.culture[n],
    quietness: R.quietness[n],
    schools: R.schools[n],
    safety: R.safety[n],
    tram: false,
    train: osm[n].station,
    cycling: R.cycling[n],
    driving: R.driving[n],
    commuteCityMinutes: c.onBoardMinutes,
    apartments: R.apartments[n],
    terraces: R.terraces[n],
    semis: R.semis[n],
    detached: R.detached[n],
    value: R.value[n],
    BuyURL: rightmove("for-sale", l),
    RentURL: rightmove("to-rent", l),
    lat: l.lat,
    lng: l.lng,
    dataSources: {
      averageHousePrice: `Median of ${p.sales} HM Land Registry sales within ${p.radiusKm} km, ${prices.period}`,
      safety: `English Indices of Deprivation 2025 crime domain, average national decile ${safety[n].crimeDecile} (ranked against the other areas)`,
      averageRent: `Estimated from local house prices (like for like) so the ${l.borough} areas average the ONS borough rent of £${rent[n].boroughOfficial} (${rent[n].month}); differences between areas are estimates`,
      schools: `Ofsted grades of ${s.primarySchools} primary schools within ${s.primaryKm} km and ${s.secondarySchools} secondary schools within ${s.secondaryKm} km, average score ${s.score} of 5 (ranked against the other areas)`,
      commuteCityMinutes: `Bus Open Data and national rail timetables, weekday 07:30-08:30, average time on board bus, train or ferry ${c.onBoardMinutes} min (door to door ${c.doorToDoorMinutes} min)`,
      greenSpace: `OpenStreetMap: ${osm[n].greenShare}% of land within 1 km is green (parks, playing fields, woods, fields, heath, beaches)`,
      lifestyle: `OpenStreetMap within 1 km: ${osm[n].nightlife} bars and pubs, ${osm[n].cafes} cafés, ${osm[n].culture} cultural venues${osm[n].station ? `; station: ${osm[n].stationNames.join(", ")}` : ""}`,
    },
  };
});

await mkdir(new URL(".", AREAS_FILE), { recursive: true });
// Same style as Manchester's file: 2-space JSON, Windows line endings, no final newline.
await writeFile(AREAS_FILE, JSON.stringify(areas, null, 2).replace(/\n/g, "\r\n"));
console.log(`written ${areas.length} areas to src/data/${CITY}/areas.json`);
