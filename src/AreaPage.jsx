// Guide page for one area, e.g. /manchester/ancoats (or the same for another city).
// Rendered to static HTML at build time by scripts/prerender.mjs; it needs no
// JavaScript in the browser.

import { areaPath } from "./slug.js";
import SiteHeader from "./SiteHeader.jsx";
import SiteFooter from "./SiteFooter.jsx";
import { isInCentre, commuteShort } from "./commuteText.js";

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
export function plainSources(area, city) {
  const ds = area.dataSources ?? {};
  const out = [];

  const rent = ds.averageRent?.match(/rent of £(\d+) \((\d{4}-\d{2})\)/);
  if (rent) {
    out.push([
      "Rent",
      `The official average private rent across ${area.borough} was ${money(Number(rent[1]))} a month in ${monthName(rent[2])} (Office for National Statistics). ` +
        (ds.averageRent.startsWith("Estimated from local house prices")
          ? `We adjust this for each area by how its house prices compare with the rest of the borough, like for like, so treat the figure for ${area.area} as a guide rather than an exact price.`
          : `We adjust this up or down for each area in the borough using our own estimates, so treat the figure for ${area.area} as a guide rather than an exact price.`),
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
  // Matches both "on board bus/tram 18 min (door to door 25 min)" (Manchester)
  // and "on board bus, train or ferry 28 min (door to door 41 min)" (Liverpool).
  const bus = ds.commuteCityMinutes?.match(/average time on board [^0-9]*(\d+) min \(door to door (\d+) min\)/);
  if (isInCentre(area.commuteCityMinutes)) {
    out.push(["Commute", `${area.area} is in ${city.centreLabel} itself, within walking distance of ${city.centrePoint}.`]);
  } else if (train) {
    out.push([
      "Commute",
      `This is our estimate of the train journey to ${city.centreLabel}, not counting the trip to the station. By ${city.transitModes}, a weekday morning trip to ${city.centrePoint} takes about ${duration(train[1])} door to door, including walking and waiting (${city.transitOperator} timetables).`,
    ]);
  } else if (bus) {
    out.push([
      "Commute",
      `This is the typical time spent on ${city.transitModesPlural} to reach ${city.centrePoint} on a weekday morning between 7:30 and 8:30, worked out from ${city.transitOperator} timetables. Allow about ${duration(bus[2])} door to door, including walking to the stop and waiting.`,
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

  const green = ds.greenSpace?.match(/OpenStreetMap: ([\d.]+)% of land within 1 km is green/);
  if (green) {
    out.push([
      "Green space",
      `About ${Math.round(Number(green[1]))}% of the land within about half a mile of the centre of ${area.area} is green: parks, playing fields, woods, fields, heath and beaches, from OpenStreetMap. Private gardens aren't counted for any area.`,
    ]);
  }

  if (ds.lifestyle) {
    out.push([
      "Other ratings",
      "Nightlife, cafés and culture count the bars, cafés and venues nearby on OpenStreetMap. Quietness, cycling and value for money are worked out from OpenStreetMap, house prices and the other ratings. All ratings compare areas within this city region.",
    ]);
  } else {
    out.push([
      "Other ratings",
      "Green space, value for money, nightlife, cafés, culture, quietness and cycling are our own estimates, not official figures.",
    ]);
  }
  return out;
}

export function commuteSentence(area, city) {
  if (isInCentre(area.commuteCityMinutes)) return `in the heart of ${city.centreLabel}`;
  const trainEstimate = (area.dataSources?.commuteCityMinutes ?? "").startsWith("Train");
  return trainEstimate
    ? `about ${area.commuteCityMinutes} minutes from ${city.centreLabel} by train`
    : `about ${area.commuteCityMinutes} minutes from ${city.centreLabel} by ${city.transitModes}`;
}

export function areaDescription(area, city) {
  return (
    `Living in ${area.area} (${area.borough}): typical rent ${money(area.averageRent)} a month, ` +
    `homes selling for about ${money(area.averageHousePrice)}, ${commuteSentence(area, city)}. ` +
    `Compare safety, schools, green space and more.`
  );
}

export function PhotoCredit({ photo }) {
  return (
    <figcaption>
      Photo: {photo.author},{" "}
      {photo.licenceUrl ? (
        <a href={photo.licenceUrl} target="_blank" rel="noopener noreferrer license">
          {photo.licence}
        </a>
      ) : (
        photo.licence
      )}
      , via{" "}
      <a href={photo.page} target="_blank" rel="noopener noreferrer">
        Wikimedia Commons
      </a>
    </figcaption>
  );
}

export default function AreaPage({ area, areas, photo, city }) {
  const nearby = areas
    .filter((a) => a.area !== area.area)
    .map((a) => ({ ...a, km: distanceKm(area, a) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, 6);
  const sameBorough = areas.filter((a) => a.borough === area.borough && a.area !== area.area);
  const finderLink = `${city.path}?borough=${encodeURIComponent(area.borough)}`;
  // Cities built from data (e.g. Liverpool) have no hand-set ratings to mark.
  const allFromData = Boolean(area.dataSources?.lifestyle);

  return (
    <div className="app-shell">
      <SiteHeader current={city.id} />
      <div className="page-wrap area-page">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <a href="/">Home</a> <span aria-hidden="true">›</span> <a href={city.path}>{`${city.name} areas`}</a>{" "}
          <span aria-hidden="true">›</span> <span aria-current="page">{area.area}</span>
        </nav>

        <div className="panel section-gap">
          {photo && (
            <figure className="area-photo">
              <img src={photo.src} width={photo.width} height={photo.height} alt={photo.alt} fetchpriority="high" />
              <PhotoCredit photo={photo} />
            </figure>
          )}
          <div className="eyebrow">Area guide · {area.borough}</div>
          <h1>Living in {area.area}</h1>
          <p className="intro-text">
            {area.area} is in {area.borough}, {commuteSentence(area, city)}. Typical rent is {money(area.averageRent)} a month,
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
              <strong>{commuteShort(area.commuteCityMinutes)}</strong>
            </div>
            {city.hasTram !== false && (
              <div className="fact">
                <span className="fact-label">Tram stop</span>
                <strong>{area.tram ? "Yes" : "No"}</strong>
              </div>
            )}
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

        <div className="panel section-gap">
          <h2>How {area.area} rates</h2>
          <p className="muted">{`Ratings from 1 to 5 compare the ${areas.length} areas in ${city.regionInSentence ?? city.region} covered by this site.`}</p>
          <ul className="rating-list">
            {RATINGS.map(([field, label, official]) => (
              <li key={field}>
                <span className="rating-name">
                  {label}
                  {official || allFromData ? "" : " *"}
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
          <p className="muted compact">
            {allFromData
              ? "All ratings are worked out from official and OpenStreetMap data."
              : "* Estimate. Safety and schools are based on official data."}
          </p>
        </div>

        <div className="panel section-gap">
          <h2>Where these figures come from</h2>
          <dl className="source-list">
            {plainSources(area, city).map(([label, text]) => (
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
            v3.0. Timetable data from {city.transitOperator}.
            {allFromData && " Map data © OpenStreetMap contributors, available under the Open Database Licence."}
          </p>
        </div>

        <div className="panel section-gap">
          <h2>Areas near {area.area}</h2>
          <ul className="area-link-list">
            {nearby.map((a) => (
              <li key={a.area}>
                <a href={areaPath(a.area, city)}>{a.area}</a> <span className="muted">({a.borough}, {a.km.toFixed(1)} km)</span>
              </li>
            ))}
          </ul>

          {sameBorough.length > 0 && (
            <>
              <h2>Other areas in {area.borough}</h2>
              <ul className="area-link-list">
                {sameBorough.map((a) => (
                  <li key={a.area}>
                    <a href={areaPath(a.area, city)}>{a.area}</a>
                  </li>
                ))}
              </ul>
            </>
          )}

          <p className="spaced-top">
            <a href={city.path} className="btn btn-secondary">
              {`Compare all ${areas.length} areas`}
            </a>
          </p>
        </div>

        <SiteFooter />
      </div>
    </div>
  );
}
