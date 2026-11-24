// Footer shown on every page: the finder pages, the area guides and the
// privacy notice.

import { SITE_NAME, COPYRIGHT_YEAR, CONTACT_EMAIL } from "./site.js";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <span>
        © {COPYRIGHT_YEAR} {SITE_NAME}
      </span>
      <nav aria-label="Footer">
        <a href="/privacy">Privacy</a>
        <a href={`mailto:${CONTACT_EMAIL}`}>Contact us</a>
      </nav>
    </footer>
  );
}
