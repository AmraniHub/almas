// Unit tests for the deployed bundle (worker.js + inlined admin assets) against a real SQLite D1 stand-in.
//   node --test cloud/tests/worker.test.mjs
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { bundle } from "../build.mjs";
import { fakeD1 } from "./d1.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = "https://almas-shop.example.workers.dev";
const SECRET = "ingest-secret-for-tests";
const KEY = "admin-key-for-tests";
let worker;
let env;

const CATALOG = {
  categories: [{ id: "spices", en: "Spices" }],
  products: [
    { id: "p6", ar: "كمون", fr: "Cumin", en: "Cumin", cat: "spices", price: 120, unit: "kg" },
    { id: "p9", ar: "قرفة", fr: "Cannelle", en: "Cinnamon", cat: "spices", price: 15, unit: "piece" },
  ],
};

before(async () => {
  const dir = mkdtempSync(join(tmpdir(), "almas-shop-"));
  const file = join(dir, "worker.mjs");
  writeFileSync(file, bundle(), "utf8");
  worker = (await import(pathToFileURL(file).href)).default;
  env = {
    DB: fakeD1(join(HERE, "..", "schema.sql")),
    INGEST_SECRET: SECRET, ADMIN_KEY: KEY, SESSION_SECRET: "session-secret-for-tests",
    ARONIUM: { fetch: async () => new Response(JSON.stringify(CATALOG), { headers: { "content-type": "application/json" } }) },
  };
});

function call(path, { method = "GET", body, headers = {}, ip = "10.0.0.1" } = {}) {
  const h = { "CF-Connecting-IP": ip, ...headers };
  if (body !== undefined) h["Content-Type"] = h["Content-Type"] || "application/json";
  return worker.fetch(new Request(BASE + path, { method, headers: h, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body) }), env);
}
const ingest = (kind, body, secret = SECRET) => call("/ingest/" + kind, { method: "POST", body, headers: { "X-Almas-Secret": secret } });
const rows = (sql, ...a) => env.DB.raw.prepare(sql).all(...a);
let sessionCookie = "";
async function adminLogin(key = KEY, ip = "10.9.9.9") {
  return call("/admin/api/login", { method: "POST", body: { key }, ip, headers: { "X-Almas-Csrf": "1" } });
}
function admin(path, body) {
  const headers = { Cookie: sessionCookie };
  if (body !== undefined) headers["X-Almas-Csrf"] = "1";
  return call("/admin/api/" + path, { method: body === undefined ? "GET" : "POST", body, headers });
}

const ORDER = {
  id: "AL-TEST-0001", at: "2026-11-07T10:00:00.000Z", lang: "ar", name: "Test Buyer", phone: "06 12 34 56 78",
  address: "Tangier", notes: "ring twice", pay: "bank", total: 75, source: "site",
  items: [
    { product: "p6", name_till: "كمون", name: "كمون", qty: 0.5, unit: "kg", unit_price: 120, line: 60 },
    { product: "p9", name_till: "قرفة", name: "قرفة", qty: 1, unit: "piece", unit_price: 15, line: 15 },
  ],
};

test("health answers with the database", async () => {
  const r = await call("/health");
  assert.deepEqual(await r.json(), { ok: true, db: true });
});

test("ingest refuses a missing or wrong secret", async () => {
  assert.equal((await call("/ingest/order", { method: "POST", body: ORDER })).status, 401);
  assert.equal((await ingest("order", ORDER, SECRET + "x")).status, 401);
  assert.equal((await ingest("order", ORDER, "")).status, 401);
  assert.equal(rows("select * from orders").length, 0);
});

test("order ingest stores the order, normalises the phone, and a retry adds nothing", async () => {
  const a = await ingest("order", ORDER);
  assert.equal(a.status, 200);
  assert.deepEqual(await a.json(), { ok: true });
  const b = await ingest("order", ORDER);
  assert.equal((await b.json()).duplicate, true);
  assert.equal(rows("select * from orders where id = ?", ORDER.id).length, 1);
  assert.equal(rows("select * from order_items where order_id = ?", ORDER.id).length, 2);
  const o = rows("select * from orders where id = ?", ORDER.id)[0];
  assert.equal(o.phone_norm, "212612345678");
  assert.equal(o.status, "new");
  assert.equal(o.paid, 0);
  const c = rows("select * from customers where phone_norm = ?", "212612345678");
  assert.equal(c.length, 1);
  assert.equal(c[0].name, "Test Buyer");
  assert.equal(c[0].kind, "home");
});

