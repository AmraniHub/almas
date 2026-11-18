// Web Push for the installed web app: a browser subscription registers (and is tied to a customer only with proof),
// broadcasts and order updates reach it encrypted (RFC 8291 aes128gcm) with a valid VAPID signature (RFC 8292), a
// broadcast goes out in batches, and a subscription the push service calls gone is deleted. The push service is a
// stand-in; the "browser" decrypts each message here with its own private key, as Chrome would.
//   node --test cloud/tests/webpush.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { webcrypto as wc } from "node:crypto";
import { bundle } from "../build.mjs";
import { fakeD1 } from "./d1.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = "https://almas-shop.example.workers.dev";
const SECRET = "ingest-secret-for-tests";
const KEY = "admin-key-for-tests";
const SITE = "https://almas5.com";
const enc = new TextEncoder();
const b64u = (b) => Buffer.from(b).toString("base64url");
let worker, env, cookie = "", seq = 0, vapidPub;
const delivered = []; // {endpoint, headers, body}
let gone = new Set();
const realFetch = globalThis.fetch;
const browsers = {}; // endpoint -> {priv, pub, auth}

async function hkdf(salt, ikm, info, len) {
  const k = await wc.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await wc.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, k, len * 8));
}
const join2 = (...p) => Buffer.concat(p.map((x) => Buffer.from(x)));
// the browser side of RFC 8291: read the header, derive the same key, decrypt, drop the 0x02 padding delimiter
async function decrypt(endpoint, body) {
  const b = browsers[endpoint];
  const buf = new Uint8Array(body);
  const salt = buf.slice(0, 16), rs = new DataView(buf.buffer, buf.byteOffset + 16, 4).getUint32(0), idlen = buf[20];
  const asPub = buf.slice(21, 21 + idlen), ct = buf.slice(21 + idlen);
  assert.equal(rs, 4096);
  const asKey = await wc.subtle.importKey("raw", asPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await wc.subtle.deriveBits({ name: "ECDH", public: asKey }, b.priv, 256));
  const ikm = await hkdf(b.auth, shared, join2(enc.encode("WebPush: info"), [0], b.pub, asPub), 32);
  const cek = await hkdf(salt, ikm, join2(enc.encode("Content-Encoding: aes128gcm"), [0]), 16);
  const nonce = await hkdf(salt, ikm, join2(enc.encode("Content-Encoding: nonce"), [0]), 12);
  const key = await wc.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]);
  const pt = new Uint8Array(await wc.subtle.decrypt({ name: "AES-GCM", iv: nonce }, key, ct));
  assert.equal(pt[pt.length - 1], 2, "last record delimiter");
  return JSON.parse(new TextDecoder().decode(pt.slice(0, -1)));
}
async function checkVapid(endpoint, authz) {
  const m = /^vapid t=([^,]+), k=(.+)$/.exec(authz);
  assert.ok(m, "vapid header");
  assert.equal(m[2], vapidPub);
  const [h, p, s] = m[1].split(".");
  const claims = JSON.parse(Buffer.from(p, "base64url").toString());
  assert.equal(claims.aud, new URL(endpoint).origin);
  assert.equal(claims.sub, "mailto:contact@almas5.com");
  assert.ok(claims.exp > Date.now() / 1000 && claims.exp < Date.now() / 1000 + 86400);
  const pub = await wc.subtle.importKey("raw", Buffer.from(vapidPub, "base64url"), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  assert.ok(await wc.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, pub, Buffer.from(s, "base64url"), enc.encode(h + "." + p)), "VAPID signature");
}

