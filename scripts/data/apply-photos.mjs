// Download the chosen area photos and record their credits.
//
// Reads the choices made on photo-review.html (scripts/data/out/photo-choices.json,
// { "Area name": "File:...jpg" | null }) and the candidate details from
// scripts/data/out/photo-candidates.json, then:
//   - downloads each chosen photo (960 pixels wide, or smaller originals as
//     they are) from Wikimedia to public/images/areas/<area-slug>.jpg (served
//     at /images/areas/...), slowly, and can resume if Wikimedia is busy;
//   - writes src/areaPhotos.json with the photographer, licence and source
//     page for each photo, used for the credit line on the area pages.
// Areas with no choice (or null) get no photo.
//
// Usage: node scripts/data/apply-photos.mjs

import { readFile, writeFile, mkdir, rm, stat } from "node:fs/promises";
import { areaSlug } from "../../src/slug.js";

const PAUSE_MS = 5000;
const WIDTH = 960; // a standard Wikimedia thumbnail width; plenty for the page
// Wikimedia asks automated tools to identify themselves with a website address.
const HEADERS = { "User-Agent": "WhereShouldILiveAreaGuides/1.0 (https://www.whereshouldiliveinthe.uk/) Node.js" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const read = async (p) => JSON.parse(await readFile(new URL(p, import.meta.url), "utf8"));
const choices = await read("./out/photo-choices.json");
const candidates = await read("./out/photo-candidates.json");
const outDir = new URL("../../public/images/areas/", import.meta.url);
await mkdir(outDir, { recursive: true });

// Which file was saved for each area, so a rerun can skip finished downloads.
const LOG = new URL("./out/photo-downloads.json", import.meta.url);
const downloaded = await read("./out/photo-downloads.json").catch(() => ({}));

// Address of the photo at WIDTH pixels wide (Wikimedia only serves standard widths).
// Smaller originals are used as they are.
function sizedUrl(c) {
  if (c.width <= WIDTH) return { url: c.thumb, width: c.width, height: c.height };
  const height = Math.round((c.height * WIDTH) / c.width);
  if (/\/\d+px-/.test(c.thumb)) return { url: c.thumb.replace(/\/\d+px-/, `/${WIDTH}px-`), width: WIDTH, height };
  // An unscaled original: build the thumbnail address from it.
  const m = c.thumb.match(/^(https:\/\/upload\.wikimedia\.org\/wikipedia\/commons)\/([0-9a-f])\/([0-9a-f]{2})\/([^?]+)/);
  if (!m) return { url: c.thumb, width: c.width, height: c.height };
  return { url: `${m[1]}/thumb/${m[2]}/${m[3]}/${m[4]}/${WIDTH}px-${m[4]}`, width: WIDTH, height };
}

// Short description for screen readers, from the photo's own caption.
function altText(area, description = "") {
  const text = description.replace(/\s+/g, " ").trim();
  if (!text) return `A view of ${area}`;
  let sentence = text.split(/(?<=[.!?])\s/)[0].replace(/\.$/, "");
  // Captions like "Pigeon Street" mean little on their own, so say where it is.
  if (!sentence.toLowerCase().includes(area.toLowerCase())) sentence = `${area}: ${sentence}`;
  return sentence.length <= 120 ? sentence : `${sentence.slice(0, 117).trim()}…`;
}

const photos = {};
for (const { area, candidates: list } of candidates) {
  const slug = areaSlug(area);
  const target = new URL(`${slug}.jpg`, outDir);
  const chosen = choices[area] ? list.find((c) => c.file === choices[area]) : null;
  if (!chosen) {
    await rm(target, { force: true });
    continue;
  }
  const { url, width, height } = sizedUrl(chosen);
  photos[area] = {
    src: `/images/areas/${slug}.jpg`,
    width,
    height,
    author: chosen.author,
    licence: chosen.licence,
    licenceUrl: chosen.licenceUrl,
    page: chosen.page,
    alt: altText(area, chosen.description),
  };

  // Already downloaded on an earlier run (same size): keep it.
  const existing = await stat(target).catch(() => null);
  const record = downloaded[slug];
  if (existing?.size > 0 && record === url) continue;

  let res;
  for (let attempt = 1; attempt <= 6; attempt++) {
    await sleep(PAUSE_MS);
    res = await fetch(url, { headers: HEADERS });
    if (res.status !== 429 && res.status < 500) break;
    console.log(`  ${area}: busy (${res.status}), waiting ${60 * attempt}s`);
    await sleep(60000 * attempt);
  }
  if (!res.ok || !res.headers.get("content-type")?.startsWith("image/jpeg")) {
    throw new Error(`${area}: download failed (${res.status} ${res.headers.get("content-type")}); run again to resume`);
  }
  await writeFile(target, Buffer.from(await res.arrayBuffer()));
  downloaded[slug] = url;
  await writeFile(LOG, JSON.stringify(downloaded, null, 2));
  console.log(`saved ${slug}.jpg`);
}

await writeFile(new URL("../../src/areaPhotos.json", import.meta.url), JSON.stringify(photos, null, 2) + "\n");
console.log(`photos for ${Object.keys(photos).length} areas; written src/areaPhotos.json`);
