// The home page at /: choose a city, then go to its finder. Rendered to static
// HTML at build time by scripts/prerender.mjs; it loads no app JavaScript.

import SiteFooter from "./SiteFooter.jsx";
import { PhotoCredit } from "./AreaPage.jsx";

// cities: [{ city, areas }] in the order to show them.
export default function HomePage({ cities }) {
  const total = cities.reduce((n, c) => n + c.areas.length, 0);
  return (
    <div className="app-shell">
      <div className="page-wrap home-page">
        <div className="panel section-gap">
          <div className="eyebrow">Where Should I Live In The UK</div>
          <h1 className="page-title">Find the right place to live</h1>
          <p className="intro-text">
            Tell us your budget, commute and what matters to you, and we'll rank {total} areas by how well they fit. Rents,
            house prices, safety, schools and travel times come from official data. Choose a city to start.
          </p>
        </div>

        <div className="city-cards">
          {cities.map(({ city, areas }) => {
            const boroughs = [...new Set(areas.map((a) => a.borough))];
            return (
              <section key={city.id} className="panel city-card" aria-labelledby={`city-${city.id}`}>
                {city.homePhoto && (
                  <figure className="area-photo">
                    <a href={city.path} tabIndex={-1} aria-hidden="true">
                      <img src={city.homePhoto.src} width={city.homePhoto.width} height={city.homePhoto.height} alt="" />
                    </a>
                    <PhotoCredit photo={city.homePhoto} />
                  </figure>
                )}
                <h2 id={`city-${city.id}`}>{city.region}</h2>
                <p className="muted">
                  {areas.length} areas across {boroughs.length} boroughs: {boroughs.join(", ")}.
                </p>
                <a className="btn btn-primary city-card-btn" href={city.path}>
                  Find your area in {city.name}
                </a>
              </section>
            );
          })}
        </div>

        <SiteFooter />
      </div>
    </div>
  );
}
