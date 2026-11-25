// Small pieces shared by the result cards: the "Why this match?" panel,
// the compare button and the side-by-side comparison table.

import { explainMatch } from "./explain.js";
import { areaPath } from "./slug.js";

export function WhyThisMatch({ area, settings }) {
  const { good, watch } = explainMatch(area, settings);
  return (
    <details className="why-match">
      <summary>Why this match?</summary>
      <ul>
        {good.map((text) => (
          <li key={text} className="why-good">
            <span aria-hidden="true">✓</span> {text}
          </li>
        ))}
        {watch.map((text) => (
          <li key={text} className="why-watch">
            <span aria-hidden="true">!</span> {text}
          </li>
        ))}
      </ul>
    </details>
  );
}

export function CompareButton({ name, compare, onToggle }) {
  const selected = compare.includes(name);
  const full = !selected && compare.length >= 3;
  return (
    <button
      type="button"
      className={selected ? "btn compare-btn is-selected" : "btn compare-btn"}
      aria-pressed={selected}
      disabled={full}
      title={full ? "You can compare up to 3 areas" : undefined}
      onClick={() => onToggle(name)}
    >
      {selected ? "✓ Comparing" : "Compare"}
    </button>
  );
}

export function CompareView({ city, areas, settings, money, onRemove, onClose }) {
  const rows = [
    ["Match", (a) => `${a.match}%`],
    ["Borough", (a) => a.borough],
    ["Rent", (a) => `${money(a.averageRent)} pcm`],
    ["Typical price", (a) => money(a.averageHousePrice)],
    ["To city centre", (a) => `About ${a.commuteCityMinutes} mins`],
    ["Tram stop", (a) => (a.tram ? "Yes" : "No")],
    ["Train station", (a) => (a.train ? "Yes" : "No")],
    ["Safety", (a) => `${a.safety}/5`],
    ["Schools", (a) => `${a.schools}/5`],
    ["Green space", (a) => `${a.greenSpace}/5`],
    ["Value for money", (a) => `${a.value}/5`],
    ["Nightlife", (a) => `${a.nightlife}/5`],
    ["Cycling", (a) => `${a.cycling}/5`],
  ];
  return (
    <section className="panel compare-view" aria-label="Area comparison">
      <div className="row-between wrap-gap">
        <h2 className="heading-flush">Compare areas</h2>
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Close comparison
        </button>
      </div>
      {areas.length < 2 && <p className="muted">Choose at least two areas with the Compare button.</p>}
      <div className="compare-scroll">
        <table className="compare-table">
          <thead>
            <tr>
              <th scope="col">
                <span className="visually-hidden">Measure</span>
              </th>
              {areas.map((a) => (
                <th key={a.area} scope="col">
                  <a href={areaPath(a.area, city)}>{a.area}</a>
                  <button type="button" className="compare-remove" onClick={() => onRemove(a.area)} aria-label={`Remove ${a.area}`}>
                    ×
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                {areas.map((a) => (
                  <td key={a.area}>{value(a)}</td>
                ))}
              </tr>
            ))}
            <tr>
              <th scope="row">Why</th>
              {areas.map((a) => {
                const { good, watch } = explainMatch(a, settings);
                return (
                  <td key={a.area}>
                    <ul className="compare-why">
                      {good.map((t) => (
                        <li key={t} className="why-good">✓ {t}</li>
                      ))}
                      {watch.map((t) => (
                        <li key={t} className="why-watch">! {t}</li>
                      ))}
                    </ul>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
