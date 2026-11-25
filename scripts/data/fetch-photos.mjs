// Find freely licensed photos of each area on Wikimedia Commons, for review.
//
// For each area it collects up to MAX_CANDIDATES photos:
//   1. the lead photo of the area's English Wikipedia article (matched by name
//      and checked against the area's map point), and
//   2. the nearest geotagged photos on Wikimedia Commons within NEARBY_M.
// Only JPEG photos under licences that allow reuse on this site are kept
// (public domain, CC0, CC BY, CC BY-SA). Photographer, licence and source page
// are recorded so the photo can be credited.
//
// Requests are sent one at a time with a pause between them, as Wikimedia asks.
//
// Usage: node scripts/data/fetch-photos.mjs
// Writes scripts/data/out/photo-candidates.json (used by the review page and
// by apply-photos.mjs). Nothing on the site changes.

import { readFile, writeFile } from "node:fs/promises";
import { CITY, args, OUT, AREAS_FILE, PHOTOS_FILE, SETTINGS_FOR_CITY, readOut, optionalOut } from "./city.mjs";

const MAX_CANDIDATES = 4;
const NEARBY_M = 1500;
const PAUSE_MS = 1200;
const THUMB_WIDTH = 1280; // a standard Wikimedia thumbnail width
// Wikimedia asks automated tools to identify themselves with a website address.
const HEADERS = { "User-Agent": "WhereShouldILiveAreaGuides/1.0 (https://www.whereshouldiliveinthe.uk/) Node.js" };

const areas = JSON.parse(await readFile(AREAS_FILE, "utf8"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    await sleep(PAUSE_MS);
    const res = await fetch(url, { headers: HEADERS });
    const text = await res.text();
    // Wikimedia sometimes answers "OK" with an error inside (e.g. too busy); retry those too.
    const json = res.ok && text.startsWith("{") ? JSON.parse(text) : null;
    if (json && !json.error) return json;
    const wait = 30000 * attempt;
    console.log(`  busy (${json?.error?.code ?? res.status}), waiting ${wait / 1000}s`);
    await sleep(wait);
  }
  throw new Error(`gave up on ${url}`);
}