test("two retries arriving at the same time store the order once", async () => {
  const o = { ...ORDER, id: "AL-RACE-0001" };
  const res = await Promise.all([ingest("order", o), ingest("order", o), ingest("order", o)]);
  assert.deepEqual(res.map((r) => r.status), [200, 200, 200]);
  const bodies = await Promise.all(res.map((r) => r.json()));
  assert.equal(bodies.filter((b) => !b.duplicate).length, 1);
  assert.equal(rows("select * from orders where id = ?", o.id).length, 1);
  assert.equal(rows("select * from order_items where order_id = ?", o.id).length, 2);
});

test("phone forms +212 6.., 00212 6.. and +212 06.. all normalise to 2126..", async () => {
  for (const [i, phone] of ["+212 6 12 34 56 79", "00212612345679", "+212 0612345679"].entries()) {
    const r = await ingest("order", { ...ORDER, id: "AL-PHONE-000" + i, phone });
    assert.equal(r.status, 200);
    assert.equal(rows("select phone_norm from orders where id = ?", "AL-PHONE-000" + i)[0].phone_norm, "212612345679");
  }
  assert.equal(rows("select * from customers where phone_norm = '212612345679'").length, 1);
});

test("order text is stripped of control characters and capped", async () => {
  const bell = String.fromCharCode(7);
  const nul = String.fromCharCode(0);
  const r = await ingest("order", { ...ORDER, id: "AL-CTRL-0001", phone: "0611111111", name: "Ali" + bell + nul + "ce" + "x".repeat(200) });
  assert.equal(r.status, 200);
  const name = rows("select name from orders where id = 'AL-CTRL-0001'")[0].name;
  assert.ok(name.startsWith("Alice"));
  assert.equal([...name].length, 80);
  assert.ok(![...name].some((ch) => ch.charCodeAt(0) < 32));
});

test("order ingest rejects bad input", async () => {
  assert.equal((await ingest("order", { ...ORDER, id: "x" })).status, 400);
  assert.equal((await ingest("order", { ...ORDER, id: "AL-BAD-1", phone: "12" })).status, 400);
  assert.equal((await ingest("order", { ...ORDER, id: "AL-BAD-2", items: [{ product: "p6;drop", qty: 1 }] })).status, 400);
  assert.equal((await ingest("order", "{not json")).status, 400);
  assert.equal((await ingest("order", "x".repeat(70000))).status, 413);
});

test("paid marks the order paid and keeps the first paid_at", async () => {
  const r = await ingest("paid", { id: ORDER.id, stripe_session: "cs_test_abc", amount: 75 });
  assert.equal(r.status, 200);
  const o = rows("select * from orders where id = ?", ORDER.id)[0];
  assert.equal(o.paid, 1);
  assert.equal(o.stripe_session, "cs_test_abc");
  assert.ok(o.paid_at);
  await new Promise((r) => setTimeout(r, 15)); // a later clock, so an overwritten paid_at would differ
  await ingest("paid", { id: ORDER.id, stripe_session: "", amount: 75 });
  assert.equal(rows("select paid_at from orders where id = ?", ORDER.id)[0].paid_at, o.paid_at);
  assert.equal((await ingest("paid", { id: "AL-NOPE-0000", amount: 1 })).status, 404);
});

test("quote ingest is idempotent and files the customer as pro", async () => {
  const q = { id: "QT-TEST-0001", at: "2026-11-07T11:00:00Z", lang: "fr", type: "restaurant", business: "Dar Test", contact: "Samir",
    phone: "0700000001", city: "Tanger", date: "2026-12-01", guests: "120", freq: "weekly", items: "cumin 5 kg" };
  assert.deepEqual(await (await ingest("quote", q)).json(), { ok: true });
  assert.equal((await (await ingest("quote", q)).json()).duplicate, true);
  assert.equal(rows("select * from quotes").length, 1);
  const c = rows("select * from customers where phone_norm = '212700000001'")[0];
  assert.equal(c.kind, "pro");
  assert.equal(c.business, "Dar Test");
  assert.equal(rows("select event_date from quotes")[0].event_date, "2026-12-01");
});

