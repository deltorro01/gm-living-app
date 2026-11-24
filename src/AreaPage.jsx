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

const SOURCE_LABELS = {
  averageRent: "Rent",
  averageHousePrice: "House price",
  commuteCityMinutes: "Commute",
  safety: "Safety",
  schools: "Schools",
};

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
          <ul className="source-list">
            {Object.entries(SOURCE_LABELS)
              .filter(([field]) => area.dataSources?.[field])
              .map(([field, label]) => (
                <li key={field}>
                  <strong>{label}:</strong> {area.dataSources[field]}
                </li>
              ))}
          </ul>
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
