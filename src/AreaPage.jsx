// Guide page for one area, e.g. /manchester/ancoats.
// Rendered to static HTML at build time by scripts/prerender.mjs; it needs no
// JavaScript in the browser.

import { areaPath } from "./slug.js";

function money(value) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(value);
}

function distanceKm(a, b) {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

const LEVEL = { 1: "Very low", 2: "Low", 3: "Average", 4: "High", 5: "Very high" };

// [field, label, based on official data?]
const RATINGS = [
  ["safety", "Safety", true],
  ["schools", "Schools", true],
  ["greenSpace", "Green space", false],
  ["value", "Value for money", false],
  ["nightlife", "Nightlife", false],
  ["cafes", "Cafés", false],
  ["culture", "Culture", false],
  ["quietness", "Quietness", false],
  ["cycling", "Cycling", false],
];

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthName = (yyyyMm) => `${MONTHS[Number(yyyyMm.slice(5, 7)) - 1]} ${yyyyMm.slice(0, 4)}`;

// "45 minutes", "1 hour 36 minutes", "2 hours"
function duration(minutes) {
  const m = Number(minutes);
  if (m < 60) return `${m} minutes`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return `${h} ${h === 1 ? "hour" : "hours"}${rest ? ` ${rest} minutes` : ""}`;
}

// Distances in the data are in km; visitors in the UK think in miles.
function miles(km) {
  const m = Math.round((Number(km) / 1.609) * 2) / 2;
  return m <= 1 ? "about a mile" : `about ${m} miles`;
}

// Plain-English notes on where each figure comes from, built from the
// technical notes in the area's dataSources (see scripts/data/apply.mjs).
// Returns [heading, sentence] pairs; a note that doesn't match is left out.
export function plainSources(area) {
  const ds = area.dataSources ?? {};
  const out = [];

  const rent = ds.averageRent?.match(/rent of £(\d+) \((\d{4}-\d{2})\)/);
  if (rent) {
    out.push([
      "Rent",
      `The official average private rent across ${area.borough} was ${money(Number(rent[1]))} a month in ${monthName(rent[2])} (Office for National Statistics). We adjust this up or down for each area in the borough using our own estimates, so treat the figure for ${area.area} as a guide rather than an exact price.`,
    ]);
  }

  const price = ds.averageHousePrice?.match(/Median of (\d+) HM Land Registry sales within ([\d.]+) km, (\d{4}-\d{2}) to (\d{4}-\d{2})/);
  if (price) {
    out.push([
      "House price",
      `This is the middle price of the ${price[1]} homes sold within ${miles(price[2])} of ${area.area} between ${monthName(price[3])} and ${monthName(price[4])}, from HM Land Registry records. Half sold for more and half for less. It covers all types of home, so areas with lots of flats can look cheaper than areas with mostly houses.`,
    ]);
  }

  const train = ds.commuteCityMinutes?.match(/^Train estimate.*door to door (\d+) min/);
  const bus = ds.commuteCityMinutes?.match(/^TfGM timetable.*on board bus\/tram (\d+) min \(door to door (\d+) min\)/);
  if (train) {
    out.push([
      "Commute",
      `This is our estimate of the train journey to Manchester city centre, not counting the trip to the station. By bus or tram, a weekday morning trip to Piccadilly Gardens takes about ${duration(train[1])} door to door, including walking and waiting (Transport for Greater Manchester timetables).`,
    ]);
  } else if (bus) {
    out.push([
      "Commute",
      `This is the typical time spent on buses or trams to reach Piccadilly Gardens on a weekday morning between 7:30 and 8:30, worked out from Transport for Greater Manchester timetables. Allow about ${duration(bus[2])} door to door, including walking to the stop and waiting.`,
    ]);
  }

  const crime = ds.safety?.match(/average national decile ([\d.]+)/);
  if (crime) {
    const decile = Number(crime[1]);
    const national =
      decile <= 3
        ? "more crime than most of England"
        : decile < 7
          ? "crime levels around the middle for England"
          : "less crime than most of England";
    out.push([
      "Safety",
      `Based on crime recorded by the police in the neighbourhoods around ${area.area}, measured per person, from the government's English Indices of Deprivation 2025. Overall these neighbourhoods have ${national}. The 1 to 5 rating compares ${area.area} with the other areas on this site, so a 5 means among the safest of them.`,
    ]);
  }

  const schools = ds.schools?.match(/of (\d+) primary schools within (\d+) km and (\d+) secondary schools within (\d+) km/);
  if (schools) {
    const [, primary, primaryKm, secondary, secondaryKm] = schools;
    out.push([
      "Schools",
      `Based on the latest Ofsted inspection results for ${primary} primary schools within ${miles(primaryKm)} and ${secondary} secondary ${Number(secondary) === 1 ? "school" : "schools"} within ${miles(secondaryKm)}, with bigger schools counting for more. Catchment areas vary, so check the individual schools you are interested in.`,
    ]);
  }

  out.push([
    "Other ratings",
    "Green space, value for money, nightlife, cafés, culture, quietness and cycling are our own estimates, not official figures.",
  ]);
  return out;
}

export function commuteSentence(area) {
  const trainEstimate = (area.dataSources?.commuteCityMinutes ?? "").startsWith("Train");
  return trainEstimate
    ? `about ${area.commuteCityMinutes} minutes from Manchester city centre by train`
    : `about ${area.commuteCityMinutes} minutes from Manchester city centre by bus or tram`;
}

export function areaDescription(area) {
  return (
    `Living in ${area.area} (${area.borough}): typical rent ${money(area.averageRent)} a month, ` +
    `homes selling for about ${money(area.averageHousePrice)}, ${commuteSentence(area)}. ` +
    `Compare safety, schools, green space and more.`
  );
}

export default function AreaPage({ area, areas }) {
  const nearby = areas
    .filter((a) => a.area !== area.area)
    .map((a) => ({ ...a, km: distanceKm(area, a) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, 6);
  const sameBorough = areas.filter((a) => a.borough === area.borough && a.area !== area.area);
  const finderLink = `/manchester?borough=${encodeURIComponent(area.borough)}`;

  return (
    <div className="app-shell">
      <div className="page-wrap area-page">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <a href="/">Home</a> <span aria-hidden="true">›</span> <a href="/manchester">Manchester areas</a>{" "}
          <span aria-hidden="true">›</span> <span aria-current="page">{area.area}</span>
        </nav>

        <div className="panel" style={{ marginBottom: "24px" }}>
          <div className="eyebrow">Area guide · {area.borough}</div>
          <h1>Living in {area.area}</h1>
          <p className="intro-text">
            {area.area} is in {area.borough}, {commuteSentence(area)}. Typical rent is {money(area.averageRent)} a month,
            and homes sold for a median of {money(area.averageHousePrice)} over the last year.
          </p>

          <div className="fact-grid">
            <div className="fact">
              <span className="fact-label">Typical rent</span>
              <strong>{money(area.averageRent)} pcm</strong>
            </div>
            <div className="fact">
              <span className="fact-label">Typical sale price</span>
              <strong>{money(area.averageHousePrice)}</strong>
            </div>
            <div className="fact">
              <span className="fact-label">To the city centre</span>
              <strong>About {area.commuteCityMinutes} mins</strong>
            </div>
            <div className="fact">
              <span className="fact-label">Tram stop</span>
              <strong>{area.tram ? "Yes" : "No"}</strong>
            </div>
            <div className="fact">
              <span className="fact-label">Train station</span>
              <strong>{area.train ? "Yes" : "No"}</strong>
            </div>
          </div>

          <div className="property-links">
            <a href={finderLink} className="btn btn-primary">
              See how {area.area} fits your priorities
            </a>
            {area.RentURL && (
              <a href={area.RentURL} target="_blank" rel="noopener noreferrer" className="property-btn">
                View rentals
              </a>
            )}
            {area.BuyURL && (
              <a href={area.BuyURL} target="_blank" rel="noopener noreferrer" className="property-btn property-btn-secondary">
                View for sale
              </a>
            )}
          </div>
        </div>

        <div className="panel" style={{ marginBottom: "24px" }}>
          <h2>How {area.area} rates</h2>
          <p className="muted">Ratings from 1 to 5 compare the 86 areas in Greater Manchester covered by this site.</p>
          <ul className="rating-list">
            {RATINGS.map(([field, label, official]) => (
              <li key={field}>
                <span className="rating-name">
                  {label}
                  {official ? "" : " *"}
                </span>
                <span className="rating-bar" aria-hidden="true">
                  <span style={{ width: `${(area[field] / 5) * 100}%` }} />
                </span>
                <span className="rating-value">
                  {area[field]}/5 · {LEVEL[area[field]]}
                </span>
              </li>
            ))}
          </ul>
          <p className="muted compact">* Estimate. Safety and schools are based on official data.</p>
        </div>

        <div className="panel" style={{ marginBottom: "24px" }}>
          <h2>Where these figures come from</h2>
          <dl className="source-list">
            {plainSources(area).map(([label, text]) => (
              <div key={label} className="source-item">
                <dt>{label}</dt>
                <dd>{text}</dd>
              </div>
            ))}
          </dl>
          <p className="muted compact source-credit">
            Contains HM Land Registry data © Crown copyright and database right 2026. Contains OS data © Crown copyright
            and database right 2026. Contains public sector information from the Office for National Statistics, Ofsted
            and the Ministry of Housing, Communities and Local Government, licensed under the Open Government Licence
            v3.0. Timetable data from Transport for Greater Manchester.
          </p>
        </div>

        <div className="panel" style={{ marginBottom: "24px" }}>
          <h2>Areas near {area.area}</h2>
          <ul className="area-link-list">
            {nearby.map((a) => (
              <li key={a.area}>
                <a href={areaPath(a.area)}>{a.area}</a> <span className="muted">({a.borough}, {a.km.toFixed(1)} km)</span>
              </li>
            ))}
          </ul>

          {sameBorough.length > 0 && (
            <>
              <h2>Other areas in {area.borough}</h2>
              <ul className="area-link-list">
                {sameBorough.map((a) => (
                  <li key={a.area}>
                    <a href={areaPath(a.area)}>{a.area}</a>
                  </li>
                ))}
              </ul>
            </>
          )}

          <p style={{ marginTop: "20px" }}>
            <a href="/manchester" className="btn btn-secondary">
              Compare all 86 areas
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
