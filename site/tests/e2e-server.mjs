// The whole order + points chain on the laptop, nothing sent anywhere: public/ (python site/build.py) served as
// Vercel would, /api/order/ run by the real api/order.js, and the back office run by the real cloud/worker.js on an
// in-memory SQLite D1. Telegram is answered here (each message kept, GET /test/telegram); Stripe is off.
//   node site/tests/e2e-server.mjs 8792
// The browser test (site/tests/points_e2e.py) points the site's back office URL at /cloud/ with a Playwright route.
// Test-only routes: POST /test/status {id, status} (the owner's admin), GET /test/points?phone=, GET /test/telegram.
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, writeFileSync, mkdtempSync } from "node:fs";
import { join, dirname, extname, normalize } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { bundle } from "../../cloud/build.mjs";
import { fakeD1 } from "../../cloud/tests/d1.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PUB = join(ROOT, "public");
const PORT = Number(process.argv[2] || 8792);
const BASE = `http://127.0.0.1:${PORT}`;
const SECRET = "e2e-ingest", KEY = "e2e-admin";

const dir = mkdtempSync(join(tmpdir(), "almas-e2e-"));
writeFileSync(join(dir, "worker.mjs"), bundle(), "utf8");
const worker = (await import(pathToFileURL(join(dir, "worker.mjs")).href)).default;
const env = { DB: fakeD1(join(ROOT, "cloud", "schema.sql")), INGEST_SECRET: SECRET, ADMIN_KEY: KEY, SESSION_SECRET: "e2e-session" };

const telegrams = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = String(input && input.url ? input.url : input);
  if (url.startsWith("https://api.telegram.org/")) {
    telegrams.push(JSON.parse(init.body).text);
    return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
  }
  return realFetch(input, init);
};
process.env.TELEGRAM_BOT_TOKEN = "e2e";
process.env.TELEGRAM_CHAT_IDS = "1";
process.env.ALMAS_CLOUD_URL = BASE + "/cloud";
process.env.ALMAS_CLOUD_SECRET = SECRET;
delete process.env.STRIPE_SECRET_KEY;
const order = (await import(pathToFileURL(join(ROOT, "api", "order.js")).href)).default;

const toWorker = (path, init = {}) => worker.fetch(new Request("https://almas-shop.test" + path, init), env);
const login = await toWorker("/admin/api/login", { method: "POST", headers: { "content-type": "application/json", "X-Almas-Csrf": "1" }, body: JSON.stringify({ key: KEY }) });
const cookie = login.headers.get("Set-Cookie").split(";")[0];
const admin = (path, body) => toWorker("/admin/api/" + path, body === undefined ? { headers: { Cookie: cookie } }
  : { method: "POST", headers: { Cookie: cookie, "X-Almas-Csrf": "1", "content-type": "application/json" }, body: JSON.stringify(body) });

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".webp": "image/webp" };

function readBody(req) {
  return new Promise((ok) => { const c = []; req.on("data", (d) => c.push(d)); req.on("end", () => ok(Buffer.concat(c).toString("utf8"))); });
}
async function send(res, r) {
  const h = {};
  r.headers.forEach((v, k) => { h[k] = v; });
  res.writeHead(r.status, h);
  res.end(Buffer.from(await r.arrayBuffer()));
}

createServer(async (req, res) => {
  try {
    const u = new URL(req.url, BASE);
    if (u.pathname.startsWith("/cloud/")) {
      const body = req.method === "GET" || req.method === "HEAD" ? undefined : await readBody(req);
      const headers = { ...req.headers, "cf-connecting-ip": "127.0.0.1" };
      return send(res, await toWorker(u.pathname.slice(6) + u.search, { method: req.method, headers, body }));
    }
    if (u.pathname === "/admin" || u.pathname.startsWith("/admin/")) { // the owner's back office, for a look at it
      const body = req.method === "GET" || req.method === "HEAD" ? undefined : await readBody(req);
      const headers = { ...req.headers, "cf-connecting-ip": "127.0.0.2" };
      if (headers.origin) headers.origin = "https://almas-shop.test";
      const r = await toWorker(u.pathname + u.search, { method: req.method, headers, body });
      const h = {};
      r.headers.forEach((v, k) => { h[k] = k === "set-cookie" ? v.replace(/; ?Secure/i, "") : v; });
      res.writeHead(r.status, h);
      return res.end(Buffer.from(await r.arrayBuffer()));
    }
    if (u.pathname === "/api/order/" || u.pathname === "/api/order") {
      const raw = await readBody(req);
      const vreq = { method: req.method, headers: req.headers, body: raw ? JSON.parse(raw) : {}, query: Object.fromEntries(u.searchParams) };
      let code = 200;
      const vres = { status(c) { code = c; return vres; }, json(o) { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(o)); return vres; } };
      return await order(vreq, vres);
    }
    if (u.pathname === "/test/status") return send(res, await admin("order", JSON.parse(await readBody(req))));
    if (u.pathname === "/test/points") return send(res, await admin("customer?phone=" + encodeURIComponent(u.searchParams.get("phone"))));
    if (u.pathname === "/test/telegram") { res.writeHead(200, { "content-type": "application/json" }); return res.end(JSON.stringify(telegrams)); }
    let file = normalize(join(PUB, decodeURIComponent(u.pathname)));
    if (!file.startsWith(PUB)) { res.writeHead(403); return res.end(); }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    if (!existsSync(file)) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream" });
    res.end(readFileSync(file));
  } catch (e) {
    console.error(e);
    res.writeHead(500);
    res.end(String(e && e.stack));
  }
}).listen(PORT, "127.0.0.1", () => console.log("e2e server on " + BASE));
