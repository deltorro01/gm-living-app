// Privacy notice, served at /privacy. Rendered to static HTML at build time by
// scripts/prerender.mjs; it loads no app JavaScript.
//
// Keep this in step with what the site actually does. If a new service is
// added (for example a different analytics tool or a contact form), update it.

import SiteHeader from "./SiteHeader.jsx";
import SiteFooter from "./SiteFooter.jsx";
import { SITE_NAME, CONTACT_EMAIL, PRIVACY_UPDATED } from "./site.js";

const ext = { target: "_blank", rel: "noopener noreferrer" };

export default function PrivacyPage() {
  return (
    <div className="app-shell">
      <SiteHeader />
      <div className="page-wrap text-page">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <a href="/">Home</a> <span aria-hidden="true">›</span> <span aria-current="page">Privacy</span>
        </nav>

        <div className="panel section-gap">
          <h1>Privacy notice</h1>
          <p className="muted">Last updated: {PRIVACY_UPDATED}</p>

          <h2>In short</h2>
          <p>
            You don't need an account to use this site, and we don't ask for your name, email or any other personal
            details. If you agree, we use Google Analytics to see how many people visit and which pages they use, so we
            can improve the site. If you don't agree, it isn't used.
          </p>

          <h2>Who we are</h2>
          <p>
            This site, {SITE_NAME} (whereshouldiliveinthe.uk), is responsible for the information described here. You can
            contact us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </p>

          <h2>What we collect and why</h2>
          <h3>Google Analytics</h3>
          <p>
            We use Google Analytics to understand how the site is used: which pages are visited, roughly where visitors
            are (to town or city level), what kind of device and browser they use, and how they found the site. Google
            Analytics uses cookies to tell visits apart. These are called <code>_ga</code> and <code>_ga_…</code> and
            last up to two years. Google Analytics does not store your IP address. We only look at overall figures, not
            individual visitors.
          </p>
          <p>
            <strong>We only use Google Analytics if you choose "Accept"</strong> on the cookie message. If you choose
            "Reject", or make no choice, it isn't loaded and no analytics cookies are set. We rely on your consent for
            this, and you can change your mind at any time with the "Cookie settings" link at the bottom of every page.
            If you withdraw consent, we delete the Google Analytics cookies from your browser.
          </p>
          <p>
            Google processes this information for us. You can read{" "}
            <a href="https://policies.google.com/privacy" {...ext}>
              Google's privacy policy
            </a>
            . To stop Google Analytics on every site you visit, you can also block cookies in your browser or install the{" "}
            <a href="https://tools.google.com/dlpage/gaoptout" {...ext}>
              Google Analytics opt-out browser add-on
            </a>
            .
          </p>

          <h3>Your search settings</h3>
          <p>
            When you change settings such as your budget or life stage, they are added to the web address so you can
            bookmark or share your results. This happens in your browser. We don't keep a record of your choices. Your
            answer to the cookie message is saved in your browser's own storage (not a cookie) so we don't ask again on
            every page. The site doesn't use any other cookies.
          </p>

          <h3>The map</h3>
          <p>
            If you open the map, the map images are loaded from OpenStreetMap's servers, which receive your IP address
            and browser details in the normal way. See the{" "}
            <a href="https://osmfoundation.org/wiki/Privacy_Policy" {...ext}>
              OpenStreetMap Foundation privacy policy
            </a>
            . The map is only loaded if you choose to open it.
          </p>

          <h3>Hosting</h3>
          <p>
            The site is hosted by Vercel. Like any website host, Vercel's servers briefly record technical details of
            each request, such as your IP address and the page requested, to deliver the site and keep it secure. See{" "}
            <a href="https://vercel.com/legal/privacy-policy" {...ext}>
              Vercel's privacy policy
            </a>
            .
          </p>

          <h3>Links to other sites</h3>
          <p>
            Links such as "View rentals" and "View for sale" take you to Rightmove, and photo credits link to Wikimedia
            Commons. Those sites have their own privacy policies.
          </p>

          <h2>Your rights</h2>
          <p>
            You have rights over your personal information, including the right to ask what we hold about you and to ask
            us to delete it. Because we don't collect names or contact details, we usually can't link analytics data to
            you, but you can still contact us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> with any
            question. If you're unhappy with how we handle your information, you can complain to the{" "}
            <a href="https://ico.org.uk/make-a-complaint/" {...ext}>
              Information Commissioner's Office
            </a>
            .
          </p>

          <h2>Changes to this notice</h2>
          <p>If we change how we use information, we'll update this page and the date at the top.</p>
        </div>

        <SiteFooter />
      </div>
    </div>
  );
}
