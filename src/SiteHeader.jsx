// Header shown at the top of every page: the home page, the finder pages, the
// area guides and the privacy notice.
//
// Most of those pages load no app JavaScript, so the Cities dropdown is a plain
// <details> element: it opens and closes without any script.
//
// current: "home", a city id (e.g. "manchester"), or nothing (other pages).

import { CITIES } from "./cities.js";
import { SITE_NAME } from "./site.js";

// The purple map pin, the same shape as public/favicon-pin.svg.
function PinLogo() {
  return (
    <svg className="site-logo" width="36" height="36" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="site-pin-gradient" x1="8" y1="2" x2="40" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#c084fc" />
          <stop offset="0.5" stopColor="#863bff" />
          <stop offset="1" stopColor="#4c1d95" />
        </linearGradient>
        <radialGradient id="site-pin-glow" cx="0.3" cy="0.25" r="0.6">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.45" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d="M24 46C24 46 9 31.5 9 18a15 15 0 0 1 30 0C39 31.5 24 46 24 46Z" fill="url(#site-pin-gradient)" />
      <path d="M24 46C24 46 9 31.5 9 18a15 15 0 0 1 30 0C39 31.5 24 46 24 46Z" fill="url(#site-pin-glow)" />
      <circle cx="24" cy="18" r="6" fill="#ffffff" />
    </svg>
  );
}

export default function SiteHeader({ current }) {
  const cities = Object.values(CITIES);
  const onCity = cities.some((c) => c.id === current);

  return (
    <header className="site-header">
      <a className="site-brand" href="/" aria-label={`${SITE_NAME}, home`}>
        <PinLogo />
        <span className="site-title site-title-full">{SITE_NAME}</span>
        <span className="site-title site-title-short" aria-hidden="true">
          Where Should I Live?
        </span>
      </a>

      <nav className="site-nav" aria-label="Main">
        <a className="site-nav-link" href="/" aria-current={current === "home" ? "page" : undefined}>
          Home
        </a>
        <details className="site-nav-menu">
          <summary className={onCity ? "site-nav-link is-current" : "site-nav-link"}>
            Cities <span className="site-nav-caret" aria-hidden="true">▾</span>
          </summary>
          <ul className="site-nav-dropdown">
            {cities.map((c) => (
              <li key={c.id}>
                <a href={c.path} aria-current={c.id === current ? "page" : undefined}>
                  {c.region}
                </a>
              </li>
            ))}
          </ul>
        </details>
      </nav>
    </header>
  );
}