before(async () => {
  const v = await wc.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const jwk = await wc.subtle.exportKey("jwk", v.privateKey);
  vapidPub = b64u(await wc.subtle.exportKey("raw", v.publicKey));
  const dir = mkdtempSync(join(tmpdir(), "almas-web-"));
  writeFileSync(join(dir, "worker.mjs"), bundle(), "utf8");
  worker = (await import(pathToFileURL(join(dir, "worker.mjs")).href)).default;
  env = {
    DB: fakeD1(join(HERE, "..", "schema.sql")),
    INGEST_SECRET: SECRET, ADMIN_KEY: KEY, SESSION_SECRET: "session-secret-for-tests",
    VAPID: JSON.stringify({ subject: "mailto:contact@almas5.com", public: vapidPub, jwk: { d: jwk.d, x: jwk.x, y: jwk.y } }),
    ARONIUM: { fetch: async () => new Response(JSON.stringify({ products: [{ id: "p6", ar: "كمون", price: 120, unit: "kg" }] })) },
  };
  globalThis.fetch = async (url, opt) => {
    url = String(url);
    if (browsers[url]) {
      if (gone.has(url)) return new Response("", { status: 410 });
      assert.equal(opt.headers["Content-Encoding"], "aes128gcm");
      await checkVapid(url, opt.headers.Authorization);
      delivered.push({ endpoint: url, headers: opt.headers, msg: await decrypt(url, opt.body) });
      return new Response("", { status: 201 });
    }
    return realFetch(url, opt);
  };
  const r = await call("/admin/api/login", { method: "POST", body: { key: KEY }, headers: { "X-Almas-Csrf": "1" }, ip: "10.1.1.1" });
  cookie = r.headers.get("Set-Cookie").split(";")[0];
});
after(() => { globalThis.fetch = realFetch; });

function call(path, { method = "GET", body, headers = {}, ip = "10.0.0.2" } = {}) {
  const h = { "CF-Connecting-IP": ip, ...headers };
  if (body !== undefined) h["Content-Type"] = "application/json";
  return worker.fetch(new Request(BASE + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }), env);
}
const ingest = async (kind, body) => (await call("/ingest/" + kind, { method: "POST", body, headers: { "X-Almas-Secret": SECRET } })).json();
const admin = async (path, body) => (await call("/admin/api/" + path, { method: body ? "POST" : "GET", body,
  headers: body ? { Cookie: cookie, "X-Almas-Csrf": "1" } : { Cookie: cookie } })).json();
const rows = (sql, ...a) => env.DB.raw.prepare(sql).all(...a);
async function browser(host = "fcm.googleapis.com") {
  const pair = await wc.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const pub = new Uint8Array(await wc.subtle.exportKey("raw", pair.publicKey));
  const auth = wc.getRandomValues(new Uint8Array(16));
  const endpoint = "https://" + host + "/fcm/send/sub-" + (++seq) + "-" + "x".repeat(20);
  browsers[endpoint] = { priv: pair.privateKey, pub, auth };
  return { endpoint, keys: { p256dh: b64u(pub), auth: b64u(auth) } };
}
const subscribe = (subscription, extra = {}, ip) => call("/public/webpush", { method: "POST", body: { subscription, lang: "ar", ...extra },
  headers: { Origin: SITE }, ip: ip || "10.4." + (++seq) + ".1" });
async function order(phone, lang = "ar") {
  const id = "AL-WP-" + String(++seq).padStart(4, "0");
  await ingest("order", { id, at: new Date().toISOString(), name: "Buyer " + seq, phone, pay: "cod", total: 120, source: "web", lang, address: "Rue " + seq,
    items: [{ product: "p6", name_till: "كمون", name: "Cumin", qty: 1, unit: "kg", unit_price: 120, line: 120 }] });
  return id;
}
async function until(fn, ms = 3000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { const v = fn(); if (v) return v; await new Promise((r) => setTimeout(r, 20)); }
  return fn();
}

test("a browser subscribes; foreign push hosts, bad keys and plain http are refused", async () => {
  const s = await browser();
  const r = await subscribe(s, { lang: "fr" });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("Access-Control-Allow-Origin"), SITE);
  assert.equal(rows("select lang from webpush where endpoint = ?", s.endpoint)[0].lang, "fr");
  assert.equal((await subscribe({ ...s, endpoint: "https://evil.example/push/1" })).status, 400);
  assert.equal((await subscribe({ ...s, endpoint: "http://fcm.googleapis.com/fcm/send/x" })).status, 400);
  assert.equal((await subscribe({ endpoint: s.endpoint, keys: { p256dh: "short", auth: s.keys.auth } })).status, 400);
  // off: forgotten
  await subscribe(s, { off: true });
  assert.equal(rows("select count(*) n from webpush where endpoint = ?", s.endpoint)[0].n, 0);
});

