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
    hasTram: true,
    // Photo on the home page's city card (credited there).
    homePhoto: {
      src: "/images/areas/salford-quays.jpg",
      width: 960,
      height: 720,
      alt: "Salford Quays and the Lowry footbridge, with Manchester beyond",
      author: "Pit-yacker",
      licence: "CC BY-SA 3.0",
      licenceUrl: "http://creativecommons.org/licenses/by-sa/3.0/",
      page: "https://commons.wikimedia.org/wiki/File:Salford_Quays_from_south_bank_of_MSC,_2008.jpg",
    },
  },
  liverpool: {
    id: "liverpool",
    name: "Liverpool",
    region: "Liverpool City Region",
    regionInSentence: "the Liverpool City Region", // "Where Should I Live In the Liverpool City Region"
    path: "/liverpool",
    pageFile: "liverpool.html",
    centreLabel: "Liverpool city centre",
    centrePoint: "Church Street",
    transitOperator: "Bus Open Data Service and Rail Delivery Group",
    transitModes: "bus, train or ferry",
    transitModesPlural: "buses, trains or ferries",
    mapCenter: [53.42, -2.95],
    hasTram: false, // hides the "With a tram stop" filter
    homePhoto: {
      src: "/images/liverpool.jpg",
      width: 1280,
      height: 750,
      alt: "Liverpool's Georgian Quarter seen from the top of Liverpool Cathedral",
      author: "Lealiverpool2020",
      licence: "CC0",
      licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
      page: "https://commons.wikimedia.org/wiki/File:View_of_Liverpool_from_top_of_Liverpool_Cathedral.jpg",
    },
  },
};

export const DEFAULT_CITY = "manchester";

// Which city a page belongs to, from its web address.
export function cityFromPath(pathname = "/") {
  const id = Object.keys(CITIES).find((key) => pathname === CITIES[key].path || pathname.startsWith(`${CITIES[key].path}/`));
  return CITIES[id ?? DEFAULT_CITY];
}
