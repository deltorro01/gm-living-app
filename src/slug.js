import { CITIES, DEFAULT_CITY } from "./cities.js";

// Web address of each area's guide page, e.g. "Hale Barns" -> /manchester/hale-barns
export function areaSlug(name) {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function areaPath(name, city = CITIES[DEFAULT_CITY]) {
  return `${city.path}/${areaSlug(name)}`;
}

export const SITE_URL = "https://www.whereshouldiliveinthe.uk";