test("a review is verified only with the right order, phone and product", async () => {
  const good = await (await ingest("review", { product: "p6", rating: 5, text: "Very fresh", name: "T", lang: "ar", order_id: ORDER.id, phone: "+212612345678", ip: "1.1.1.1" })).json();
  assert.deepEqual(good, { ok: true, verified: 1 });
  const wrongPhone = await (await ingest("review", { product: "p6", rating: 4, text: "x", order_id: ORDER.id, phone: "0699999999", ip: "1.1.1.2" })).json();
  assert.equal(wrongPhone.verified, 0);
  const wrongProduct = await (await ingest("review", { product: "p7", rating: 4, text: "x", order_id: ORDER.id, phone: "0612345678", ip: "1.1.1.3" })).json();
  assert.equal(wrongProduct.verified, 0);
  assert.equal((await ingest("review", { product: "p6", rating: 6, ip: "1.1.1.4" })).status, 400);
  assert.equal((await ingest("review", { product: "p6", rating: 4.5, ip: "1.1.1.4" })).status, 400);
  assert.equal(rows("select * from reviews where status = 'pending'").length, 3);
});

test("the review ip is stored only as a hash", async () => {
  for (const r of rows("select * from reviews")) {
    assert.ok(!JSON.stringify(r).includes("1.1.1."));
    assert.match(r.ip_hash, /^[0-9a-f]{32}$/);
  }
  assert.ok(!JSON.stringify(rows("select * from hits")).includes("1.1.1."));
});

test("six reviews from one ip in a day: the sixth is refused", async () => {
  const codes = [];
  for (let i = 0; i < 6; i++) codes.push((await ingest("review", { product: "p9", rating: 3, text: "r" + i, ip: "9.9.9.9" })).status);
  assert.deepEqual(codes, [200, 200, 200, 200, 200, 429]);
});

test("public reviews show nothing pending", async () => {
  const r = await call("/public/reviews?product=p6", { headers: { Origin: "https://almas-epices.vercel.app" } });
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.equal(d.count, 0);
  assert.deepEqual(d.reviews, []);
  assert.equal(r.headers.get("Cache-Control"), "public, max-age=60");
  assert.deepEqual(await (await call("/public/ratings")).json(), {});
});

test("CORS: the site and localhost are allowed, anyone else is not", async () => {
  const get = (o) => call("/public/ratings", { headers: { Origin: o } }).then((r) => r.headers.get("Access-Control-Allow-Origin"));
  assert.equal(await get("https://almas-epices.vercel.app"), "https://almas-epices.vercel.app");
  assert.equal(await get("http://localhost:5173"), "http://localhost:5173");
  assert.equal(await get("http://127.0.0.1:8000"), "http://127.0.0.1:8000");
  assert.equal(await get("https://evil.example"), null);
  assert.equal(await get("https://almas-epices.vercel.app.evil.example"), null);
  assert.equal(await get("http://localhost.evil.example"), null);
  const r = await call("/public/ratings", { headers: { Origin: "https://almas-epices.vercel.app" } });
  assert.equal(r.headers.get("Cache-Control"), "public, max-age=300");
});

test("admin API refuses a request without a session", async () => {
  assert.equal((await call("/admin/api/overview")).status, 401);
  assert.equal((await call("/admin/export/orders.csv")).status, 401);
  assert.equal((await call("/admin/api/overview", { headers: { Cookie: "almas_admin=e30.deadbeef" } })).status, 401);
  const me = await call("/admin/api/me");
  assert.equal(me.status, 200); // the page's first probe must not log a console error
  assert.deepEqual(await me.json(), { ok: true, admin: false });
});

test("login needs the CSRF header", async () => {
  const r = await call("/admin/api/login", { method: "POST", body: { key: KEY } });
  assert.equal(r.status, 403);
  assert.equal(r.headers.get("Set-Cookie"), null);
});

