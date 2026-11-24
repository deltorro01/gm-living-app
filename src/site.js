// Site-wide details used by the footer and the privacy notice.

export const SITE_NAME = "Where Should I Live In The UK";
export const COPYRIGHT_YEAR = 2026;

// Forwarded by ImprovMX (MX records set at 123 Reg). If this is ever set back
// to an @example.com placeholder, production builds on Vercel stop with an
// error (see scripts/prerender.mjs), so a placeholder can't be published.
export const CONTACT_EMAIL = "contact@whereshouldiliveinthe.uk";

export const CONTACT_IS_PLACEHOLDER = CONTACT_EMAIL.endsWith("@example.com");

export const PRIVACY_UPDATED = "24 November 2026";
