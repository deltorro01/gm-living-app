import React, { useMemo, useState } from "react";
import areas from "./areas.json";
import "./styles.css";

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
  if (score >= 85) return "Excellent fit";
  if (score >= 72) return "Strong fit";
  if (score >= 58) return "Good fit";
  return "Worth a look";
}

function SliderField({ label, value, min, max, step = 1, onChange, format }) {
  return (
    <div className="field-group">
      <div className="row-between small-gap">
        <label>{label}</label>
        <span className="slider-value">{format ? format(value) : value}</span>
      </div>
      <input
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

  if (ratio <= 0.75) return 78;
  if (ratio <= 0.9) return 90;
  if (ratio <= 1.0) return 100;
  if (ratio <= 1.1) return 78;
  if (ratio <= 1.2) return 55;
  if (ratio <= 1.35) return 30;
  return 8;
}

function getPreferenceMatch(areaValue, desiredValue) {
  const diff = Math.abs(areaValue - desiredValue);
  return clamp(100 - diff * 22);
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

function getRequirementAdjustment(area, needTram, needTrain) {
  let bonus = 0;
  let penalty = 0;

  if (needTram) {
    if (area.tram) bonus += 5;
    else penalty += 10;
  }

  if (needTrain) {
    if (area.train) bonus += 5;
    else penalty += 10;
  }

  return { net: bonus - penalty };
}

export default function App() {

  const DEFAULT_VISIBLE = 10;

  const [lifeStage, setLifeStage] = useState("young-professional");
  const [budgetType, setBudgetType] = useState("rent");
  const [monthlyBudget, setMonthlyBudget] = useState(1300);
  const [buyBudget, setBuyBudget] = useState(325000);
  const [commutePreference, setCommutePreference] = useState("city-centre");

  const [nightlifePriority, setNightlifePriority] = useState(3);
  const [greenPriority, setGreenPriority] = useState(3);
  const [valuePriority, setValuePriority] = useState(4);
  const [schoolPriority, setSchoolPriority] = useState(2);
  const [safetyPriority, setSafetyPriority] = useState(3);
  const [cyclingPriority, setCyclingPriority] = useState(3);

  const [needTram, setNeedTram] = useState(false);
  const [needTrain, setNeedTrain] = useState(false);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [visibleCount, setVisibleCount] = useState(DEFAULT_VISIBLE);

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
        green: getPreferenceMatch(area.greenSpace, greenPriority),
        value: getPreferenceMatch(area.value, valuePriority),
        schools: getPreferenceMatch(area.schools, schoolPriority),
        cycling: getPreferenceMatch(area.cycling, cyclingPriority),
        safety: getPreferenceMatch(area.safety, safetyPriority),
        commute: getCommuteScore(area, commutePreference),
      };

      const lifeStageScore = getLifeStageScore(area, lifeStage, scores);
      const requirementAdjustment = getRequirementAdjustment(
        area,
        needTram,
        needTrain
      );

      const finalScore = clamp(
  scores.affordability * 0.18 +
    lifeStageScore * 0.32 +
    scores.commute * 0.11 +
    scores.nightlife * 0.07 +
    scores.green * 0.07 +
    scores.value * 0.07 +
    scores.schools * 0.06 +
    scores.cycling * 0.04 +
    scores.safety * 0.08 +
    requirementAdjustment.net
);

      return {
        ...area,
        match: Math.round(finalScore),
        breakdown: {
          affordability: Math.round(scores.affordability),
          lifestyle: Math.round(lifeStageScore),
          commute: Math.round(scores.commute),
          requirements: requirementAdjustment.net,
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
    needTram,
    needTrain,
  ]);

  const top3 = results.slice(0, 3);
  const visibleResults = results.slice(3, 3 + visibleCount);

  return (
    <div className="app-shell">
      <div className="page-wrap">
        <div className="panel" style={{ marginBottom: "24px" }}>
          <div className="row-between wrap-gap">
            <div>
              <div className="eyebrow">Where Should I Live In Greater Manchester</div>
              <h1 style={{ marginBottom: "8px" }}>
                Find places that fit how you want to live
            </h1>

              <p className="muted" style={{ marginTop: 0 }}>
                Adjust the core filters, then open more filters when needed.
            </p>
            </div>
          </div>

          <div
            className="sticky-top-filters"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "16px",
              marginTop: "20px",
            }}
          >
            <div className="field-group">
              <label>Life stage</label>
              <select
                value={lifeStage}
                onChange={(e) => setLifeStage(e.target.value)}
              >
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
                  className={
                    budgetType === "rent" ? "btn btn-primary" : "btn btn-secondary"
                  }
                  onClick={() => setBudgetType("rent")}
                >
                  Rent
                </button>
                <button
                  type="button"
                  className={
                    budgetType === "buy" ? "btn btn-primary" : "btn btn-secondary"
                  }
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
              <label>Commute preference</label>
              <select
                value={commutePreference}
                onChange={(e) => setCommutePreference(e.target.value)}
              >
                <option value="city-centre">Manchester city centre</option>
                <option value="balanced">Hybrid</option>
                <option value="space">Work from home</option>
              </select>
            </div>
          </div>

          <div className="more-filters-row">
            <button
              type="button"
              className={showAdvanced ? "btn btn-primary more-filters-btn" : "btn btn-secondary more-filters-btn"}
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
            {showAdvanced ? "Hide more filters" : "More filters"}
            </button>
          </div>

          {showAdvanced && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "16px",
                marginTop: "20px",
              }}
            >
              <SliderField
                label="Nightlife"
                value={nightlifePriority}
                min={1}
                max={5}
                onChange={setNightlifePriority}
              />
              <SliderField
                label="Green space"
                value={greenPriority}
                min={1}
                max={5}
                onChange={setGreenPriority}
              />
              <SliderField
                label="Value for money"
                value={valuePriority}
                min={1}
                max={5}
                onChange={setValuePriority}
              />
              <SliderField
                label="Schools"
                value={schoolPriority}
                min={1}
                max={5}
                onChange={setSchoolPriority}
              />

              <SliderField
                label="Safety"
                value={safetyPriority}
                min={1}
                max={5}
                onChange={setSafetyPriority}
              />

              <SliderField
                label="Cycling"
                value={cyclingPriority}
                min={1}
                max={5}
                onChange={setCyclingPriority}
              />

              <div className="field-group">
  <label>Must-have transport</label>
  <div className="button-row transport-toggle-row">
    <button
      type="button"
      className={needTram ? "btn btn-primary transport-toggle is-selected" : "btn btn-secondary transport-toggle"}
      onClick={() => setNeedTram(!needTram)}
      aria-pressed={needTram}
    >
      <span>Tram</span>
      {needTram ? <span className="transport-tick">✓</span> : null}
    </button>

    <button
      type="button"
      className={needTrain ? "btn btn-primary transport-toggle is-selected" : "btn btn-secondary transport-toggle"}
      onClick={() => setNeedTrain(!needTrain)}
      aria-pressed={needTrain}
    >
      <span>Train</span>
      {needTrain ? <span className="transport-tick">✓</span> : null}
    </button>
  </div>