function distanceKm(a, b) {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

// 1. Wikipedia lead photos, 40 titles per request, trying name variants in turn.
const lead = {};
let todo = areas;
// Wikipedia article titles to try, e.g. "Allerton, Merseyside", then "Allerton, Liverpool", then "Allerton".
const counties = SETTINGS_FOR_CITY.wikiCounties ?? ["Greater Manchester"];
const variants = [...counties.map((c) => (a) => `${a.area}, ${c}`), (a) => `${a.area}, ${a.borough}`, (a) => a.area];
for (const variant of variants) {
  const next = [];
  for (let i = 0; i < todo.length; i += 40) {
    const group = todo.slice(i, i + 40);
    const url =
      "https://en.wikipedia.org/w/api.php?action=query&format=json&redirects=1&prop=pageimages|coordinates" +
      "&piprop=name&pilicense=free&titles=" +
      encodeURIComponent(group.map(variant).join("|"));
    const q = (await getJson(url)).query ?? {};
    const from = {};
    for (const n of q.normalized ?? []) from[n.to] = n.from;
    for (const r of q.redirects ?? []) from[r.to] = from[r.from] ?? r.from;
    const pages = {};
    for (const p of Object.values(q.pages ?? {})) pages[from[p.title] ?? p.title] = p;
    for (const a of group) {
      const p = pages[variant(a)];
      const c = p?.coordinates?.[0];
      if (p && !("missing" in p) && p.pageimage && c && distanceKm(a, { lat: c.lat, lng: c.lon }) < 6) {
        lead[a.area] = { file: `File:${p.pageimage}`, article: p.title };
      } else next.push(a);
    }
  }
  todo = next;
  console.log(`after "${variant({ area: "X", borough: "B" })}": ${Object.keys(lead).length} lead photos`);
}

// 2. Nearby geotagged Commons photos.
const nearby = {};
for (const [i, a] of areas.entries()) {
  const url =
    "https://commons.wikimedia.org/w/api.php?action=query&format=json&list=geosearch&gsnamespace=6" +
    `&gscoord=${a.lat}|${a.lng}&gsradius=${NEARBY_M}&gslimit=50`;
  nearby[a.area] = ((await getJson(url)).query?.geosearch ?? []).map((g) => ({ file: g.title, distM: Math.round(g.dist) }));
  if ((i + 1) % 20 === 0) console.log(`nearby photos checked for ${i + 1} of ${areas.length} areas`);
}

// 3. Licence, photographer and thumbnail for every file, 10 per request
// (larger batches can come back only partly filled, silently dropping photos).
const allFiles = [...new Set([...Object.values(lead).map((l) => l.file), ...Object.values(nearby).flat().map((n) => n.file)])];
const info = {};
// Files that come back without details are asked for again (up to 3 more times).
let pending = allFiles;
for (let pass = 1; pass <= 4 && pending.length; pass++) {
  for (let i = 0; i < pending.length; i += 10) {
    const url =
      "https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo" +
      `&iiprop=url|extmetadata|size|mime&iiurlwidth=${THUMB_WIDTH}&titles=` +
      encodeURIComponent(pending.slice(i, i + 10).join("|"));
    const q = (await getJson(url)).query ?? {};
    const from = {};
    for (const n of q.normalized ?? []) from[n.to] = n.from;
    for (const p of Object.values(q.pages ?? {})) {
      const ii = p.imageinfo?.[0];
      if (ii?.thumburl) info[from[p.title] ?? p.title] = ii;
    }
  }
  pending = pending.filter((f) => !info[f]);
  if (pending.length) console.log(`pass ${pass}: ${pending.length} files still without details`);
}
console.log(`licence details fetched for ${Object.keys(info).length} files`);

const strip = (html = "") => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const ALLOWED = /^(public domain|pd|cc0|cc by(-sa)? [\d.]+)/i;

function describe(file, why) {
  const ii = info[file];
  if (!ii || ii.mime !== "image/jpeg" || ii.width < 800 || ii.width < ii.height * 0.9) return null; // photos, landscape-ish, big enough
  const m = ii.extmetadata ?? {};
  const licence = strip(m.LicenseShortName?.value);
  if (!ALLOWED.test(licence)) return null;
  return {
    file,
    why,
    thumb: ii.thumburl,
    page: ii.descriptionurl,
    width: ii.thumbwidth,
    height: ii.thumbheight,
    author: strip(m.Artist?.value) || "Unknown",
    licence,
    licenceUrl: m.LicenseUrl?.value ?? null,
    description: strip(m.ImageDescription?.value).slice(0, 200),
  };
}

const results = areas.map((a) => {
  const list = [];
  const seen = new Set();
  const add = (file, why) => {
    if (seen.has(file) || list.length >= MAX_CANDIDATES) return;
    const d = describe(file, why);
    if (d) {
      list.push(d);
      seen.add(file);
    }
  };
  if (lead[a.area]) add(lead[a.area].file, `Wikipedia photo for ${lead[a.area].article}`);
  for (const n of nearby[a.area]) add(n.file, `Taken ${n.distM} m from the area's centre`);
  return { area: a.area, borough: a.borough, candidates: list };
});

await writeFile(new URL("photo-candidates.json", OUT), JSON.stringify(results, null, 2) + "\n");
const withAny = results.filter((r) => r.candidates.length).length;
const withLead = results.filter((r) => r.candidates[0]?.why.startsWith("Wikipedia")).length;
console.log(`areas with at least one usable photo: ${withAny} of ${areas.length} (Wikipedia lead photo usable: ${withLead})`);
console.log(`none: ${results.filter((r) => !r.candidates.length).map((r) => r.area).join(", ") || "-"}`);
console.log(`written photo-candidates.json for ${CITY}`);