test("five wrong keys lock the address for 15 minutes, even for the right key", async () => {
  for (let i = 0; i < 5; i++) assert.equal((await adminLogin("wrong" + i, "10.7.7.7")).status, 403);
  assert.equal((await adminLogin(KEY, "10.7.7.7")).status, 429);
  assert.equal((await adminLogin(KEY, "10.7.7.8")).status, 200); // another address is not locked
});

test("the right key gives a signed HttpOnly Secure SameSite=Strict 30-day cookie", async () => {
  const r = await adminLogin(KEY);
  assert.equal(r.status, 200);
  const c = r.headers.get("Set-Cookie");
  assert.match(c, /HttpOnly/);
  assert.match(c, /Secure/);
  assert.match(c, /SameSite=Strict/);
  assert.match(c, /Max-Age=2592000/);
  sessionCookie = c.split(";")[0];
  assert.deepEqual(await (await admin("me")).json(), { ok: true, admin: true });
  assert.equal((await admin("overview")).status, 200);
  const eq = sessionCookie.indexOf("="); // base64 padding holds "=" too: split on the first one only
  const name = sessionCookie.slice(0, eq);
  const [payload, sig] = sessionCookie.slice(eq + 1).split(".");
  const tampered = name + "=" + payload + "." + sig.slice(0, -1) + (sig.endsWith("0") ? "1" : "0");
  assert.equal((await call("/admin/api/overview", { headers: { Cookie: tampered } })).status, 401);
  assert.deepEqual(await (await call("/admin/api/me", { headers: { Cookie: tampered } })).json(), { ok: true, admin: false });
  // a genuine payload with a longer life, re-encoded, carrying the old signature: only the signature check stops it
  const longer = btoa(JSON.stringify({ ...JSON.parse(atob(payload)), exp: 9999999999 }));
  assert.notEqual(longer, payload);
  assert.equal((await call("/admin/api/overview", { headers: { Cookie: name + "=" + longer + "." + sig } })).status, 401);
});

test("a key pasted with invisible marks still logs in", async () => {
  const rlm = String.fromCharCode(0x200f);
  assert.equal((await adminLogin(" " + rlm + KEY + rlm + " ", "10.6.6.6")).status, 200);
});

test("mutations need the CSRF header and a same-origin Origin", async () => {
  const noHeader = await call("/admin/api/order", { method: "POST", body: { id: ORDER.id, status: "confirmed" }, headers: { Cookie: sessionCookie } });
  assert.equal(noHeader.status, 403);
  const foreign = await call("/admin/api/order", { method: "POST", body: { id: ORDER.id, status: "confirmed" },
    headers: { Cookie: sessionCookie, "X-Almas-Csrf": "1", Origin: "https://evil.example" } });
  assert.equal(foreign.status, 403);
  assert.equal(rows("select status from orders where id = ?", ORDER.id)[0].status, "new");
});

test("admin changes order status, payment and note", async () => {
  let r = await admin("order", { id: ORDER.id, status: "confirmed", admin_note: "called" });
  assert.equal(r.status, 200);
  assert.equal((await admin("order", { id: ORDER.id, status: "shipped" })).status, 400);
  r = await admin("order", { id: ORDER.id, paid: false });
  const o = (await r.json()).order;
  assert.equal(o.status, "confirmed");
  assert.equal(o.paid, 0);
  assert.equal(o.paid_at, null);
  assert.equal(o.admin_note, "called");
});