</div>
            </div>
          )}
        </div>

        <div className="hero-cards">
          <h2>Your best matches</h2>
          <p className="muted">These areas most closely match your preferences.</p>
          {top3.map((area, idx) => (
            <div key={area.area} className="panel">
              <div className="row-between small-gap">
                <span className="pill">
                  {idx === 0 ? "Best match" : `Top match #${idx + 1}`}
                </span>
                <strong>{area.match}%</strong>
              </div>

              <h2>{area.area}</h2>
              <p className="muted">{area.borough}</p>

              <p className="fit-label">{scoreBand(area.match)}</p>

              <p className="muted compact">
                    Rent {money(area.averageRent)} pcm · Buy{" "}
                    {money(area.averageHousePrice)} · Commute{" "}
                    {area.commuteCityMinutes} mins
                  </p>

              <div className="tag-row">
                <span className="tag">Nightlife {area.nightlife}/5</span>
                    <span className="tag">Green {area.greenSpace}/5</span>
                    <span className="tag">Value {area.value}/5</span>
                    <span className="tag">Cycling {area.cycling}/5</span>
                    <span className="tag">Schools {area.schools}/5</span>
                    <span className="tag">Safety {area.safety}/5</span>
                    {area.tram ? <span className="tag">Tram</span> : null}
                    {area.train ? <span className="tag">Train</span> : null}
              </div>

              <div className="tag-row">
                <span className="tag">
                  Affordability {area.breakdown.affordability}
                </span>
                <span className="tag">Lifestyle {area.breakdown.lifestyle}</span>
                <span className="tag">Commute {area.breakdown.commute}</span>
              </div>

              <div className="property-links">
                {area.RentURL && (
                  <a
                    href={area.RentURL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="property-btn hero-btn"
                  >
                    View rentals
                  </a>
                )}

                {area.BuyURL && (
                  <a
                    href={area.BuyURL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="property-btn property-btn-secondary hero-btn"
                  >
                    View for sale
                  </a>
                )}
              </div>

            </div>
          ))}
        </div>
        <div><h2>The rest of your matches</h2>
          <p className="muted">These are the next best areas for you.</p>
        </div>
        <div className="panel">
          <div className="row-between wrap-gap">
            <div>

              <p className="muted">
                Showing {visibleResults.length} of {results.length} areas
              </p>
            </div>
          </div>

          <div className="results-list">
            {visibleResults.map((area, idx) => (
              <div key={area.area} className="result-card">
                <div className="result-rank">{idx + 1}</div>

                <div className="result-main">
                  <div className="result-title-row">
                    <h3>{area.area}</h3>
                    <span className="tag outline">{area.borough}</span>
                    <span className="tag dark">{scoreBand(area.match)}</span>
                  </div>

                  <p className="muted compact">
                    Rent {money(area.averageRent)} pcm · Buy{" "}
                    {money(area.averageHousePrice)} · Commute{" "}
                    {area.commuteCityMinutes} mins
                  </p>

                  <div className="tag-row">
                    <span className="tag">Nightlife {area.nightlife}/5</span>
                    <span className="tag">Green {area.greenSpace}/5</span>
                    <span className="tag">Value {area.value}/5</span>
                    <span className="tag">Cycling {area.cycling}/5</span>
                    <span className="tag">Schools {area.schools}/5</span>
                    <span className="tag">Safety {area.safety}/5</span>
                    {area.tram ? <span className="tag">Tram</span> : null}
                    {area.train ? <span className="tag">Train</span> : null}
                  </div>

                  <div className="tag-row">
  <span className="tag">
    Affordability {area.breakdown.affordability}
  </span>
  <span className="tag">Lifestyle {area.breakdown.lifestyle}</span>
  <span className="tag">Commute {area.breakdown.commute}</span>
 
</div>

<div className="property-links">
  {area.RentURL && (
    <a
      href={area.RentURL}
      target="_blank"
      rel="noopener noreferrer"
      className="property-btn"
    >
      View rentals
    </a>
  )}

  {area.BuyURL && (
    <a
      href={area.BuyURL}
      target="_blank"
      rel="noopener noreferrer"
      className="property-btn property-btn-secondary"
    >
      View for sale
    </a>
  )}
</div>

                </div>

                <div className="result-score">
                  <strong>{area.match}%</strong>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: "20px", display: "flex", gap: "10px" }}>
            {visibleCount < results.length && (
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
      </div>
    </div>
  );
}