// Entry point for the build-time prerender (scripts/prerender.mjs).
// Not used in the browser.
import manchesterAreas from "./data/manchester/areas.json";
import manchesterPhotos from "./data/manchester/areaPhotos.json";

export { default as App } from "./App.jsx";
export { default as AreaPage, areaDescription } from "./AreaPage.jsx";
export { areaSlug, areaPath, SITE_URL } from "./slug.js";
export { default as PrivacyPage } from "./PrivacyPage.jsx";
export { CONTACT_IS_PLACEHOLDER } from "./site.js";
export { CITIES } from "./cities.js";

// Every city's data, keyed by city id (see src/cities.js).
export const cityData = {
  manchester: { areas: manchesterAreas, photos: manchesterPhotos },
};