test("admin publishes a review; the public endpoints then show it", async () => {
  const list = await (await admin("reviews?status=pending")).json();
  const mine = list.reviews.find((r) => r.verified === 1);
  assert.ok(mine);
  assert.equal(mine.product_name.ar, "كمون");
  assert.equal((await admin("review", { id: mine.id, status: "published" })).status, 200);
  const d = await (await call("/public/reviews?product=p6")).json();
  assert.equal(d.count, 1);
  assert.equal(d.avg, 5);
  assert.deepEqual(Object.keys(d.reviews[0]).sort(), ["date", "lang", "name", "rating", "text", "verified"]);
  assert.equal(d.reviews[0].verified, 1);
  assert.match(d.reviews[0].date, /^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual((await (await call("/public/ratings")).json()).p6, { avg: 5, count: 1 });
});

test("overview, lists and products answer", async () => {
  const o = await (await admin("overview")).json();
  assert.equal(o.ok, true);
  assert.ok(o.pending_reviews >= 1);
  assert.equal(o.new_quotes, 1);
  const s = await (await admin("orders?q=" + encodeURIComponent("0612345678"))).json();
  assert.ok(s.orders.some((x) => x.id === ORDER.id));
  const inj = await (await admin("orders?q=" + encodeURIComponent("' or 1=1 --"))).json();
  assert.equal(inj.orders.length, 0);
  const pct = await (await admin("orders?q=%25")).json();
  assert.equal(pct.orders.length, 0);
  const c = await (await admin("customers")).json();
  assert.ok(c.customers.find((x) => x.phone_norm === "212612345678"));
  const p = await (await admin("products")).json();
  const p6 = p.products.find((x) => x.id === "p6");
  assert.equal(p6.count, 1);
  assert.equal(p6.avg, 5);
});

test("customer file edits and follow-up filter", async () => {
  assert.equal((await admin("customer", { phone_norm: "212612345678", follow_up: "07/11/2026" })).status, 400);
  const r = await admin("customer", { phone_norm: "212612345678", kind: "pro", tags: "vip", notes: "line1\nline2", follow_up: "2020-01-01" });
  assert.equal(r.status, 200);
  const d = await (await admin("customers?due=1")).json();
  assert.deepEqual(d.customers.map((x) => x.phone_norm), ["212612345678"]);
  const one = await (await admin("customer?phone=212612345678")).json();
  assert.equal(one.customer.notes, "line1\nline2");
  assert.ok(one.orders.length >= 1);
});

test("CSV exports start with a BOM and neutralise formulas", async () => {
  await ingest("order", { ...ORDER, id: "AL-CSV-0001", name: "=HYPERLINK(1)", phone: "0622222222" });
  const r = await call("/admin/export/orders.csv", { headers: { Cookie: sessionCookie } });
  assert.equal(r.status, 200);
  const buf = new Uint8Array(await r.arrayBuffer());
  assert.deepEqual([...buf.slice(0, 3)], [0xef, 0xbb, 0xbf]);
  const body = new TextDecoder().decode(buf);
  assert.ok(body.includes("'=HYPERLINK(1)"));
  assert.ok(!/,=HYPERLINK/.test(body));
  const c = await call("/admin/export/customers.csv", { headers: { Cookie: sessionCookie } });
  assert.equal(c.status, 200);
  assert.ok(new TextDecoder().decode(await c.arrayBuffer()).includes("212612345678"));
});

test("the admin page is served with a strict CSP and no inline script", async () => {
  const r = await call("/admin");
  assert.equal(r.status, 200);
  const csp = r.headers.get("Content-Security-Policy");
  assert.match(csp, /script-src 'self'/);
  assert.ok(!csp.includes("unsafe-inline"));
  const html = await r.text();
  assert.ok(!/<script>/.test(html) && !/ style=/.test(html) && !/ on[a-z]+=/.test(html));
  assert.equal((await call("/admin/app.js")).headers.get("Content-Type"), "text/javascript; charset=utf-8");
});

test("admin deletes order, customer and review", async () => {
  const revs = await (await admin("reviews")).json();
  for (const r of revs.reviews) assert.equal((await admin("review/delete", { id: r.id })).status, 200);
  assert.equal((await admin("order/delete", { id: ORDER.id })).status, 200);
  assert.equal(rows("select * from order_items where order_id = ?", ORDER.id).length, 0);
  assert.equal((await admin("order/delete", { id: ORDER.id })).status, 404);
  assert.equal((await admin("customer/delete", { phone_norm: "212612345678" })).status, 200);
  assert.equal(rows("select * from customers where phone_norm = '212612345678'").length, 0);
  assert.equal(rows("select * from reviews").length, 0);
});

test("my-orders shows status only when the order number and the phone both match", async () => {
  await ingest("order", { ...ORDER, id: "AL-MINE-0001" });
  const mine = (body) => call("/public/my-orders", { method: "POST", body, ip: "10.7.7.7", headers: { Origin: "https://almas-epices.vercel.app" } });
  let r = await mine({ phone: "+212 612345678", ids: ["AL-MINE-0001", "AL-NOPE-0001"] });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("Access-Control-Allow-Origin"), "https://almas-epices.vercel.app");
  let d = await r.json();
  assert.deepEqual(Object.keys(d.orders), ["AL-MINE-0001"]);
  assert.equal(d.orders["AL-MINE-0001"].status, "new");
  d = await (await mine({ phone: "0699999999", ids: ["AL-MINE-0001"] })).json();
  assert.deepEqual(d.orders, {}); // a guessed number with another phone reveals nothing
  assert.equal((await mine({ phone: "06", ids: ["AL-MINE-0001"] })).status, 400);
  const pre = await call("/public/my-orders", { method: "OPTIONS", headers: { Origin: "https://almas-epices.vercel.app" } });
  assert.match(pre.headers.get("Access-Control-Allow-Methods"), /POST/);
});

