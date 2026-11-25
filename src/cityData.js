// Loads one city's area data in the browser. Each city's file is a separate
// download, so visitors only fetch the city they are looking at.
// (The build-time prerender imports every city directly: see ssr-entry.jsx.)

const LOADERS = {
  manchester: () => import("./data/manchester/areas.json"),
  liverpool: () => import("./data/liverpool/areas.json"),
};

export async function loadAreas(cityId) {
  const loader = LOADERS[cityId];
  if (!loader) throw new Error(`No area data for city "${cityId}"`);
  return (await loader()).default;
}
