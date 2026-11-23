// Prerender the React app to static HTML so search engines see real content
// before any JavaScript runs.
//
// Runs after `vite build` (see the "build" script in package.json):
//   1. Builds a Node-friendly copy of src/App.jsx into a temporary folder.
//   2. Renders <App /> to HTML with react-dom/server, using its default settings.
//   3. Writes that HTML into <div id="root"> in dist/index.html and
//      dist/manchester.html, keeping each page's existing fallback text after it.
//   4. Deletes the temporary folder.
//
// src/main.jsx is unchanged: when JavaScript loads, React replaces everything
// inside #root with the live app, exactly as before.

import { build } from "vite";
import { readFile, writeFile, rm } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve, dirname } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tempDir = resolve(root, "node_modules/.prerender-tmp");
const pages = ["dist/index.html", "dist/manchester.html"];

const ROOT_OPEN = '<div id="root">';

async function renderApp() {
  await build({
    root,
    logLevel: "warn",
    build: {
      ssr: "src/App.jsx",
      outDir: tempDir,
      emptyOutDir: true,
      copyPublicDir: false,
      rollupOptions: { output: { entryFileNames: "app.mjs" } },
    },
  });

  const { default: App } = await import(pathToFileURL(resolve(tempDir, "app.mjs")).href);
  const React = await import("react");
  const { renderToString } = await import("react-dom/server");
  return renderToString(React.createElement(App));
}

function injectIntoPage(html, appHtml, file) {
  const start = html.indexOf(ROOT_OPEN);
  const bodyEnd = html.indexOf("</body>");
  const end = html.lastIndexOf("</div>", bodyEnd);

  if (start === -1 || bodyEnd === -1 || end <= start) {
    throw new Error(`${file}: could not find <div id="root"> ... </div>`);
  }

  const fallback = html.slice(start + ROOT_OPEN.length, end);
  if (fallback.includes("<div")) {
    throw new Error(`${file}: unexpected <div> inside the #root fallback`);
  }

  return (
    html.slice(0, start) +
    ROOT_OPEN +
    appHtml +
    fallback +
    html.slice(end)
  );
}

try {
  const appHtml = await renderApp();

  for (const page of pages) {
    const file = resolve(root, page);
    const html = await readFile(file, "utf8");
    await writeFile(file, injectIntoPage(html, appHtml, page));
    console.log(`prerendered ${page}`);
  }
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
