// Web address of each area's guide page, e.g. "Hale Barns" -> /manchester/hale-barns
export function areaSlug(name) {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function areaPath(name) {
  return `/manchester/${areaSlug(name)}`;
}

export const SITE_URL = "https://www.whereshouldiliveinthe.uk";
