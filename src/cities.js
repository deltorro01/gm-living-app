// Settings for each city the site covers. Everything city-specific that the
// pages, map and build script need lives here, so a new city is mostly a new
// entry plus its data folder (src/data/<id>/).

export const CITIES = {
  manchester: {
    id: "manchester",
    name: "Manchester",
    region: "Greater Manchester",
    path: "/manchester", // finder page; area guides are at /manchester/<area>
    pageFile: "manchester.html", // source page for the finder (and area guide template)
    centreLabel: "Manchester city centre",
    centrePoint: "Piccadilly Gardens",
    transitOperator: "Transport for Greater Manchester",
    transitModes: "bus or tram", // "by bus or tram"
    transitModesPlural: "buses or trams", // "time spent on buses or trams"
    mapCenter: [53.48, -2.24],
  },
};

export const DEFAULT_CITY = "manchester";

// Which city a page belongs to, from its web address.
export function cityFromPath(pathname = "/") {
  const id = Object.keys(CITIES).find((key) => pathname === CITIES[key].path || pathname.startsWith(`${CITIES[key].path}/`));
  return CITIES[id ?? DEFAULT_CITY];
}
