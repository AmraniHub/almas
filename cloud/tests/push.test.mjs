// Push notifications: the app's phones register through the website, a phone is tied to a customer only with
// proof, the owner sends to everyone / a language / one customer / his own phones, and a customer hears when the
// owner moves their order. Firebase is a stand-in (globalThis.fetch); the service account is a throwaway key.
//   node --test cloud/tests/push.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { webcrypto } from "node:crypto";
import { bundle } from "../build.mjs";
import { fakeD1 } from "./d1.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = "https://almas-shop.example.workers.dev";
const SECRET = "ingest-secret-for-tests";
const KEY = "admin-key-for-tests";
const SITE = "https://almas5.com";
let worker, env, cookie = "", seq = 0;
const sent = []; // what reached the Firebase stand-in: {to, data}
let dead = new Set(); // tokens Firebase answers UNREGISTERED for
const realFetch = globalThis.fetch;

before(async () => {
  const pair = await webcrypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const der = Buffer.from(await webcrypto.subtle.exportKey("pkcs8", pair.privateKey)).toString("base64");
  const pem = "-----BEGIN PRIVATE KEY-----\n" + der.match(/.{1,64}/g).join("\n") + "\n-----END PRIVATE KEY-----\n";
  const dir = mkdtempSync(join(tmpdir(), "almas-push-"));
  const file = join(dir, "worker.mjs");
  writeFileSync(file, bundle(), "utf8");
  worker = (await import(pathToFileURL(file).href)).default;
  env = {
    DB: fakeD1(join(HERE, "..", "schema.sql")),
    INGEST_SECRET: SECRET, ADMIN_KEY: KEY, SESSION_SECRET: "session-secret-for-tests",
    FCM_SA: JSON.stringify({ client_email: "sender@test-project.iam.gserviceaccount.com", private_key: pem, project_id: "test-project" }),
    ARONIUM: { fetch: async () => new Response(JSON.stringify({ products: [{ id: "p6", ar: "كمون", price: 120, unit: "kg" }] })) },
  };
  globalThis.fetch = async (url, opt) => {
    url = String(url);
    if (url === "https://oauth2.googleapis.com/token") {
      const assertion = new URLSearchParams(opt.body).get("assertion");
      assert.equal(assertion.split(".").length, 3, "a signed JWT goes to Google");
      return new Response(JSON.stringify({ access_token: "ya29.test", expires_in: 3599 }), { headers: { "content-type": "application/json" } });
    }
    if (url === "https://fcm.googleapis.com/v1/projects/test-project/messages:send") {
      assert.equal(opt.headers.Authorization, "Bearer ya29.test");
      const m = JSON.parse(opt.body).message;
      const to = m.token ? "token:" + m.token : "topic:" + m.topic;
      if (m.token && dead.has(m.token)) return new Response(JSON.stringify({ error: { status: "UNREGISTERED" } }), { status: 404 });
      sent.push({ to, data: m.data, priority: m.android.priority });
      return new Response(JSON.stringify({ name: "projects/test-project/messages/1" }));
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
const token = (n) => "fcm-token-" + n + "-" + "x".repeat(40);
const device = (b, ip) => call("/public/device", { method: "POST", body: b, headers: { Origin: SITE }, ip: ip || "10.3." + (++seq) + ".1" });
async function order(phone, lang = "ar") {
  const id = "AL-PS-" + String(++seq).padStart(4, "0");
  await ingest("order", { id, at: new Date().toISOString(), name: "Buyer " + seq, phone, pay: "cod", total: 120, source: "web", lang, address: "Rue " + seq,
    items: [{ product: "p6", name_till: "كمون", name: "Cumin", qty: 1, unit: "kg", unit_price: 120, line: 120 }] });
  return id;
}
async function until(fn, ms = 3000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { const v = fn(); if (v) return v; await new Promise((r) => setTimeout(r, 20)); }
  return fn();
}

test("a phone registers with its language; CORS answers the shop's site", async () => {
  const r = await device({ token: token(1), lang: "fr", app: "1.3.0" });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("Access-Control-Allow-Origin"), SITE);
  assert.deepEqual(await r.json(), { ok: true, linked: false });
  const d = rows("select lang, phone_norm, app from devices where token = ?", token(1))[0];
  assert.deepEqual({ ...d }, { lang: "fr", phone_norm: "", app: "1.3.0" });
  // the same phone again: one row, language follows
  await device({ token: token(1), lang: "es", app: "1.3.0" });
  assert.equal(rows("select count(*) n from devices where token = ?", token(1))[0].n, 1);
  assert.equal(rows("select lang from devices where token = ?", token(1))[0].lang, "es");
});

test("junk tokens and wrong methods are refused", async () => {
  assert.equal((await device({ token: "short" })).status, 400);
  assert.equal((await device({ token: "bad token with spaces " + "x".repeat(30) })).status, 400);
  assert.equal((await call("/public/device", { headers: { Origin: SITE } })).status, 405);
});

test("a phone is tied to a customer only with the phone AND one of its order numbers", async () => {
  const id = await order("0612345601");
  const wrong = await (await device({ token: token(2), lang: "ar", phone: "0612345601", ids: ["AL-NOPE-0001"] })).json();
  assert.equal(wrong.linked, false);
  const other = await (await device({ token: token(3), lang: "ar", phone: "0699999999", ids: [id] })).json();
  assert.equal(other.linked, false, "someone else's order number proves nothing");
  const ok = await (await device({ token: token(2), lang: "ar", phone: "0612345601", ids: [id] })).json();
  assert.equal(ok.linked, true);
  assert.equal(rows("select phone_norm from devices where token = ?", token(2))[0].phone_norm, "212612345601");
  // a later visit without the phone keeps the link
  await device({ token: token(2), lang: "ar" });
  assert.equal(rows("select phone_norm from devices where token = ?", token(2))[0].phone_norm, "212612345601");
});

test("registration is rate limited per address", async () => {
  let last;
  for (let i = 0; i < 31; i++) last = await device({ token: token("rl" + i), lang: "ar" }, "10.7.7.7");
  assert.equal(last.status, 429);
});

test("moving an order tells that customer's phone, in the order's language, once per change", async () => {
  const id = await order("0612345602", "fr");
  await device({ token: token(4), lang: "fr", phone: "0612345602", ids: [id] });
  sent.length = 0;
  const r = await admin("order", { id, status: "confirmed" });
  assert.equal(r.app_phones, 1);
  const m = await until(() => sent.find((s) => s.to === "token:" + token(4)));
  assert.ok(m, "the customer's phone got a message");
  assert.equal(m.data.kind, "order");
  assert.equal(m.priority, "high");
  assert.equal(m.data.title, "Commande confirmée");
  assert.ok(m.data.body.includes(id));
  assert.equal(m.data.link, "https://almas5.com/fr/#my-orders");
  sent.length = 0;
  await admin("order", { id, status: "confirmed" }); // no change: no message
  await admin("order", { id, admin_note: "called" }); // note only: no message
  await new Promise((r) => setTimeout(r, 150));
  assert.equal(sent.length, 0);
  await admin("order", { id, status: "new" }); // back to new: nothing to say
  await new Promise((r) => setTimeout(r, 150));
  assert.equal(sent.length, 0);
  const log = await until(() => rows("select * from pushes where note = ? and audience = 'order:confirmed'", id)[0]);
  assert.equal(log.sent, 1);
});

test("a customer without the app: moving the order sends nothing", async () => {
  const id = await order("0612345603");
  sent.length = 0;
  const r = await admin("order", { id, status: "delivered" });
  assert.equal(r.app_phones, 0);
  await new Promise((r2) => setTimeout(r2, 150));
  assert.equal(sent.length, 0);
});

test("the owner sends to everyone and to one language as topics", async () => {
  sent.length = 0;
  const a = await admin("push/send", { audience: "all", title: "عرض الأسبوع", body: "الكمون 80 درهم هذا الأسبوع", link: "/p/p6/" });
  assert.equal(a.ok, true);
  assert.equal(a.topic, true);
  assert.deepEqual(sent.map((s) => s.to), ["topic:all"]);
  assert.equal(sent[0].data.link, "https://almas5.com/p/p6/");
  assert.equal(sent[0].priority, "normal");
  sent.length = 0;
  await admin("push/send", { audience: "fr", title: "Promo", body: "Cumin à 80 MAD" });
  assert.deepEqual(sent.map((s) => s.to), ["topic:lang_fr"]);
  const info = await admin("push");
  assert.equal(info.configured, true);
  assert.equal(info.pushes[0].audience, "fr");
});

test("the owner sends to one customer by phone, and only to phones linked to it", async () => {
  sent.length = 0;
  const r = await admin("push/send", { audience: "phone", phone: "+212 6 12 34 56 01", title: "Votre commande", body: "Prête demain" });
  assert.equal(r.sent, 1);
  assert.deepEqual(sent.map((s) => s.to), ["token:" + token(2)]);
  const none = await call("/admin/api/push/send", { method: "POST", body: { audience: "phone", phone: "0655555555", title: "x", body: "y" },
    headers: { Cookie: cookie, "X-Almas-Csrf": "1" } });
  assert.equal(none.status, 404);
});

test("test sends go only to the phones the owner marked as his; a dead token is forgotten", async () => {
  await device({ token: token(9), lang: "ar" });
  const id = rows("select id from devices where token = ?", token(9))[0].id;
  let info = await admin("push/device", { id, mine: true });
  assert.equal(info.mine.length, 1);
  sent.length = 0;
  const r = await admin("push/send", { audience: "mine", title: "Test", body: "Hello" });
  assert.equal(r.sent, 1);
  assert.deepEqual(sent.map((s) => s.to), ["token:" + token(9)]);
  dead.add(token(9));
  const gone = await call("/admin/api/push/send", { method: "POST", body: { audience: "mine", title: "Test", body: "Hello" },
    headers: { Cookie: cookie, "X-Almas-Csrf": "1" } });
  assert.equal(gone.status, 502);
  assert.equal(rows("select count(*) n from devices where token = ?", token(9))[0].n, 0, "Firebase said gone: the row is removed");
  dead = new Set();
});

test("sends need a title, a message, a known audience and a link on the shop's own site", async () => {
  const bad = async (b) => (await call("/admin/api/push/send", { method: "POST", body: b, headers: { Cookie: cookie, "X-Almas-Csrf": "1" } })).status;
  assert.equal(await bad({ audience: "all", title: "", body: "x" }), 400);
  assert.equal(await bad({ audience: "everyone", title: "x", body: "y" }), 400);
  assert.equal(await bad({ audience: "all", title: "x", body: "y", link: "https://evil.example/" }), 400);
  assert.equal(await bad({ audience: "all", title: "x", body: "y", link: "javascript:alert(1)" }), 400);
  // without a session: refused
  assert.equal((await call("/admin/api/push/send", { method: "POST", body: { audience: "all", title: "x", body: "y" }, headers: { "X-Almas-Csrf": "1" } })).status, 401);
});

test("without the Firebase key the page says so and sending is refused", async () => {
  const saved = env.FCM_SA;
  env.FCM_SA = "";
  try {
    const info = await admin("push");
    assert.equal(info.configured, false);
    const r = await call("/admin/api/push/send", { method: "POST", body: { audience: "all", title: "x", body: "y" }, headers: { Cookie: cookie, "X-Almas-Csrf": "1" } });
    assert.equal(r.status, 503);
  } finally {
    env.FCM_SA = saved;
  }
});
