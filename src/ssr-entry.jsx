// Entry point for the build-time prerender (scripts/prerender.mjs).
// Not used in the browser.
export { default as App } from "./App.jsx";
export { default as AreaPage, areaDescription } from "./AreaPage.jsx";
export { areaSlug, areaPath, SITE_URL } from "./slug.js";
export { default as areas } from "./areas.json";
export { default as areaPhotos } from "./areaPhotos.json";
