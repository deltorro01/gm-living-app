// Prerender pages to static HTML so search engines see real content before
// any JavaScript runs.
//
// Runs after `vite build` (see the "build" script in package.json):
//   1. Builds a Node-friendly copy of the app (src/ssr-entry.jsx) into a
//      temporary folder.
//   2. Writes the home page (dist/index.html) as the city chooser
//      (src/HomePage.jsx), a plain page with no app JavaScript.
//   3. For each city in src/cities.js: renders <App /> with its default
//      settings into <div id="root"> of the city's finder page (e.g.
//      dist/manchester.html), keeping the fallback text after it and turning
//      the area names in it into links; then writes a static guide page for
//      every area to dist/<city>/<area>/index.html, using the finder page's
//      <head> with its own title, description, canonical link and share tags.
//      These pages load no JavaScript.
//   4. Writes the privacy notice and dist/sitemap.xml (home page, each city
//      page and every area page).
//   5. Deletes the temporary folder.
//
// On the finder pages, src/main.jsx replaces everything inside #root with the
// live app when JavaScript loads.

import { build } from "vite";
import { readFile, writeFile, rm, mkdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve, dirname } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tempDir = resolve(root, "node_modules/.prerender-tmp");
const dist = resolve(root, "dist");

const ROOT_OPEN = '<div id="root">';

async function loadSsrModule() {
  await build({
    root,
    logLevel: "warn",
    build: {
      ssr: "src/ssr-entry.jsx",
      outDir: tempDir,
      emptyOutDir: true,
      copyPublicDir: false,
      rollupOptions: { output: { entryFileNames: "ssr.mjs" } },
    },
  });
  return import(pathToFileURL(resolve(tempDir, "ssr.mjs")).href);
}

// Find <div id="root"> ... </div> (the last </div> before </body>).
function rootSpan(html, file) {
  const start = html.indexOf(ROOT_OPEN);
  const bodyEnd = html.indexOf("</body>");
  const end = html.lastIndexOf("</div>", bodyEnd);
  if (start === -1 || bodyEnd === -1 || end <= start) {
    throw new Error(`${file}: could not find <div id="root"> ... </div>`);
  }
  const fallback = html.slice(start + ROOT_OPEN.length, end);
  if (fallback.includes("<div")) throw new Error(`${file}: unexpected <div> inside the #root fallback`);
  return { start, end, fallback };
}

function injectIntoPage(html, appHtml, file, transformFallback = (f) => f) {
  const { start, end, fallback } = rootSpan(html, file);
  return html.slice(0, start) + ROOT_OPEN + appHtml + transformFallback(fallback) + html.slice(end);
}

const escapeHtml = (text) =>
  String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Replace exactly one match, or stop the build.
function replaceOnce(html, pattern, replacement, what) {
  const matches = html.match(new RegExp(pattern.source, "g")) ?? [];
  if (matches.length !== 1) throw new Error(`area page template: expected one ${what}, found ${matches.length}`);
  return html.replace(pattern, replacement);
}

// Turn "<h2>Borough</h2> <p>Area, Area, Area.</p>" lists into links.
function linkAreaNames(fallback, ssr, city, areas) {
  const known = new Set(areas.map((a) => a.area));
  let linked = 0;
  const out = fallback.replace(/(<h2>[^<]+<\/h2>\s*<p>)([^<]+)(<\/p>)/g, (whole, open, list, close) => {
    const names = list.replace(/\.\s*$/, "").split(/,\s*/);
    if (!names.every((n) => known.has(n))) return whole; // not an area list: leave as it is
    linked += names.length;
    return open + names.map((n) => `<a href="${ssr.areaPath(n, city)}">${escapeHtml(n)}</a>`).join(", ") + "." + close;
  });
  return { out, linked };
}