test("linked to a customer only with the phone AND one of its order numbers", async () => {
  const id = await order("0612345611");
  const s = await browser();
  assert.equal((await (await subscribe(s, { phone: "0612345611", ids: ["AL-NO-0001"] })).json()).linked, false);
  assert.equal((await (await subscribe(s, { phone: "0612345611", ids: [id] })).json()).linked, true);
  assert.equal(rows("select phone_norm from webpush where endpoint = ?", s.endpoint)[0].phone_norm, "212612345611");
});

test("an order update reaches the customer's web app, encrypted and signed, in the order's language", async () => {
  const id = await order("0612345612", "es");
  const s = await browser("web.push.apple.com");
  await subscribe(s, { lang: "es", phone: "0612345612", ids: [id] });
  delivered.length = 0;
  const r = await admin("order", { id, status: "preparing" });
  assert.equal(r.app_phones, 1);
  const d = await until(() => delivered.find((x) => x.endpoint === s.endpoint));
  assert.ok(d, "delivered");
  assert.equal(d.msg.kind, "order");
  assert.equal(d.msg.title, "Preparando tu pedido");
  assert.ok(d.msg.body.includes(id));
  assert.equal(d.msg.link, "https://almas5.com/es/#my-orders");
  assert.equal(d.headers.Urgency, "high");
});

test("a broadcast reaches every web app of that language, in batches of 40", async () => {
  const subs = [];
  for (let i = 0; i < 45; i++) { const s = await browser(); subs.push(s); await subscribe(s, { lang: "en" }, "10.8." + i + ".9"); }
  const other = await browser();
  await subscribe(other, { lang: "fr" });
  delivered.length = 0;
  const r = await admin("push/send", { audience: "en", title: "This week", body: "Cumin at 80 MAD a kilo" });
  assert.equal(r.ok, true);
  assert.equal(r.web_sent, 40);
  assert.ok(r.web_left >= 5 && r.web_next > 0);
  const more = await admin("push/more", { push_id: r.push_id, after: r.web_next });
  assert.equal(more.left, 0);
  const got = new Set(delivered.map((d) => d.endpoint));
  for (const s of subs) assert.ok(got.has(s.endpoint), "every English web app got it");
  assert.ok(!got.has(other.endpoint), "not the French one");
  assert.equal(delivered[0].msg.title, "This week");
  assert.equal(rows("select sent from pushes where id = ?", r.push_id)[0].sent >= 45, true);
});

test("a subscription the push service calls gone is deleted", async () => {
  const s = await browser();
  await subscribe(s, { lang: "ar" });
  const id = rows("select id from webpush where endpoint = ?", s.endpoint)[0].id;
  await admin("push/device", { id, kind: "web", mine: true });
  gone.add(s.endpoint);
  const r = await call("/admin/api/push/send", { method: "POST", body: { audience: "mine", title: "Test", body: "Hi" },
    headers: { Cookie: cookie, "X-Almas-Csrf": "1" } });
  assert.equal(r.status, 502);
  assert.equal(rows("select count(*) n from webpush where endpoint = ?", s.endpoint)[0].n, 0);
  gone = new Set();
});

test("the Notifications page counts web apps and lists them with their browser", async () => {
  const info = await admin("push");
  assert.equal(info.web_configured, true);
  assert.ok(info.devices.web > 0);
  const w = info.recent.find((d) => d.kind === "web");
  assert.ok(w && /Chrome|Safari|Firefox|Edge/.test(w.app));
  assert.ok(!JSON.stringify(info).includes("/fcm/send/"), "endpoints never reach the page");
});