test("reorder reminders follow each customer's own rhythm; a single-order business is due after 30 days", async () => {
  const ago = (d) => new Date(Date.now() - d * 864e5).toISOString();
  const item = [{ product: "p6", name_till: "الكمون", name: "Cumin", qty: 1, unit: "kg", unit_price: 90, line: 90 }];
  await ingest("order", { ...ORDER, id: "AL-RHY-0001", at: ago(45), phone: "0655500001", name: "Resto Rythme", items: item, total: 90 });
  await ingest("order", { ...ORDER, id: "AL-RHY-0002", at: ago(25), phone: "0655500001", name: "Resto Rythme", items: item, total: 90 });
  await ingest("order", { ...ORDER, id: "AL-NEW-0001", at: ago(2), phone: "0655500002", name: "Just ordered", items: item, total: 90 });
  await ingest("quote", { id: "QT-RHY-0001", at: ago(40), phone: "0655500003", business: "Hotel Uno", contact: "M", items: "cumin" });
  await ingest("order", { ...ORDER, id: "AL-PRO-0001", at: ago(35), phone: "0655500003", name: "Hotel Uno", items: item, total: 90 });
  if (!sessionCookie) sessionCookie = (await adminLogin(KEY)).headers.get("Set-Cookie").split(";")[0];
  const d = await (await admin("overview")).json();
  const due = Object.fromEntries(d.reorder.map((r) => [r.phone_norm, r]));
  assert.ok(due["212655500001"], "20-day rhythm, 25 days since: due");
  assert.equal(due["212655500001"].gap, 20);
  assert.equal(due["212655500001"].items[0].name, "الكمون");
  assert.ok(due["212655500003"], "a hotel with one order 35 days ago: due");
  assert.equal(d.reorder[0].kind, "pro", "businesses come first");
  assert.ok(!due["212655500002"], "ordered 2 days ago: not due");
});

test("standing order: requested pending, activated by the owner, each run is a real order at today's till prices", async () => {
  const req = { from_order: "AL-STD-0001", at: new Date().toISOString(), name: "Café Kasbah", phone: "0644400001", lang: "es", pay: "cod",
    every_days: 14, address: "Tanger", items: [{ product: "p6", qty: 2, unit: "kg", name_till: "كمون" }, { product: "p999", qty: 1 }, { product: "p9", qty: 3, unit: "piece" }] };
  assert.deepEqual(await (await ingest("standing", req)).json(), { ok: true });
  assert.equal((await (await ingest("standing", req)).json()).duplicate, true, "a retry is filed once");
  assert.equal((await ingest("standing", { ...req, from_order: "AL-STD-0002", every_days: 10 })).status, 400, "only 7, 14 or 30 days");
  if (!sessionCookie) sessionCookie = (await adminLogin(KEY)).headers.get("Set-Cookie").split(";")[0];
  let list = (await (await admin("standing")).json()).standing;
  const s = list.find((x) => x.from_order === "AL-STD-0001");
  assert.equal(s.status, "pending");
  assert.equal(s.lang, "es");
  assert.equal(s.items.length, 3, "an id missing from the catalogue is kept on the basket (it may come back)");
  assert.equal((await admin("standing/run", { id: s.id })).status, 409, "not before the owner activates it");
  const today = new Date().toISOString().slice(0, 10);
  await admin("standing", { id: s.id, status: "active", next_date: today });
  const ov = await (await admin("overview")).json();
  assert.ok(ov.standing_due.some((x) => x.id === s.id), "due today shows on the overview");
  const run = await (await admin("standing/run", { id: s.id })).json();
  assert.equal(run.ok, true);
  assert.equal(run.total, 2 * 120 + 3 * 15, "priced from the catalogue, the unknown product skipped");
  assert.equal(run.skipped, 1);
  const o = await (await admin("order?id=" + encodeURIComponent(run.order_id))).json();
  assert.equal(o.order.source, "standing");
  assert.equal(o.items.length, 2);
  assert.equal((await admin("standing/run", { id: s.id })).status, 409, "once a day at most");
  list = (await (await admin("standing")).json()).standing;
  const after = list.find((x) => x.id === s.id);
  const d = new Date(today + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + 14);
  assert.equal(after.next_date, d.toISOString().slice(0, 10), "the next date moves on by its rhythm");
  assert.equal(after.last_order, run.order_id);
});

