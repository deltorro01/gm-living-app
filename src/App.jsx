import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import "./styles.css";
import { readSettings, writeSettings } from "./urlState.js";
import { WhyThisMatch, CompareButton, CompareView } from "./ResultParts.jsx";
import { fitBand } from "./bands.js";
import { areaPath } from "./slug.js";
import SiteHeader from "./SiteHeader.jsx";
import SiteFooter from "./SiteFooter.jsx";
import { commuteLabel } from "./commuteText.js";

// The map (and the Leaflet library) only downloads when someone opens it.
const AreaMap = lazy(() => import("./AreaMap.jsx"));

function money(value) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function to100(value) {
  return clamp((value / 5) * 100);
}

function scoreBand(score) {
  return fitBand(score).label;
}

function SliderField({ label, value, min, max, step = 1, onChange, format }) {
  const id = `slider-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <div className="field-group">
      <div className="row-between small-gap">
        <label htmlFor={id}>{label}</label>
        <span className="slider-value">{format ? format(value) : value}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function getBudgetValue(area, budgetType) {
  return budgetType === "rent" ? area.averageRent : area.averageHousePrice;
}

function getBudgetLimit(budgetType, monthlyBudget, buyBudget) {
  return budgetType === "rent" ? monthlyBudget : buyBudget;
}

function getAffordabilityScore(area, budgetType, monthlyBudget, buyBudget) {
  const cost = getBudgetValue(area, budgetType);
  const budget = getBudgetLimit(budgetType, monthlyBudget, buyBudget);

  if (!budget || budget <= 0) return 50;

  const ratio = cost / budget;

  if (ratio <= 1.0) return 100;
  if (ratio <= 1.1) return 78;
  if (ratio <= 1.2) return 55;
  if (ratio <= 1.35) return 30;
  return 8;
}

// Closest match: best when the area's rating equals the slider (used for nightlife,
// where a low setting can mean "somewhere quiet").
function getPreferenceMatch(areaValue, desiredValue) {
  const diff = Math.abs(areaValue - desiredValue);
  return clamp(100 - diff * 22);
}

// Meets or beats: full marks when the area's rating is at or above the slider.
function getAtLeastMatch(areaValue, desiredValue) {
  const shortfall = Math.max(0, desiredValue - areaValue);
  return clamp(100 - shortfall * 22);
}

function getCommuteScore(area, commutePreference) {
  if (commutePreference === "city-centre") {
    if (area.commuteCityMinutes <= 10) return 100;
    if (area.commuteCityMinutes <= 20) return 85;
    if (area.commuteCityMinutes <= 30) return 65;
    if (area.commuteCityMinutes <= 40) return 40;
    return 18;
  }

  if (commutePreference === "balanced") {
    return clamp(
      to100(area.value) * 0.35 +
        to100(area.greenSpace) * 0.25 +
        to100(area.cycling) * 0.1 +
        (area.commuteCityMinutes <= 20
          ? 85
          : area.commuteCityMinutes <= 30
            ? 65
            : area.commuteCityMinutes <= 40
              ? 45
              : 25) *
          0.3
    );
  }

  if (commutePreference === "space") {
    return clamp(
      to100(area.greenSpace) * 0.4 +
        to100(area.quietness) * 0.4 +
        (area.commuteCityMinutes <= 25
          ? 70
          : area.commuteCityMinutes <= 35
            ? 55
            : 35) *
          0.2
    );
  }

  return 50;
}

function getLifeStageScore(area, lifeStage, scores) {
  if (lifeStage === "young-professional") {
    return clamp(
      scores.nightlife * 0.3 +
        to100(area.cafes) * 0.2 +
        to100(area.culture) * 0.18 +
        scores.commute * 0.15 +
        scores.value * 0.07 +
        scores.safety * 0.1
    );
  }

  if (lifeStage === "family") {
    return clamp(
      scores.schools * 0.26 +
        scores.green * 0.18 +
        scores.safety * 0.24 +
        to100(area.quietness) * 0.18 +
        scores.affordability * 0.06 +
        scores.commute * 0.08
    );
  }

  if (lifeStage === "first-time-buyer") {
    return clamp(
      scores.affordability * 0.28 +
        scores.value * 0.24 +
        scores.commute * 0.14 +
        scores.safety * 0.2 +
        to100(area.cafes) * 0.07 +
        scores.green * 0.07
    );
  }

  if (lifeStage === "downsizer") {
    return clamp(
      to100(area.quietness) * 0.28 +
        scores.green * 0.2 +
        scores.safety * 0.24 +
        scores.affordability * 0.12 +
        scores.commute * 0.08 +
        scores.schools * 0.08
    );
  }

  return 50;
}

// `city` is an entry from src/cities.js and `areas` is that city's area data.
export default function App({ city, areas }) {
  const BOROUGHS = useMemo(() => [...new Set(areas.map((a) => a.borough))].sort(), [areas]);
  const AREA_NAMES = useMemo(() => new Set(areas.map((a) => a.area)), [areas]);
  const compareCountFromLink = (names) => new Set(names.filter((name) => AREA_NAMES.has(name))).size;


  const DEFAULT_VISIBLE = 10;

  // Starting values come from the web address when present (shared links).
  const [initial] = useState(readSettings);

  const [lifeStage, setLifeStage] = useState(initial.lifeStage);
  const [budgetType, setBudgetType] = useState(initial.budgetType);
  const [monthlyBudget, setMonthlyBudget] = useState(initial.monthlyBudget);
  const [buyBudget, setBuyBudget] = useState(initial.buyBudget);
  const [commutePreference, setCommutePreference] = useState(initial.commutePreference);

  const [nightlifePriority, setNightlifePriority] = useState(initial.nightlife);
  const [greenPriority, setGreenPriority] = useState(initial.green);
  const [valuePriority, setValuePriority] = useState(initial.value);
  const [schoolPriority, setSchoolPriority] = useState(initial.schools);
  const [safetyPriority, setSafetyPriority] = useState(initial.safety);
  const [cyclingPriority, setCyclingPriority] = useState(initial.cycling);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [visibleCount, setVisibleCount] = useState(DEFAULT_VISIBLE);

  // Page filters (hide areas; they don't change scores)
  // Shared links are untrusted: keep only real boroughs and area names.
  const [borough, setBorough] = useState(BOROUGHS.includes(initial.borough) ? initial.borough : "");
  const [withinBudget, setWithinBudget] = useState(initial.withinBudget);
  const [tramOnly, setTramOnly] = useState(initial.tramOnly);
  const [trainOnly, setTrainOnly] = useState(initial.trainOnly);

  const [compare, setCompare] = useState(() => [...new Set(initial.compare)].filter((name) => AREA_NAMES.has(name)));
  const [showCompare, setShowCompare] = useState(() => compareCountFromLink(initial.compare) >= 2);
  const [showMap, setShowMap] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const results = useMemo(() => {
    const scored = areas.map((area) => {
      const scores = {
        affordability: getAffordabilityScore(
          area,
          budgetType,
          monthlyBudget,
          buyBudget
        ),
        nightlife: getPreferenceMatch(area.nightlife, nightlifePriority),
        green: getAtLeastMatch(area.greenSpace, greenPriority),
        value: getAtLeastMatch(area.value, valuePriority),
        schools: getAtLeastMatch(area.schools, schoolPriority),
        cycling: getAtLeastMatch(area.cycling, cyclingPriority),
        safety: getAtLeastMatch(area.safety, safetyPriority),
        commute: getCommuteScore(area, commutePreference),
      };

      const lifeStageScore = getLifeStageScore(area, lifeStage, scores);

      const finalScore = clamp(
        scores.affordability * 0.18 +
          lifeStageScore * 0.32 +
          scores.commute * 0.11 +
          scores.nightlife * 0.07 +
          scores.green * 0.07 +
          scores.value * 0.07 +
          scores.schools * 0.06 +
          scores.cycling * 0.04 +
          scores.safety * 0.08
      );

      return {
        ...area,
        match: Math.round(finalScore),
        breakdown: {
          affordability: Math.round(scores.affordability),
          lifestyle: Math.round(lifeStageScore),
          commute: Math.round(scores.commute),
        },
      };
    });

    return scored.sort((a, b) => {
      if (b.match !== a.match) return b.match - a.match;
      return a.commuteCityMinutes - b.commuteCityMinutes;
    });
  }, [
    budgetType,
    monthlyBudget,
    buyBudget,
    commutePreference,
    nightlifePriority,
    greenPriority,
    valuePriority,
    schoolPriority,
    cyclingPriority,
    safetyPriority,
    lifeStage,
    areas,
  ]);

  const settings = {
    lifeStage,
    budgetType,
    monthlyBudget,
    buyBudget,
    commutePreference,
    nightlife: nightlifePriority,
    green: greenPriority,
    value: valuePriority,
    schools: schoolPriority,
    safety: safetyPriority,
    cycling: cyclingPriority,
  };

  // Keep the web address in step with the settings, so it can be shared.
  useEffect(() => {
    writeSettings({ ...settings, borough, withinBudget, tramOnly, trainOnly, compare });
  });

  const budgetLimit = getBudgetLimit(budgetType, monthlyBudget, buyBudget);
  const filtered = useMemo(
    () =>
      results.filter(
        (area) =>
          (!borough || area.borough === borough) &&
          (!withinBudget || getBudgetValue(area, budgetType) <= budgetLimit) &&
          (!tramOnly || area.tram) &&
          (!trainOnly || area.train)
      ),
    [results, borough, withinBudget, budgetType, budgetLimit, tramOnly, trainOnly]
  );
  const hiddenCount = results.length - filtered.length;
  const filtersOn = Boolean(borough) || withinBudget || tramOnly || trainOnly;

  const top3 = filtered.slice(0, 3);
  const visibleResults = filtered.slice(3, 3 + visibleCount);

  const compareAreas = compare.map((name) => results.find((r) => r.area === name)).filter(Boolean);

  function toggleCompare(name) {
    setCompare((list) => (list.includes(name) ? list.filter((n) => n !== name) : list.length >= 3 ? list : [...list, name]));
  }

  function clearFilters() {
    setBorough("");
    setWithinBudget(false);
    setTramOnly(false);
    setTrainOnly(false);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    } catch {
      window.prompt("Copy this link:", window.location.href);
    }
  }

  const filterToggle = (label, on, set) => (
    <button
      type="button"
      className={on ? "btn btn-primary transport-toggle is-selected" : "btn btn-secondary transport-toggle"}
      aria-pressed={on}
      onClick={() => set(!on)}
    >
      <span>{label}</span>
      {on ? <span className="transport-tick">✓</span> : null}
    </button>
  );

  return (
    <div className="app-shell">
      <SiteHeader current={city.id} />
      <div className="page-wrap">
        <div className="panel section-gap">
          <div className="eyebrow">{city.region}</div>
          <h1 className="page-title">Find places that fit how you want to live</h1>
          <p className="muted page-intro">
            Set the basics, then open more preferences when needed. <a href="/">Change city</a>
          </p>

          <div className="sticky-top-filters field-grid">
            <div className="field-group">
              <label htmlFor="life-stage">Life stage</label>
              <select id="life-stage" value={lifeStage} onChange={(e) => setLifeStage(e.target.value)}>
                <option value="young-professional">Young professional</option>
                <option value="family">Family</option>
                <option value="first-time-buyer">First-time buyer</option>
                <option value="downsizer">Downsizer</option>
              </select>
            </div>

            <div className="field-group">
              <label>Budget type</label>
              <div className="button-row two-up">
                <button
                  type="button"
                  className={budgetType === "rent" ? "btn btn-primary" : "btn btn-secondary"}
                  aria-pressed={budgetType === "rent"}
                  onClick={() => setBudgetType("rent")}
                >
                  Rent
                </button>
                <button
                  type="button"
                  className={budgetType === "buy" ? "btn btn-primary" : "btn btn-secondary"}
                  aria-pressed={budgetType === "buy"}
                  onClick={() => setBudgetType("buy")}
                >
                  Buy
                </button>
              </div>
            </div>

            {budgetType === "rent" ? (
              <SliderField
                label="Monthly budget"
                value={monthlyBudget}
                min={700}
                max={2500}
                step={50}
                format={money}
                onChange={setMonthlyBudget}
              />
            ) : (
              <SliderField
                label="Buying budget"
                value={buyBudget}
                min={150000}
                max={800000}
                step={5000}
                format={money}
                onChange={setBuyBudget}
              />
            )}

            <div className="field-group">
              <label htmlFor="commute-preference">Commute preference</label>
              <select
                id="commute-preference"
                value={commutePreference}
                onChange={(e) => setCommutePreference(e.target.value)}
              >
                <option value="city-centre">{city.centreLabel}</option>
                <option value="balanced">Hybrid</option>
                <option value="space">Work from home</option>
              </select>
            </div>
          </div>

          <div className="more-filters-row">
            <button
              type="button"
              className={showAdvanced ? "btn btn-primary more-filters-btn" : "btn btn-secondary more-filters-btn"}
              aria-expanded={showAdvanced}
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              {showAdvanced ? "Hide more preferences" : "More preferences"}
            </button>
          </div>

          {showAdvanced && (
            <div className="field-grid">
              <SliderField label="Nightlife" value={nightlifePriority} min={1} max={5} onChange={setNightlifePriority} />
              <SliderField label="Green space" value={greenPriority} min={1} max={5} onChange={setGreenPriority} />
              <SliderField label="Value for money" value={valuePriority} min={1} max={5} onChange={setValuePriority} />
              <SliderField label="Schools" value={schoolPriority} min={1} max={5} onChange={setSchoolPriority} />
              <SliderField label="Safety" value={safetyPriority} min={1} max={5} onChange={setSafetyPriority} />
              <SliderField label="Cycling" value={cyclingPriority} min={1} max={5} onChange={setCyclingPriority} />
            </div>
          )}
        </div>

        <div className="panel refine-panel">
          <div className="row-between wrap-gap">
            <h2 className="heading-flush">Refine your results</h2>
            <div className="button-row">
              <button
                type="button"
                className={showMap ? "btn btn-primary" : "btn btn-secondary"}
                aria-pressed={showMap}
                onClick={() => setShowMap(!showMap)}
              >
                {showMap ? "Hide map" : "Show map"}
              </button>
              <button type="button" className="btn btn-secondary" onClick={copyLink}>
                {linkCopied ? "Link copied" : "Copy link to these results"}
              </button>
            </div>
          </div>

          <div className="refine-row">
            <div className="field-group">
              <label htmlFor="borough-filter">Borough</label>
              <select id="borough-filter" value={borough} onChange={(e) => setBorough(e.target.value)}>
                <option value="">All boroughs</option>
                {BOROUGHS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <div className="field-group">
              <label>Must-haves: only show areas</label>
              <div className="button-row transport-toggle-row">
                {filterToggle("Within my budget", withinBudget, setWithinBudget)}
                {city.hasTram !== false && filterToggle("With a tram stop", tramOnly, setTramOnly)}
                {filterToggle("With a train station", trainOnly, setTrainOnly)}
              </div>
            </div>
          </div>

          {filtersOn && (
            <p className="muted compact filter-note">
              {hiddenCount} of {results.length} areas hidden by these filters.{" "}
              <button type="button" className="link-btn" onClick={clearFilters}>
                Clear filters
              </button>
            </p>
          )}

          {showMap && (
            <div className="map-wrap">
              <Suspense fallback={<p className="muted">Loading map…</p>}>
                <AreaMap areas={filtered} budgetType={budgetType} money={money} center={city.mapCenter} />
              </Suspense>
            </div>
          )}
        </div>

        {showCompare && compareAreas.length > 0 && (
          <CompareView
            city={city}
            areas={compareAreas}
            settings={settings}
            money={money}
            onRemove={toggleCompare}
            onClose={() => setShowCompare(false)}
          />
        )}

        {filtered.length === 0 ? (
          <div className="empty-state">
            <div>
              <p>No areas match these filters.</p>
              <button type="button" className="btn btn-primary" onClick={clearFilters}>
                Clear filters
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="hero-cards">
              <h2>Your best matches</h2>
              <p className="muted">These areas most closely match your preferences.</p>
              {top3.map((area, idx) => (
                <div key={area.area} className="panel">
                  <div className="row-between small-gap">
                    <span className="pill">{idx === 0 ? "Best match" : `Top match #${idx + 1}`}</span>
                    <strong>{area.match}%</strong>
                  </div>

                  <h2>{area.area}</h2>
                  <p className="muted">{area.borough}</p>

                  <p className="fit-label">{scoreBand(area.match)}</p>

                  <AreaDetails area={area} budgetType={budgetType} />

                  <WhyThisMatch area={area} settings={settings} />

                  <div className="property-links">
                    <PropertyLinks area={area} city={city} hero />
                    <CompareButton name={area.area} compare={compare} onToggle={toggleCompare} />
                  </div>
                </div>
              ))}
            </div>

            {filtered.length > 3 && (
              <>
                <div>
                  <h2>The rest of your matches</h2>
                  <p className="muted">These are the next best areas for you.</p>
                </div>
                <div className="panel">
                  <div className="row-between wrap-gap">
                    <p className="muted">
                      Showing {top3.length + visibleResults.length} of {filtered.length} areas
                    </p>
                  </div>

                  <div className="results-list">
                    {visibleResults.map((area, idx) => (
                      <div key={area.area} className="result-card">
                        <div className="result-rank">{idx + 4}</div>

                        <div className="result-main">
                          <div className="result-title-row">
                            <h3>{area.area}</h3>
                            <span className="tag outline">{area.borough}</span>
                            <span className="tag dark">{scoreBand(area.match)}</span>
                          </div>

                          <AreaDetails area={area} budgetType={budgetType} />

                          <WhyThisMatch area={area} settings={settings} />

                          <div className="property-links">
                            <PropertyLinks area={area} city={city} />
                            <CompareButton name={area.area} compare={compare} onToggle={toggleCompare} />
                          </div>
                        </div>

                        <div className="result-score">
                          <strong>{area.match}%</strong>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="list-actions">
                    {3 + visibleCount < filtered.length && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => setVisibleCount((prev) => prev + 10)}
                      >
                        Show more areas
                      </button>
                    )}

                    {visibleCount > DEFAULT_VISIBLE && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setVisibleCount(DEFAULT_VISIBLE)}
                      >
                        Show fewer areas
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {compare.length > 0 && (
          <div className="compare-bar" role="region" aria-label="Areas to compare">
            <span>
              <strong>Compare ({compare.length}/3):</strong> {compare.join(", ")}
            </span>
            <div className="button-row">
              <button
                type="button"
                className="btn btn-primary"
                disabled={compare.length < 2}
                onClick={() => {
                  setShowCompare(true);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                View comparison
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setCompare([])}>
                Clear
              </button>
            </div>
          </div>
        )}

        <SiteFooter />
      </div>
    </div>
  );
}

// Ratings shown on each card, in order of how much they matter to most people.
const CARD_RATINGS = [
  ["safety", "Safety"],
  ["schools", "Schools"],
  ["greenSpace", "Green space"],
  ["value", "Value"],
  ["nightlife", "Nightlife"],
  ["cycling", "Cycling"],
];

// Price line, ratings as dots and transport badges for one result card.
function AreaDetails({ area, budgetType }) {
  const rent = `${money(area.averageRent)} a month`;
  const price = money(area.averageHousePrice);
  return (
    <>
      <p className="price-line">
        {budgetType === "rent" ? (
          <>
            <strong>{rent}</strong> · Buy {price}
          </>
        ) : (
          <>
            <strong>{price}</strong> · Rent {rent}
          </>
        )}{" "}
        · {commuteLabel(area.commuteCityMinutes)}
      </p>

      <ul className="rating-dots">
        {CARD_RATINGS.map(([field, label]) => (
          <li key={field}>
            <span className="rating-dots-label">{label}</span>
            <span className="dots" role="img" aria-label={`${area[field]} out of 5`}>
              {[1, 2, 3, 4, 5].map((n) => (
                <span key={n} className={n <= area[field] ? "dot on" : "dot"} />
              ))}
            </span>
          </li>
        ))}
      </ul>

      {(area.tram || area.train) && (
        <div className="transport-badges">
          {area.tram && <span className="tag">Tram stop</span>}
          {area.train && <span className="tag">Train station</span>}
        </div>
      )}
    </>
  );
}

function PropertyLinks({ area, city, hero = false }) {
  const extra = hero ? " hero-btn" : "";
  return (
    <>
      {area.RentURL && (
        <a href={area.RentURL} target="_blank" rel="noopener noreferrer" className={`property-btn${extra}`}>
          View rentals
        </a>
      )}
      {area.BuyURL && (
        <a href={area.BuyURL} target="_blank" rel="noopener noreferrer" className={`property-btn property-btn-secondary${extra}`}>
          View for sale
        </a>
      )}
      <a href={areaPath(area.area, city)} className="btn compare-btn area-guide-link">
        Area guide
      </a>
    </>
  );
}
