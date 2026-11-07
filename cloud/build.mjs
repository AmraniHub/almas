// Inline cloud/admin/{index.html,app.js,app.css} into cloud/worker.js -> one module for the Cloudflare upload.
//   node cloud/build.mjs <out.js>          write the bundle (deploy.py does this, then node --check)
// The tests import bundle() so they run exactly what is deployed. ALMAS_WORKER_SRC overrides the source file
// (the sabotage runner points it at a deliberately broken copy).
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const MARK = /\/\*ASSETS\*\/\{\}\/\*END\*\//;

export function bundle(src = process.env.ALMAS_WORKER_SRC || join(HERE, "worker.js")) {
  const code = readFileSync(src, "utf8");
  if (!MARK.test(code)) throw new Error("worker.js lost its ASSETS placeholder");
  const assets = {};
  for (const name of ["index.html", "app.js", "app.css"]) assets[name] = readFileSync(join(HERE, "admin", name), "utf8").replace(/\r\n/g, "\n");
  return code.replace(MARK, () => JSON.stringify(assets));
}

const self = (p) => resolve(p).toLowerCase(); // Windows: drive-letter case and slashes differ between the two
if (process.argv[1] && self(fileURLToPath(import.meta.url)) === self(process.argv[1])) {
  const out = process.argv[2];
  if (!out) throw new Error("usage: node build.mjs <out.js>");
  writeFileSync(out, bundle(), "utf8");
}