test("Google Sheet: shows the script with this shop's key, refuses a wrong URL, connects with a test row, then copies each new order", async () => {
  assert.equal((await adminLogin()).status, 200);
  let d = await (await admin("sheet")).json();
  assert.equal(d.connected, false);
  const secret = (d.script.match(/var SECRET = "([0-9a-f]{48})";/) || [])[1];
  assert.ok(secret, "the script carries a 48-hex secret");
  assert.equal(((await (await admin("sheet")).json()).script.match(/var SECRET = "([0-9a-f]{48})";/) || [])[1], secret, "the secret is stable");

  const bad = await admin("sheet", { url: "https://evil.example.com/macros/s/x/exec" });
  assert.equal(bad.status, 400);

  const sent = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, opt) => {
    if (String(url).startsWith("https://script.google.com/")) {
      const b = JSON.parse(opt.body);
      sent.push(b);
      return new Response(JSON.stringify(b.secret === secret ? { ok: true, added: b.rows.length } : { ok: false, error: "secret" }),
        { headers: { "content-type": "application/json" } });
    }
    return realFetch(url, opt);
  };
  try {
    const url = "https://script.google.com/macros/s/AKfycbTESTTESTTESTTESTTEST123/exec";
    const ok = await admin("sheet", { url });
    assert.equal(ok.status, 200);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].kind, "test");
    assert.equal((await (await admin("sheet")).json()).connected, true);

    const o = { ...ORDER, id: "AL-SHEET-0001", phone: "+212 6 11 22 33 44", name: "=HYPERLINK(1)" };
    assert.equal((await ingest("order", o)).status, 200);
    await new Promise((r) => setTimeout(r, 20));
    const row = sent.find((s) => s.kind === "order");
    assert.ok(row, "the order went to the sheet");
    assert.equal(row.head[0], "Date");
    assert.equal(row.rows[0][1], "AL-SHEET-0001");
    assert.match(row.rows[0][5], /0\.5 kg/);
    // the same order again (a retry) is not copied twice
    const before = sent.length;
    await ingest("order", o);
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(sent.length, before);

    const off = await admin("sheet/disconnect", {});
    assert.equal(off.status, 200);
    assert.equal((await (await admin("sheet")).json()).connected, false);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("Google Sheet: an unreachable sheet never fails the customer's order", async () => {
  assert.equal((await adminLogin()).status, 200);
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, opt) => String(url).startsWith("https://script.google.com/")
    ? new Response(JSON.stringify({ ok: true, added: 1 }), { headers: { "content-type": "application/json" } }) : realFetch(url, opt);
  await admin("sheet", { url: "https://script.google.com/macros/s/AKfycbTESTTESTTESTTESTTEST456/exec" });
  globalThis.fetch = async (url, opt) => { if (String(url).startsWith("https://script.google.com/")) throw new Error("network down"); return realFetch(url, opt); };
  try {
    const r = await ingest("order", { ...ORDER, id: "AL-SHEET-0002" });
    assert.equal(r.status, 200);
    assert.equal(rows("select id from orders where id = 'AL-SHEET-0002'").length, 1);
    await new Promise((r2) => setTimeout(r2, 20));
  } finally {
    globalThis.fetch = realFetch;
    await admin("sheet/disconnect", {});
  }
});