function areaPageHtml(template, ssr, city, area, bodyHtml, photo) {
  const path = ssr.areaPath(area.area, city);
  return staticPageHtml(template, ssr, bodyHtml, {
    path,
    title: `Living in ${area.area}, ${city.region}: Rent, House Prices, Commute and Safety`,
    description: ssr.areaDescription(area, city),
    crumbs: [
      ["Home", "/"],
      [`${city.name} areas`, city.path],
      [area.area, path],
    ],
    photo,
  });
}

// A plain page (no app JavaScript) built from a city finder page's <head>,
// with its own title, description, canonical link, share tags and breadcrumb.
function staticPageHtml(template, ssr, bodyHtml, { path, title, description, crumbs, photo }) {
  const url = `${ssr.SITE_URL}${path}`;
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map(([name, href], i) => ({
      "@type": "ListItem",
      position: i + 1,
      name,
      item: `${ssr.SITE_URL}${href}`,
    })),
  };

  let html = template;
  html = replaceOnce(html, /<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`, "<title>");
  html = replaceOnce(html, /<meta\s+name="description"\s+content="[^"]*"\s*\/>/, `<meta name="description" content="${escapeHtml(description)}" />`, "description");
  html = html.replace(/<meta\s+name="keywords"\s+content="[^"]*"\s*\/>\s*/, "");
  html = replaceOnce(html, /<link rel="canonical" href="[^"]*"\s*\/>/, `<link rel="canonical" href="${url}" />`, "canonical link");
  html = replaceOnce(html, /<meta\s+property="og:title"\s+content="[^"]*"\s*\/>/, `<meta property="og:title" content="${escapeHtml(title)}" />`, "og:title");
  html = replaceOnce(html, /<meta\s+property="og:description"\s+content="[^"]*"\s*\/>/, `<meta property="og:description" content="${escapeHtml(description)}" />`, "og:description");
  html = replaceOnce(html, /<meta\s+property="og:url"\s+content="[^"]*"\s*\/>/, `<meta property="og:url" content="${url}" />`, "og:url");
  if (photo) {
    // Share image: this area's own photo instead of the general Manchester one.
    html = replaceOnce(
      html,
      /<meta\s+property="og:image"\s+content="[^"]*"\s*\/>/,
      `<meta property="og:image" content="${ssr.SITE_URL}${photo.src}" />\n<meta property="og:image:alt" content="${escapeHtml(photo.alt)}" />`,
      "og:image"
    );
  }
  // Static page: drop the app's JavaScript, keep its stylesheet.
  html = replaceOnce(html, /\s*<script type="module"[^>]*><\/script>/, "", "app script");
  html = html.replace(/\s*<link rel="modulepreload"[^>]*>/g, "");
  html = html.replace("</head>", `  <script type="application/ld+json">${JSON.stringify(breadcrumb)}</script>\n  </head>`);

  const { start, end } = rootSpan(html, "page template");
  return html.slice(0, start) + ROOT_OPEN + bodyHtml + html.slice(end);
}

function sitemap(ssr, today) {
  const urls = [{ loc: `${ssr.SITE_URL}/`, priority: "1.0" }];
  for (const city of Object.values(ssr.CITIES)) {
    urls.push({ loc: `${ssr.SITE_URL}${city.path}`, priority: "0.9" });
    for (const a of ssr.cityData[city.id].areas) urls.push({ loc: `${ssr.SITE_URL}${ssr.areaPath(a.area, city)}`, priority: "0.7" });
  }
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls
      .map((u) => `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${today}</lastmod>\n    <priority>${u.priority}</priority>\n  </url>`)
      .join("\n") +
    "\n</urlset>\n"
  );
}

try {
  const ssr = await loadSsrModule();

  // The contact email in src/site.js must be real before the site goes live.
  if (ssr.CONTACT_IS_PLACEHOLDER) {
    if (process.env.VERCEL_ENV === "production") {
      throw new Error("src/site.js still has the placeholder contact email. Add the real address before publishing.");
    }
    console.warn("WARNING: src/site.js has the placeholder contact email (fine for testing, blocked on the live site).");
  }

  const React = await import("react");
  const { renderToString, renderToStaticMarkup } = await import("react-dom/server");
  const cities = Object.values(ssr.CITIES);
  const homeCity = cities[0]; // its page's <head> is the template for the privacy notice

  // Read every city's finder page before changing anything (also the template
  // for its area guides).
  const templates = {};
  for (const city of cities) templates[city.id] = await readFile(resolve(dist, city.pageFile), "utf8");

  // 1. Home page: the city chooser, a plain page with no app JavaScript. It
  // keeps index.html's own title and share tags. home-redirect.js sends old
  // shared links (/?rent=... from when the home page was the Manchester
  // finder) on to /manchester with the same settings.
  const indexFile = resolve(dist, "index.html");
  let indexHtml = await readFile(indexFile, "utf8");
  const homeBody = renderToStaticMarkup(
    React.createElement(ssr.HomePage, { cities: cities.map((city) => ({ city, areas: ssr.cityData[city.id].areas })) })
  );
  indexHtml = replaceOnce(indexHtml, /\s*<script type="module"[^>]*><\/script>/, "", "app script");
  indexHtml = indexHtml.replace(/\s*<link rel="modulepreload"[^>]*>/g, "");
  indexHtml = indexHtml.replace("<head>", '<head>\n    <script src="/home-redirect.js"></script>');
  const { start: homeStart, end: homeEnd } = rootSpan(indexHtml, "dist/index.html");
  await writeFile(indexFile, indexHtml.slice(0, homeStart) + ROOT_OPEN + homeBody + indexHtml.slice(homeEnd));
  console.log("wrote dist/index.html (city chooser)");

  let pageCount = 1;
  for (const city of cities) {
    const { areas, photos } = ssr.cityData[city.id];
    const template = templates[city.id];
    const file = `dist/${city.pageFile}`;

    // 2. The city's finder page
    const appHtml = renderToString(React.createElement(ssr.App, { city, areas }));
    let linkedCount = 0;
    const page = injectIntoPage(template, appHtml, file, (fallback) => {
      const { out, linked } = linkAreaNames(fallback, ssr, city, areas);
      linkedCount = linked;
      return out;
    });
    if (linkedCount !== areas.length) {
      throw new Error(`${file}: linked ${linkedCount} area names, expected ${areas.length}`);
    }
    await writeFile(resolve(dist, city.pageFile), page);
    console.log(`prerendered ${file} (${linkedCount} area names linked)`);

    // 3. The city's area guide pages
    for (const area of areas) {
      const photo = photos[area.area];
      const body = renderToStaticMarkup(React.createElement(ssr.AreaPage, { area, areas, photo, city }));
      const dir = resolve(dist, city.path.replace(/^\//, ""), ssr.areaSlug(area.area));
      await mkdir(dir, { recursive: true });
      await writeFile(resolve(dir, "index.html"), areaPageHtml(template, ssr, city, area, body, photo));
    }
    console.log(`wrote ${areas.length} area pages to dist${city.path}/<area>/index.html`);
    pageCount += 1 + areas.length;
  }

  // 4. Privacy notice
  const privacyBody = renderToStaticMarkup(React.createElement(ssr.PrivacyPage));
  await mkdir(resolve(dist, "privacy"), { recursive: true });
  await writeFile(
    resolve(dist, "privacy", "index.html"),
    staticPageHtml(templates[homeCity.id], ssr, privacyBody, {
      path: "/privacy",
      title: "Privacy notice | Where Should I Live?",
      description: "How Where Should I Live uses information: what Google Analytics records, cookies, the map, hosting and your rights.",
      crumbs: [
        ["Home", "/"],
        ["Privacy", "/privacy"],
      ],
    })
  );
  console.log("wrote dist/privacy/index.html");

  // 5. Sitemap
  const today = new Date().toISOString().slice(0, 10);
  await writeFile(resolve(dist, "sitemap.xml"), sitemap(ssr, today));
  console.log(`wrote dist/sitemap.xml (${pageCount} pages)`);
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
