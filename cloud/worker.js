// Almas back office: the website's orders, customers, B2B quote requests and product reviews
// (Cloudflare Worker + D1, free plan; deployed by cloud/deploy.py, never by wrangler).
//
// The Vercel functions of almas-epices.vercel.app push every order, card payment, quote and review here
// (/ingest/*, shared secret). The site reads published reviews from /public/*. The owner works in /admin
// (one key, signed 30-day session cookie). No cron triggers: the account is at its 5-cron limit.

const ASSETS = /*ASSETS*/{}/*END*/; // admin/index.html, app.js, app.css: inlined by build.mjs

const CATALOG = "https://aronium-shop.amrani4online.workers.dev/app/catalog.json";
const SITE = "https://almas-epices.vercel.app";
const SESSION_DAYS = 30;
const LOGIN_FAILS = 5;
const LOGIN_WINDOW = 900; // seconds
const REVIEWS_PER_DAY = 5;
const MAX_BODY = 65536;
const ORDER_STATUS = ["new", "confirmed", "preparing", "delivered", "cancelled"];
const QUOTE_STATUS = ["new", "contacted", "won", "lost"];
const REVIEW_STATUS = ["pending", "published", "hidden"];
const PAYS = ["cod", "bank", "card"];
const LANGS = ["ar", "fr", "en", "es"];
const NL = String.fromCharCode(10);
const CRLF = String.fromCharCode(13, 10);
const BOM = String.fromCharCode(0xfeff);
const enc = new TextEncoder();

class Http extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// ---------- small helpers ----------

function head(type, extra) {
  return { "Content-Type": type, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY", ...(extra || {}) };
}
function json(body, status = 200, extra) {
  return new Response(JSON.stringify(body), { status, headers: head("application/json; charset=utf-8", extra) });
}
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey("raw", enc.encode(String(secret)), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, enc.encode(String(msg))));
}
function same(a, b) {
  a = String(a || "");
  b = String(b || "");
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
// constant time whatever the lengths: both sides are hashed to 64 hex chars first
async function secretEquals(env, given, real) {
  if (!given || !real) return false;
  const k = "cmp:" + (env.SESSION_SECRET || "");
  return same(await hmac(k, given), await hmac(k, real));
}

// Text from outside: control characters (C0, DEL, C1) and lone surrogates removed, tabs/returns to spaces,
// newlines kept only where a field is multi-line, trimmed, capped in characters (not UTF-16 units).
function text(v, max, multiline) {
  if (v == null) return "";
  let out = "";
  for (const ch of String(v)) {
    const n = ch.codePointAt(0);
    if (n === 10) out += multiline ? NL : " ";
    else if (n === 9 || n === 13) out += " ";
    else if (n < 32 || (n >= 127 && n < 160) || (n >= 0xd800 && n <= 0xdfff)) continue;
    else out += ch;
  }
  out = out.trim();
  if (multiline) out = out.split(NL).map((l) => l.trim()).join(NL).replace(/\n{3,}/g, NL + NL);
  else out = out.replace(/ {2,}/g, " ");
  const chars = [...out];
  return chars.length > max ? chars.slice(0, max).join("").trim() : out;
}
// A key pasted from a note or a message carries invisible marks and spaces: drop them before comparing.
function invisibleClean(code) {
  return [...String(code || "")].filter((c) => {
    const n = c.codePointAt(0);
    return !(n <= 32 || n === 0x7f || n === 0xa0 || n === 0xad || (n >= 0x200b && n <= 0x200f) ||
      (n >= 0x202a && n <= 0x202e) || (n >= 0x2060 && n <= 0x2069) || n === 0xfeff || n === 0x061c);
  }).join("");
}
// Moroccan numbers to the international form WhatsApp wants: 06 12 34 56 78 / +212 6... / 00212... -> 2126...
function phoneNorm(p) {
  let d = String(p == null ? "" : p).replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 10 && d.startsWith("0")) d = "212" + d.slice(1);
  if (d.length === 13 && d.startsWith("2120")) d = "212" + d.slice(4); // +212 0612... typed with the zero
  return d;
}
function num(v, min, max, digits = 2) {
  const n = Number(v);
  if (v === null || v === "" || v === undefined || !Number.isFinite(n) || n < min || n > max) return null;
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}
function iso(v) {
  if (!v) return null;
  const t = Date.parse(String(v));
  if (!Number.isFinite(t) || t < Date.UTC(2020, 0, 1) || t > Date.now() + 86400000) return null;
  return new Date(t).toISOString();
}
const nowIso = () => new Date().toISOString();
const nowSec = () => Math.floor(Date.now() / 1000);
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9-]{2,39}$/;
const PRODUCT_RE = /^[A-Za-z0-9_-]{1,20}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function oneOf(v, list, dflt) {
  return list.includes(v) ? v : dflt;
}
function likeTerm(q) {
  return "%" + q.replace(/[!%_]/g, (c) => "!" + c) + "%";
}

async function body(req) {
  const t = await req.text();
  if (t.length > MAX_BODY) throw new Http(413, "body too large");
  let b;
  try {
    b = JSON.parse(t || "{}");
  } catch {
    throw new Http(400, "bad json");
  }
  if (!b || typeof b !== "object" || Array.isArray(b)) throw new Http(400, "bad json");
  return b;
}
async function ipHash(env, ip) {
  return (await hmac(env.SESSION_SECRET || "", "ip:" + String(ip || "?"))).slice(0, 32);
}
function cookie(req, name) {
  for (const part of (req.headers.get("Cookie") || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return "";
}
const first = (env, sql, ...args) => env.DB.prepare(sql).bind(...args).first();
const all = async (env, sql, ...args) => (await env.DB.prepare(sql).bind(...args).all()).results || [];

// ---------- the till's public catalogue (names, prices), 10 minutes in memory ----------

let catalogCache = null;
async function catalogue(env) {
  if (catalogCache && Date.now() - catalogCache.at < 600000) return catalogCache.data;
  const req = new Request(CATALOG, { headers: { "user-agent": "almas-backoffice" } });
  // a Worker cannot fetch another workers.dev Worker of the same account over the internet: use the binding
  const r = env.ARONIUM ? await env.ARONIUM.fetch(req) : await fetch(req, { cf: { cacheTtl: 600 } });
  if (!r.ok) throw new Error("catalogue " + r.status);
  const d = await r.json();
  const products = Array.isArray(d.products) ? d.products : [];
  if (!products.length) throw new Error("empty catalogue");
  catalogCache = { at: Date.now(), data: { products, categories: Array.isArray(d.categories) ? d.categories : [] } };
  return catalogCache.data;
}
async function productNames(env) {
  try {
    const c = await catalogue(env);
    return Object.fromEntries(c.products.map((p) => [String(p.id), { ar: p.ar || "", fr: p.fr || "", en: p.en || "" }]));
  } catch {
    return {};
  }
}

// ---------- customers ----------

function upsertCustomer(env, pn, name, at, pro, business) {
  return env.DB.prepare(
    "insert into customers (phone_norm, name, kind, business, first_at, last_at, updated_at) values (?, ?, ?, ?, ?, ?, ?) " +
    "on conflict(phone_norm) do update set " +
    "name = case when customers.name = '' then excluded.name else customers.name end, " +
    (pro ? "kind = 'pro', " : "") +
    "business = case when customers.business = '' then excluded.business else customers.business end, " +
    "first_at = min(coalesce(customers.first_at, excluded.first_at), excluded.first_at), " +
    "last_at = max(coalesce(customers.last_at, excluded.last_at), excluded.last_at)"
  ).bind(pn, name, pro ? "pro" : "home", business || "", at, at, nowIso());
}

// ---------- ingest (from the Vercel functions) ----------

async function ingestOrder(env, b) {
  const id = text(b.id, 40);
  if (!ID_RE.test(id)) throw new Http(400, "id");
  const name = text(b.name, 80);
  const phone = text(b.phone, 30);
  const pn = phoneNorm(phone);
  if (!name || pn.length < 9 || pn.length > 15) throw new Http(400, "name and phone");
  const items = [];
  for (const it of (Array.isArray(b.items) ? b.items : []).slice(0, 60)) {
    if (!it || typeof it !== "object") continue;
    const product = text(it.product, 20);
    const qty = num(it.qty, 0.001, 10000, 3);
    if (!PRODUCT_RE.test(product) || qty === null) continue;
    const unitPrice = num(it.unit_price, 0, 1000000) ?? 0;
    items.push({
      product, qty, unit_price: unitPrice,
      name_till: text(it.name_till, 120), name: text(it.name, 120),
      unit: it.unit === "kg" ? "kg" : "piece",
      line: num(it.line, 0, 100000000) ?? Math.round(qty * unitPrice * 100) / 100,
    });
  }
  if (!items.length) throw new Http(400, "no items");
  const sum = Math.round(items.reduce((s, i) => s + i.line, 0) * 100) / 100;
  const total = num(b.total, 0, 100000000) ?? sum;
  const at = iso(b.at) || nowIso();
  if (await first(env, "select 1 x from orders where id = ?", id)) return { ok: true, duplicate: true };
  const stmts = [
    env.DB.prepare(
      "insert into orders (id, at, lang, name, phone, phone_norm, address, notes, pay, total, source, updated_at) " +
      "values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(id, at, oneOf(b.lang, LANGS, "ar"), name, phone, pn, text(b.address, 300, true), text(b.notes, 600, true),
      oneOf(b.pay, PAYS, "cod"), total, text(b.source, 40), nowIso()),
    ...items.map((i, idx) => env.DB.prepare(
      "insert or ignore into order_items (order_id, idx, product, name_till, name, qty, unit, unit_price, line) values (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(id, idx, i.product, i.name_till, i.name, i.qty, i.unit, i.unit_price, i.line)),
    upsertCustomer(env, pn, name, at, false, ""),
  ];
  try {
    await env.DB.batch(stmts); // one transaction: a concurrent retry fails on the primary key and changes nothing
  } catch (e) {
    if (/UNIQUE|constraint/i.test(String(e && e.message))) return { ok: true, duplicate: true };
    throw e;
  }
  return { ok: true };
}

async function ingestPaid(env, b) {
  const id = text(b.id, 40);
  if (!ID_RE.test(id)) throw new Http(400, "id");
  const o = await first(env, "select total, admin_note from orders where id = ?", id);
  if (!o) throw new Http(404, "unknown order");
  const amount = num(b.amount, 0, 100000000);
  let note = o.admin_note || "";
  if (amount !== null && Math.abs(amount - o.total) > 0.009 && !note.includes("Stripe amount")) {
    note = (note ? note + NL : "") + `Stripe amount ${amount} MAD differs from the order total ${o.total} MAD.`;
  }
  const at = nowIso();
  await env.DB.prepare(
    "update orders set paid = 1, paid_at = coalesce(paid_at, ?), stripe_session = coalesce(nullif(?, ''), stripe_session), " +
    "admin_note = ?, updated_at = ? where id = ?"
  ).bind(at, text(b.stripe_session, 200), note, at, id).run();
  await syncOrderPoints(env, id);
  return { ok: true };
}

async function ingestQuote(env, b) {
  const id = text(b.id, 40);
  if (!ID_RE.test(id)) throw new Http(400, "id");
  const business = text(b.business, 100);
  const contact = text(b.contact, 80);
  const phone = text(b.phone, 30);
  const pn = phoneNorm(phone);
  if (!business || pn.length < 9 || pn.length > 15) throw new Http(400, "business and phone");
  const at = iso(b.at) || nowIso();
  const date = text(b.date, 10);
  const res = await env.DB.batch([
    env.DB.prepare(
      "insert or ignore into quotes (id, at, lang, type, business, contact, phone, phone_norm, city, event_date, guests, freq, items, updated_at) " +
      "values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(id, at, oneOf(b.lang, LANGS, "ar"), text(b.type, 40), business, contact, phone, pn, text(b.city, 60),
      DATE_RE.test(date) ? date : "", text(b.guests, 6), text(b.freq, 30), text(b.items, 1500, true), nowIso()),
    upsertCustomer(env, pn, contact || business, at, true, business),
  ]);
  const inserted = res && res[0] && res[0].meta ? res[0].meta.changes : 1;
  return inserted ? { ok: true } : { ok: true, duplicate: true };
}

async function ingestReview(env, b) {
  const product = text(b.product, 20);
  if (!PRODUCT_RE.test(product)) throw new Http(400, "product");
  const rating = Number(b.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Http(400, "rating");
  const iph = await ipHash(env, text(b.ip, 64));
  const t = nowSec();
  const k = "review:" + iph;
  const n = await first(env, "select count(*) n from hits where k = ? and at > ?", k, t - 86400);
  if (n && n.n >= REVIEWS_PER_DAY) throw new Http(429, "too many reviews today");
  const orderId = text(b.order_id, 40);
  const pn = phoneNorm(text(b.phone, 30));
  let verified = 0;
  if (ID_RE.test(orderId) && pn.length >= 9) {
    const hit = await first(env,
      "select 1 x from orders o join order_items i on i.order_id = o.id where o.id = ? and o.phone_norm = ? and i.product = ? and o.status <> 'cancelled' limit 1",
      orderId, pn, product);
    verified = hit ? 1 : 0;
  }
  await env.DB.batch([
    env.DB.prepare("insert into reviews (product, rating, text, name, lang, order_id, verified, status, at, ip_hash) values (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)")
      .bind(product, rating, text(b.text, 600, true), text(b.name, 80), oneOf(b.lang, LANGS, "ar"), ID_RE.test(orderId) ? orderId : "", verified, nowIso(), iph),
    env.DB.prepare("insert into hits (k, at) values (?, ?)").bind(k, t),
    env.DB.prepare("delete from hits where at < ?").bind(t - 2 * 86400),
  ]);
  return { ok: true, verified };
}

// ---------- loyalty points ----------
// Earned when the owner marks an order delivered (a card order also has to be paid): 1 point per 10 MAD actually
// paid, so the part paid with points earns nothing. Spent in steps of 100 points = 10 MAD, from a balance of 100,
// on at most 10% of an order (a saffron-only basket, the thinnest margin at the till, still sells above cost).
// The balance lapses 12 months after the last order that earned points. Points have no cash value and are not
// sold or transferred. The same numbers are in site/config.json "points"; a test keeps the two equal.
const POINTS = { mad_per_point: 10, step: 100, step_mad: 10, min: 100, max_share: 0.1, life_days: 365 };

const earnedFor = (total) => Math.max(0, Math.floor(Number(total || 0) / POINTS.mad_per_point + 1e-9));
// how many points an order of `total` MAD may spend, out of `balance`: whole steps only
function spendable(balance, total) {
  if (balance < POINTS.min) return 0;
  const byBalance = Math.floor(balance / POINTS.step);
  const byOrder = Math.floor((Number(total || 0) * POINTS.max_share) / POINTS.step_mad + 1e-9);
  return Math.max(0, Math.min(byBalance, byOrder)) * POINTS.step;
}
const pointsMad = (pts) => Math.round((pts / POINTS.step) * POINTS.step_mad * 100) / 100;

// The balance of one phone, after writing off points that lapsed. pending = points of orders on their way.
async function pointsState(env, pn, history = 0) {
  const lifeMs = POINTS.life_days * 86400000;
  // a hold whose order never arrived (the back office was unreachable when the order was filed) goes back after a day
  await env.DB.prepare("delete from points where phone_norm = ? and kind = 'redeem' and at < ? and order_id not in (select id from orders)")
    .bind(pn, new Date(Date.now() - 86400000).toISOString()).run();
  const row = await first(env,
    "select coalesce(sum(points), 0) bal, max(case when points > 0 and kind in ('earn', 'adjust') then at end) last from points where phone_norm = ?", pn);
  let balance = row ? Number(row.bal) : 0;
  const last = row && row.last ? row.last : null;
  if (balance > 0 && last && Date.parse(last) + lifeMs < Date.now()) {
    await env.DB.prepare(
      "insert into points (phone_norm, kind, points, order_id, mad, note, at) " +
      "select ?, 'expire', -s, '', 0, 'lapsed: no order earned points for 12 months', ? from (select coalesce(sum(points), 0) s from points where phone_norm = ?) where s > 0"
    ).bind(pn, nowIso(), pn).run();
    balance = 0;
  }
  const open = await all(env,
    "select o.total from orders o where o.phone_norm = ? and o.status not in ('delivered', 'cancelled') and o.at >= ? " +
    "and not exists (select 1 from points p where p.order_id = o.id and p.kind = 'earn')", pn, dayStart(90));
  const state = {
    balance, mad: pointsMad(Math.floor(balance / POINTS.step) * POINTS.step),
    pending: open.reduce((s, o) => s + earnedFor(o.total), 0),
    expires: balance > 0 && last ? new Date(Date.parse(last) + lifeMs).toISOString().slice(0, 10) : "",
    rules: POINTS,
  };
  if (history) {
    state.history = await all(env, "select kind, points, order_id, mad, note, at from points where phone_norm = ? order by at desc, id desc limit ?", pn, history);
  }
  return state;
}

// The phone must have placed one of the orders the browser remembers: knowing a number alone shows nothing.
async function phoneProof(env, pn, ids) {
  const list = (Array.isArray(ids) ? ids : []).map((x) => text(x, 40)).filter((x) => ID_RE.test(x)).slice(0, 30);
  if (pn.length < 9 || !list.length) return false;
  return !!(await first(env, `select 1 x from orders where phone_norm = ? and id in (${list.map(() => "?").join(",")}) limit 1`, pn, ...list));
}

// /ingest/points-redeem, from /api/order before the shop is told: hold the points for the order being placed.
// Returns the points and MAD actually taken (0 when the customer has no proof, too few points, or a small basket).
async function ingestRedeem(env, b) {
  const id = text(b.id, 40);
  if (!ID_RE.test(id)) throw new Http(400, "id");
  const pn = phoneNorm(text(b.phone, 30));
  const total = num(b.total, 0, 100000000);
  if (pn.length < 9 || total === null) throw new Http(400, "phone and total");
  const held = await first(env, "select points, mad from points where order_id = ? and kind = 'redeem'", id);
  if (held) return { ok: true, points: -held.points, discount: held.mad };
  if (!(await phoneProof(env, pn, b.known))) return { ok: true, points: 0, discount: 0, reason: "proof" };
  const want = Math.max(0, Math.floor(Number(b.points) || 0));
  const st = await pointsState(env, pn);
  const pts = Math.min(spendable(st.balance, total), Math.floor(want / POINTS.step) * POINTS.step);
  if (pts <= 0) return { ok: true, points: 0, discount: 0, reason: st.balance < POINTS.min ? "balance" : "basket" };
  const discount = pointsMad(pts);
  // one statement: two orders placed at the same moment cannot both spend the same points
  const r = await env.DB.prepare(
    "insert into points (phone_norm, kind, points, order_id, mad, note, at) select ?, 'redeem', ?, ?, ?, '', ? " +
    "where (select coalesce(sum(points), 0) from points where phone_norm = ?) >= ?"
  ).bind(pn, -pts, id, discount, nowIso(), pn, pts).run();
  if (!r.meta || !r.meta.changes) return { ok: true, points: 0, discount: 0, reason: "balance" };
  return { ok: true, points: pts, discount, balance: st.balance - pts };
}

// /ingest/points-release: the order could not be placed after all (the shop could not be told): give the points back
async function ingestRelease(env, b) {
  const id = text(b.id, 40);
  if (!ID_RE.test(id)) throw new Http(400, "id");
  if (await first(env, "select 1 x from orders where id = ? and status <> 'cancelled'", id)) return { ok: true, released: 0 };
  const r = await env.DB.prepare("delete from points where order_id = ? and kind = 'redeem'").bind(id).run();
  return { ok: true, released: r.meta ? r.meta.changes : 0 };
}

// After any change to an order: delivered (and paid, for a card) = its points are earned; cancelled = nothing
// earned and the points it spent come back; any other status = not earned yet. Idempotent.
async function syncOrderPoints(env, id) {
  const o = await first(env, "select id, phone_norm, status, pay, paid, total from orders where id = ?", id);
  if (!o || o.status === "cancelled") {
    await env.DB.prepare("delete from points where order_id = ? and kind in ('earn', 'redeem')").bind(id).run();
    return;
  }
  const earns = o.status === "delivered" && (o.pay !== "card" || o.paid) && earnedFor(o.total) > 0;
  if (!earns) {
    await env.DB.prepare("delete from points where order_id = ? and kind = 'earn'").bind(id).run();
    return;
  }
  if (await first(env, "select 1 x from points where order_id = ? and kind = 'earn'", id)) return;
  await pointsState(env, o.phone_norm); // a balance that had lapsed is written off before the new points arrive
  await env.DB.prepare("insert or ignore into points (phone_norm, kind, points, order_id, mad, note, at) values (?, 'earn', ?, ?, ?, '', ?)")
    .bind(o.phone_norm, earnedFor(o.total), id, o.total, nowIso()).run();
}

async function adjustPoints(env, b) {
  const pn = phoneNorm(text(b.phone_norm, 20));
  const pts = Math.trunc(Number(b.points));
  const note = text(b.note, 200);
  if (pn.length < 9) throw new Http(400, "phone");
  if (!Number.isFinite(pts) || !pts || Math.abs(pts) > 100000) throw new Http(400, "points: a whole number, not 0");
  if (!note) throw new Http(400, "say why in the note");
  const st = await pointsState(env, pn);
  if (st.balance + pts < 0) throw new Http(400, `the balance is ${st.balance}: it cannot go below 0`);
  await env.DB.prepare("insert into points (phone_norm, kind, points, order_id, mad, note, at) values (?, 'adjust', ?, '', 0, ?, ?)")
    .bind(pn, pts, note, nowIso()).run();
  return { ok: true, points: await pointsState(env, pn, 100) };
}

// ---------- public (read by the website, CORS) ----------

function cors(req) {
  const o = req.headers.get("Origin") || "";
  const ok = o === SITE || /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(o);
  return ok ? { "Access-Control-Allow-Origin": o, Vary: "Origin" } : { Vary: "Origin" };
}
const round1 = (x) => Math.round(Number(x || 0) * 10) / 10;

async function publicApi(req, env, url) {
  const c = cors(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { ...c, "Access-Control-Allow-Methods": "GET, POST",
      "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400" } });
  }
  // "My orders" on the visitor's phone: the status of orders it already knows the numbers of. Both the order number
  // AND the phone it was placed with must match, so a guessed number reveals nothing. POST, so the phone never
  // sits in a URL or a log line.
  if (url.pathname === "/public/my-orders") {
    if (req.method !== "POST") return json({ ok: false, error: "POST only" }, 405, c);
    const b = await body(req);
    const pn = phoneNorm(text(b.phone, 30));
    const ids = (Array.isArray(b.ids) ? b.ids : []).map((x) => text(x, 40)).filter((x) => ID_RE.test(x)).slice(0, 30);
    if (pn.length < 9 || !ids.length) return json({ ok: false, error: "phone and ids" }, 400, c);
    const iph = await ipHash(env, req.headers.get("CF-Connecting-IP") || "");
    const t = nowSec(), k = "mine:" + iph;
    const n = await first(env, "select count(*) n from hits where k = ? and at > ?", k, t - 3600);
    if (n && n.n >= 60) return json({ ok: false, error: "slow down" }, 429, c);
    await env.DB.prepare("insert into hits (k, at) values (?, ?)").bind(k, t).run();
    const rows = await all(env, `select id, status, paid from orders where phone_norm = ? and id in (${ids.map(() => "?").join(",")})`, pn, ...ids);
    const orders = {};
    for (const r of rows) orders[r.id] = { status: r.status, paid: r.paid ? 1 : 0 };
    return json({ ok: true, orders }, 200, { ...c, "Cache-Control": "no-store" });
  }
  // The visitor's points: the same proof as "My orders" (the phone AND one of its order numbers), same rate limit.
  if (url.pathname === "/public/points") {
    if (req.method !== "POST") return json({ ok: false, error: "POST only" }, 405, c);
    const b = await body(req);
    const pn = phoneNorm(text(b.phone, 30));
    const iph = await ipHash(env, req.headers.get("CF-Connecting-IP") || "");
    const t = nowSec(), k = "mine:" + iph;
    const n = await first(env, "select count(*) n from hits where k = ? and at > ?", k, t - 3600);
    if (n && n.n >= 60) return json({ ok: false, error: "slow down" }, 429, c);
    await env.DB.prepare("insert into hits (k, at) values (?, ?)").bind(k, t).run();
    if (!(await phoneProof(env, pn, b.ids))) return json({ ok: false, error: "unknown" }, 404, { ...c, "Cache-Control": "no-store" });
    const st = await pointsState(env, pn, 10);
    st.history = st.history.map((r) => ({ kind: r.kind, points: r.points, order: r.order_id, date: String(r.at).slice(0, 10) }));
    return json({ ok: true, ...st }, 200, { ...c, "Cache-Control": "no-store" });
  }
  if (req.method !== "GET") return json({ ok: false, error: "GET only" }, 405, c);
  if (url.pathname === "/public/reviews") {
    const product = url.searchParams.get("product") || "";
    if (!PRODUCT_RE.test(product)) return json({ ok: false, error: "product" }, 400, c);
    const [agg, rows] = await env.DB.batch([
      env.DB.prepare("select avg(rating) a, count(*) n from reviews where product = ? and status = 'published'").bind(product),
      env.DB.prepare("select rating, text, name, at, verified, lang from reviews where product = ? and status = 'published' order by at desc, id desc limit 50").bind(product),
    ]);
    const a = (agg.results || [])[0] || {};
    return json({
      product, avg: round1(a.a), count: a.n || 0,
      reviews: (rows.results || []).map((r) => ({ rating: r.rating, text: r.text, name: r.name, date: String(r.at).slice(0, 10), verified: r.verified ? 1 : 0, lang: r.lang })),
    }, 200, { ...c, "Cache-Control": "public, max-age=15" });
  }
  if (url.pathname === "/public/ratings") {
    const rows = await all(env, "select product, avg(rating) a, count(*) n from reviews where status = 'published' group by product");
    const out = {};
    for (const r of rows) out[r.product] = { avg: round1(r.a), count: r.n };
    return json(out, 200, { ...c, "Cache-Control": "public, max-age=60" });
  }
  return json({ ok: false, error: "not found" }, 404, c);
}

// ---------- admin session ----------

const COOKIE = "almas_admin";
async function keyTag(env) {
  return (await hmac(env.SESSION_SECRET, "key:" + env.ADMIN_KEY)).slice(0, 16); // a new ADMIN_KEY ends every session
}
async function isAdmin(req, env) {
  if (!env.SESSION_SECRET || !env.ADMIN_KEY) return false;
  const c = cookie(req, COOKIE);
  const dot = c.indexOf(".");
  if (dot < 1) return false;
  const payload = c.slice(0, dot);
  if (!same(c.slice(dot + 1), await hmac(env.SESSION_SECRET, "sess:" + payload))) return false;
  let s;
  try {
    s = JSON.parse(atob(payload));
  } catch {
    return false;
  }
  return !!s && s.exp > nowSec() && s.v === (await keyTag(env));
}
async function login(req, env) {
  const k = "login:" + (await ipHash(env, req.headers.get("CF-Connecting-IP")));
  const t = nowSec();
  const n = await first(env, "select count(*) n from hits where k = ? and at > ?", k, t - LOGIN_WINDOW);
  if (n && n.n >= LOGIN_FAILS) throw new Http(429, "Too many wrong keys. Wait 15 minutes and try again.");
  const b = await body(req);
  if (!(await secretEquals(env, invisibleClean(b.key), env.ADMIN_KEY))) {
    await env.DB.batch([
      env.DB.prepare("insert into hits (k, at) values (?, ?)").bind(k, t),
      env.DB.prepare("delete from hits where at < ?").bind(t - 2 * 86400),
    ]);
    throw new Http(403, "Wrong key.");
  }
  await env.DB.prepare("delete from hits where k = ?").bind(k).run(); // the right key clears the slate
  const payload = btoa(JSON.stringify({ exp: t + SESSION_DAYS * 86400, v: await keyTag(env) }));
  const val = payload + "." + (await hmac(env.SESSION_SECRET, "sess:" + payload));
  return json({ ok: true }, 200, {
    "Set-Cookie": `${COOKIE}=${val}; Path=/admin; Max-Age=${SESSION_DAYS * 86400}; HttpOnly; Secure; SameSite=Strict`,
  });
}

// ---------- admin API ----------

function dayStart(daysAgo) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0); // Morocco is on UTC+0 since 2026-09-20
  return new Date(d.getTime() - daysAgo * 86400000).toISOString();
}

// Customers who are due to order again, from their own rhythm: with 2+ orders, due once more days have passed than
// their usual gap between orders (never under a week); a business (kind 'pro') with a single order, after 30 days.
// Restaurants, hotels and wedding organisers first, then the most overdue. Each comes with its last order's items,
// so the owner's WhatsApp reminder can name them.
async function reorderDue(env, limit = 30) {
  const rows = await all(env,
    "select o.phone_norm, count(*) n, max(o.at) last_at, max(c.name) name, max(c.kind) kind, max(c.business) business, " +
    "julianday('now') - julianday(max(o.at)) days, " +
    "case when count(*) > 1 then (julianday(max(o.at)) - julianday(min(o.at))) / (count(*) - 1) end gap " +
    "from orders o left join customers c on c.phone_norm = o.phone_norm where o.status <> 'cancelled' group by o.phone_norm " +
    "having (n >= 2 and days >= max(7, gap)) or (n = 1 and max(c.kind) = 'pro' and days >= 30) " +
    "order by (max(c.kind) = 'pro') desc, days - coalesce(gap, 30) desc limit ?", limit);
  if (!rows.length) return [];
  const last = await env.DB.batch(rows.map((r) => env.DB.prepare(
    "select i.name_till, i.name, i.qty, i.unit from order_items i where i.order_id = " +
    "(select id from orders where phone_norm = ? and status <> 'cancelled' order by at desc limit 1) order by i.idx").bind(r.phone_norm)));
  return rows.map((r, i) => ({
    phone_norm: r.phone_norm, name: r.name || "", kind: r.kind || "home", business: r.business || "", orders: r.n,
    last_at: r.last_at, days: Math.floor(r.days), gap: r.gap == null ? null : Math.round(r.gap),
    items: (last[i].results || []).map((x) => ({ name: x.name_till || x.name, qty: x.qty, unit: x.unit })),
  }));
}

// ---------- standing orders: the same basket on a rhythm ----------

const EVERY = [7, 14, 30];
const STANDING_STATUS = ["pending", "active", "paused", "stopped"];
const ymd = (d) => d.toISOString().slice(0, 10);
function addDays(day, n) {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return ymd(d);
}
function standingItems(list) {
  const out = [];
  for (const it of (Array.isArray(list) ? list : []).slice(0, 60)) {
    if (!it || typeof it !== "object") continue;
    const product = text(it.product, 20);
    const qty = num(it.qty, 0.001, 10000, 3);
    if (!PRODUCT_RE.test(product) || qty === null) continue;
    out.push({ product, qty, unit: it.unit === "kg" ? "kg" : "piece", name_till: text(it.name_till, 120), name: text(it.name, 120) });
  }
  return out;
}
function standingRow(r) {
  let items = [];
  try { items = JSON.parse(r.items || "[]"); } catch { /* keep empty */ }
  return { ...r, items, due: r.status === "active" && r.next_date !== "" && r.next_date <= ymd(new Date()) };
}

// from the website: the order that was just placed, to be repeated every 7, 14 or 30 days once the owner agrees
async function ingestStanding(env, b) {
  const from = text(b.from_order, 40);
  if (!ID_RE.test(from)) throw new Http(400, "from_order");
  const every = Number(b.every_days);
  if (!EVERY.includes(every)) throw new Http(400, "every_days");
  const name = text(b.name, 80), phone = text(b.phone, 30), pn = phoneNorm(phone);
  if (!name || pn.length < 9 || pn.length > 15) throw new Http(400, "name and phone");
  const items = standingItems(b.items);
  if (!items.length) throw new Http(400, "no items");
  if (await first(env, "select 1 x from standing where from_order = ?", from)) return { ok: true, duplicate: true };
  const start = (iso(b.at) || nowIso()).slice(0, 10);
  try {
    await env.DB.prepare(
      "insert into standing (phone_norm, phone, name, business, address, notes, lang, pay, every_days, next_date, items, status, from_order, last_order, created_at, updated_at) " +
      "values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)"
    ).bind(pn, phone, name, text(b.business, 100), text(b.address, 300, true), text(b.notes, 600, true), oneOf(b.lang, LANGS, "ar"),
      oneOf(b.pay, ["cod", "bank"], "cod"), every, addDays(start, every), JSON.stringify(items), from, from, nowIso(), nowIso()).run();
  } catch (e) {
    if (/UNIQUE|constraint/i.test(String(e && e.message))) return { ok: true, duplicate: true };
    throw e;
  }
  return { ok: true };
}

async function listStanding(env, p) {
  const status = p.get("status") || "";
  const rows = STANDING_STATUS.includes(status)
    ? await all(env, "select * from standing where status = ? order by next_date, id limit 300", status)
    : await all(env, "select * from standing where status <> 'stopped' order by case status when 'pending' then 0 when 'active' then 1 else 2 end, next_date, id limit 300");
  return { ok: true, standing: rows.map(standingRow) };
}

async function updateStanding(env, b) {
  const id = Number(b.id);
  if (!Number.isInteger(id)) throw new Http(400, "id");
  const sets = [], args = [];
  if (b.status !== undefined) {
    if (!STANDING_STATUS.includes(b.status)) throw new Http(400, "status");
    sets.push("status = ?"); args.push(b.status);
  }
  if (b.every_days !== undefined) {
    if (!EVERY.includes(Number(b.every_days))) throw new Http(400, "every_days");
    sets.push("every_days = ?"); args.push(Number(b.every_days));
  }
  if (b.next_date !== undefined) {
    const d = text(b.next_date, 10);
    if (!DATE_RE.test(d)) throw new Http(400, "next_date must be YYYY-MM-DD");
    sets.push("next_date = ?"); args.push(d);
  }
  if (b.items !== undefined) {
    const items = standingItems(b.items);
    if (!items.length) throw new Http(400, "no items");
    sets.push("items = ?"); args.push(JSON.stringify(items));
  }
  if (b.admin_note !== undefined) { sets.push("admin_note = ?"); args.push(text(b.admin_note, 2000, true)); }
  if (!sets.length) throw new Http(400, "nothing to change");
  sets.push("updated_at = ?"); args.push(nowIso(), id);
  const r = await env.DB.prepare("update standing set " + sets.join(", ") + " where id = ?").bind(...args).run();
  if (!r.meta || !r.meta.changes) throw new Http(404, "no such standing order");
  return { ok: true, standing: standingRow(await first(env, "select * from standing where id = ?", id)) };
}

// today's delivery of a standing order: a normal order at the till's current prices, then the next date moves on
async function runStanding(env, b) {
  const id = Number(b.id);
  const s = Number.isInteger(id) ? await first(env, "select * from standing where id = ?", id) : null;
  if (!s) throw new Http(404, "no such standing order");
  if (s.status !== "active") throw new Http(409, "activate it first");
  const today = ymd(new Date());
  const orderId = "AL-" + today.slice(2).replace(/-/g, "") + "-S" + s.id;
  if (await first(env, "select 1 x from orders where id = ?", orderId)) throw new Http(409, "today's order for it already exists: " + orderId);
  let prices = {};
  try {
    prices = Object.fromEntries((await catalogue(env)).products.map((p) => [String(p.id), p]));
  } catch {
    throw new Http(503, "the till's prices could not be read: try again in a minute");
  }
  const items = [];
  for (const it of standingRow(s).items) {
    const p = prices[it.product];
    if (!p || !(Number(p.price) > 0)) continue; // a product the shop no longer sells is skipped, not invented
    items.push({ ...it, name_till: p.ar || it.name_till, unit: p.unit === "kg" ? "kg" : "piece", unit_price: Number(p.price),
                 line: Math.round(it.qty * Number(p.price) * 100) / 100 });
  }
  if (!items.length) throw new Http(409, "none of its products is in the catalogue any more");
  const total = Math.round(items.reduce((t, i) => t + i.line, 0) * 100) / 100;
  const made = { id: orderId, at: nowIso(), lang: s.lang, name: s.name, phone: s.phone, address: s.address, pay: s.pay,
                 notes: "[standing order #" + s.id + ", every " + s.every_days + " days]" + (s.notes ? " " + s.notes : ""),
                 source: "standing", total, items };
  const res = await ingestOrder(env, made);
  if (res && res.ok && !res.duplicate) later(env, sheetPush(env, "order", made));
  const base = s.next_date && s.next_date > today ? s.next_date : today;
  await env.DB.prepare("update standing set last_order = ?, last_done = ?, next_date = ?, updated_at = ? where id = ?")
    .bind(orderId, today, addDays(base, s.every_days), nowIso(), s.id).run();
  return { ok: true, order_id: orderId, total, skipped: standingRow(s).items.length - items.length };
}

async function deleteStanding(env, b) {
  const r = await env.DB.prepare("delete from standing where id = ?").bind(Number(b.id)).run();
  if (!r.meta || !r.meta.changes) throw new Http(404, "no such standing order");
  return { ok: true };
}

async function overview(env) {
  const today = dayStart(0);
  const d7 = dayStart(6);
  const d30 = dayStart(29);
  const [sales, handle, bank, rev, quotes, top, recent] = await env.DB.batch([
    env.DB.prepare(
      "select sum(case when at >= ? then 1 else 0 end) n0, sum(case when at >= ? then total else 0 end) r0, " +
      "sum(case when at >= ? then 1 else 0 end) n7, sum(case when at >= ? then total else 0 end) r7, count(*) n30, sum(total) r30 " +
      "from orders where status <> 'cancelled' and at >= ?"
    ).bind(today, today, d7, d7, d30),
    env.DB.prepare("select count(*) n from orders where status = 'new'"),
    env.DB.prepare("select count(*) n, sum(total) r from orders where pay = 'bank' and paid = 0 and status <> 'cancelled'"),
    env.DB.prepare("select count(*) n from reviews where status = 'pending'"),
    env.DB.prepare("select count(*) n from quotes where status = 'new'"),
    env.DB.prepare(
      "select i.product, max(i.name) name, max(i.name_till) name_till, max(i.unit) unit, sum(i.qty) qty, sum(i.line) revenue " +
      "from order_items i join orders o on o.id = i.order_id where o.status <> 'cancelled' and o.at >= ? group by i.product order by revenue desc limit 8"
    ).bind(d30),
    env.DB.prepare("select id, at, name, total, status, pay, paid from orders order by at desc limit 6"),
  ]);
  const s = (sales.results || [])[0] || {};
  const b = (bank.results || [])[0] || {};
  return {
    ok: true,
    today: { orders: s.n0 || 0, revenue: s.r0 || 0 },
    d7: { orders: s.n7 || 0, revenue: s.r7 || 0 },
    d30: { orders: s.n30 || 0, revenue: s.r30 || 0 },
    to_handle: (handle.results || [])[0].n,
    unpaid_bank: { orders: b.n || 0, amount: b.r || 0 },
    pending_reviews: (rev.results || [])[0].n,
    new_quotes: (quotes.results || [])[0].n,
    top: top.results || [],
    recent: recent.results || [],
    reorder: await reorderDue(env, 12),
    standing_due: (await all(env, "select * from standing where status = 'active' and next_date <> '' and next_date <= ? order by next_date limit 30",
      addDays(ymd(new Date()), 1))).map(standingRow),
    standing_pending: ((await first(env, "select count(*) n from standing where status = 'pending'")) || {}).n || 0,
    // what customers could still take off future orders (an upper bound: lapsed balances are written off lazily)
    points_out: await (async () => {
      const r = await first(env, "select coalesce(sum(points), 0) p, count(distinct phone_norm) n from points");
      const p = r ? Number(r.p) : 0;
      return { points: p, customers: r ? r.n : 0, mad: pointsMad(p), rules: POINTS };
    })(),
  };
}

async function listOrders(env, p) {
  const where = [];
  const args = [];
  const status = p.get("status") || "";
  if (ORDER_STATUS.includes(status)) { where.push("status = ?"); args.push(status); }
  const pay = p.get("pay") || "";
  if (PAYS.includes(pay)) { where.push("pay = ?"); args.push(pay); }
  if (p.get("paid") === "0" || p.get("paid") === "1") { where.push("paid = ?"); args.push(Number(p.get("paid"))); }
  const q = text(p.get("q"), 60);
  if (q) {
    const ors = ["id like ? escape '!'", "name like ? escape '!'", "phone like ? escape '!'"];
    args.push(likeTerm(q), likeTerm(q), likeTerm(q));
    const digits = q.replace(/\D/g, "").replace(/^0+/, "");
    if (digits.length >= 4) { ors.push("phone_norm like ? escape '!'"); args.push(likeTerm(digits)); }
    where.push("(" + ors.join(" or ") + ")");
  }
  const offset = Math.max(0, Math.min(100000, parseInt(p.get("offset") || "0", 10) || 0));
  const rows = await all(env,
    "select id, at, name, phone, phone_norm, pay, paid, total, status, (select count(*) from order_items i where i.order_id = orders.id) lines " +
    "from orders" + (where.length ? " where " + where.join(" and ") : "") + " order by at desc limit 51 offset ?", ...args, offset);
  return { ok: true, orders: rows.slice(0, 50), more: rows.length > 50 };
}

async function getOrder(env, id) {
  const o = await first(env, "select * from orders where id = ?", id);
  if (!o) throw new Http(404, "no such order");
  const [items, cust, revs, pts] = await env.DB.batch([
    env.DB.prepare("select * from order_items where order_id = ? order by idx").bind(id),
    env.DB.prepare("select c.*, (select count(*) from orders where phone_norm = c.phone_norm) orders from customers c where phone_norm = ?").bind(o.phone_norm),
    env.DB.prepare("select id, product, rating, status, verified from reviews where order_id = ? order by id").bind(id),
    env.DB.prepare("select kind, points, mad, at from points where order_id = ? order by id").bind(id),
  ]);
  return { ok: true, order: o, items: items.results || [], customer: (cust.results || [])[0] || null, reviews: revs.results || [],
    points: pts.results || [], points_rules: POINTS };
}

async function updateOrder(env, b) {
  const id = text(b.id, 40);
  const sets = [];
  const args = [];
  if (b.status !== undefined) {
    if (!ORDER_STATUS.includes(b.status)) throw new Http(400, "status");
    sets.push("status = ?"); args.push(b.status);
  }
  if (b.paid !== undefined) {
    const paid = b.paid ? 1 : 0;
    sets.push("paid = ?", "paid_at = " + (paid ? "coalesce(paid_at, ?)" : "?"));
    args.push(paid, paid ? nowIso() : null);
  }
  if (b.admin_note !== undefined) { sets.push("admin_note = ?"); args.push(text(b.admin_note, 2000, true)); }
  if (!sets.length) throw new Http(400, "nothing to change");
  sets.push("updated_at = ?");
  args.push(nowIso(), id);
  const r = await env.DB.prepare("update orders set " + sets.join(", ") + " where id = ?").bind(...args).run();
  if (!r.meta || !r.meta.changes) throw new Http(404, "no such order");
  await syncOrderPoints(env, id);
  return getOrder(env, id);
}

async function deleteOrder(env, b) {
  const id = text(b.id, 40);
  const res = await env.DB.batch([
    env.DB.prepare("delete from order_items where order_id = ?").bind(id),
    env.DB.prepare("delete from orders where id = ?").bind(id),
  ]);
  if (!res[1].meta || !res[1].meta.changes) throw new Http(404, "no such order");
  await syncOrderPoints(env, id); // the order is gone: what it earned goes, what it spent comes back
  return { ok: true };
}

async function listCustomers(env, p) {
  const where = [];
  const args = [];
  if (p.get("due") === "1") { where.push("c.follow_up <> '' and c.follow_up <= ?"); args.push(dayStart(0).slice(0, 10)); }
  const kind = p.get("kind") || "";
  if (kind === "home" || kind === "pro") { where.push("c.kind = ?"); args.push(kind); }
  const q = text(p.get("q"), 60);
  if (q) {
    const ors = ["c.name like ? escape '!'", "c.business like ? escape '!'", "c.tags like ? escape '!'"];
    args.push(likeTerm(q), likeTerm(q), likeTerm(q));
    const digits = q.replace(/\D/g, "").replace(/^0+/, "");
    if (digits.length >= 4) { ors.push("c.phone_norm like ? escape '!'"); args.push(likeTerm(digits)); }
    where.push("(" + ors.join(" or ") + ")");
  }
  const offset = Math.max(0, Math.min(100000, parseInt(p.get("offset") || "0", 10) || 0));
  const rows = await all(env,
    "select c.phone_norm, c.name, c.kind, c.business, c.tags, c.follow_up, c.first_at, c.last_at, " +
    "count(o.id) orders, coalesce(sum(case when o.status <> 'cancelled' then o.total else 0 end), 0) spent, max(o.at) last_order, " +
    "(select count(*) from quotes q where q.phone_norm = c.phone_norm) quotes " +
    "from customers c left join orders o on o.phone_norm = c.phone_norm" + (where.length ? " where " + where.join(" and ") : "") +
    " group by c.phone_norm order by coalesce(c.last_at, '') desc limit 101 offset ?", ...args, offset);
  return { ok: true, customers: rows.slice(0, 100), more: rows.length > 100 };
}

async function getCustomer(env, pn) {
  const c = await first(env, "select * from customers where phone_norm = ?", pn);
  if (!c) throw new Http(404, "no such customer");
  const [orders, quotes] = await env.DB.batch([
    env.DB.prepare("select id, at, total, status, pay, paid from orders where phone_norm = ? order by at desc limit 200").bind(pn),
    env.DB.prepare("select id, at, type, business, status from quotes where phone_norm = ? order by at desc limit 200").bind(pn),
  ]);
  return { ok: true, customer: c, orders: orders.results || [], quotes: quotes.results || [], points: await pointsState(env, pn, 100) };
}

async function updateCustomer(env, b) {
  const pn = text(b.phone_norm, 20);
  const sets = [];
  const args = [];
  if (b.name !== undefined) { sets.push("name = ?"); args.push(text(b.name, 80)); }
  if (b.kind !== undefined) {
    if (b.kind !== "home" && b.kind !== "pro") throw new Http(400, "kind");
    sets.push("kind = ?"); args.push(b.kind);
  }
  if (b.business !== undefined) { sets.push("business = ?"); args.push(text(b.business, 100)); }
  if (b.tags !== undefined) { sets.push("tags = ?"); args.push(text(b.tags, 200)); }
  if (b.notes !== undefined) { sets.push("notes = ?"); args.push(text(b.notes, 2000, true)); }
  if (b.follow_up !== undefined) {
    const f = text(b.follow_up, 10);
    if (f && !DATE_RE.test(f)) throw new Http(400, "follow_up must be YYYY-MM-DD");
    sets.push("follow_up = ?"); args.push(f);
  }
  if (!sets.length) throw new Http(400, "nothing to change");
  sets.push("updated_at = ?");
  args.push(nowIso(), pn);
  const r = await env.DB.prepare("update customers set " + sets.join(", ") + " where phone_norm = ?").bind(...args).run();
  if (!r.meta || !r.meta.changes) throw new Http(404, "no such customer");
  return getCustomer(env, pn);
}

async function deleteCustomer(env, b) {
  const r = await env.DB.prepare("delete from customers where phone_norm = ?").bind(text(b.phone_norm, 20)).run();
  if (!r.meta || !r.meta.changes) throw new Http(404, "no such customer");
  return { ok: true };
}

async function listQuotes(env, p) {
  const where = [];
  const args = [];
  const status = p.get("status") || "";
  if (QUOTE_STATUS.includes(status)) { where.push("status = ?"); args.push(status); }
  const q = text(p.get("q"), 60);
  if (q) {
    where.push("(business like ? escape '!' or contact like ? escape '!' or phone like ? escape '!' or city like ? escape '!' or id like ? escape '!')");
    args.push(likeTerm(q), likeTerm(q), likeTerm(q), likeTerm(q), likeTerm(q));
  }
  const offset = Math.max(0, Math.min(100000, parseInt(p.get("offset") || "0", 10) || 0));
  const rows = await all(env, "select * from quotes" + (where.length ? " where " + where.join(" and ") : "") + " order by at desc limit 51 offset ?", ...args, offset);
  return { ok: true, quotes: rows.slice(0, 50), more: rows.length > 50 };
}

async function updateQuote(env, b) {
  const id = text(b.id, 40);
  const sets = [];
  const args = [];
  if (b.status !== undefined) {
    if (!QUOTE_STATUS.includes(b.status)) throw new Http(400, "status");
    sets.push("status = ?"); args.push(b.status);
  }
  if (b.admin_note !== undefined) { sets.push("admin_note = ?"); args.push(text(b.admin_note, 2000, true)); }
  if (!sets.length) throw new Http(400, "nothing to change");
  sets.push("updated_at = ?");
  args.push(nowIso(), id);
  const r = await env.DB.prepare("update quotes set " + sets.join(", ") + " where id = ?").bind(...args).run();
  if (!r.meta || !r.meta.changes) throw new Http(404, "no such quote");
  return { ok: true, quote: await first(env, "select * from quotes where id = ?", id) };
}

async function deleteQuote(env, b) {
  const r = await env.DB.prepare("delete from quotes where id = ?").bind(text(b.id, 40)).run();
  if (!r.meta || !r.meta.changes) throw new Http(404, "no such quote");
  return { ok: true };
}

async function listReviews(env, p) {
  const where = [];
  const args = [];
  const status = p.get("status") || "";
  if (REVIEW_STATUS.includes(status)) { where.push("r.status = ?"); args.push(status); }
  const product = p.get("product") || "";
  if (PRODUCT_RE.test(product)) { where.push("r.product = ?"); args.push(product); }
  const rows = await all(env,
    "select r.id, r.product, r.rating, r.text, r.name, r.lang, r.order_id, r.verified, r.status, r.at, " +
    "(select 1 from orders o where o.id = r.order_id) order_exists from reviews r" + (where.length ? " where " + where.join(" and ") : "") +
    " order by case r.status when 'pending' then 0 else 1 end, r.at desc, r.id desc limit 200", ...args);
  const names = await productNames(env);
  return { ok: true, reviews: rows.map((r) => ({ ...r, product_name: names[r.product] || null })) };
}

async function updateReview(env, b) {
  const id = parseInt(b.id, 10);
  if (!(id > 0)) throw new Http(400, "id");
  if (!REVIEW_STATUS.includes(b.status)) throw new Http(400, "status");
  const r = await env.DB.prepare("update reviews set status = ? where id = ?").bind(b.status, id).run();
  if (!r.meta || !r.meta.changes) throw new Http(404, "no such review");
  return { ok: true };
}

async function deleteReview(env, b) {
  const id = parseInt(b.id, 10);
  if (!(id > 0)) throw new Http(400, "id");
  const r = await env.DB.prepare("delete from reviews where id = ?").bind(id).run();
  if (!r.meta || !r.meta.changes) throw new Http(404, "no such review");
  return { ok: true };
}

async function products(env) {
  const d30 = dayStart(29);
  const [sales, ratings] = await env.DB.batch([
    env.DB.prepare(
      "select i.product, max(i.name) name, max(i.unit) unit, sum(i.qty) qty, sum(i.line) revenue from order_items i " +
      "join orders o on o.id = i.order_id where o.status <> 'cancelled' and o.at >= ? group by i.product"
    ).bind(d30),
    env.DB.prepare("select product, avg(rating) a, count(*) n, sum(case when status = 'pending' then 1 else 0 end) pending from reviews group by product"),
  ]);
  const sold = Object.fromEntries((sales.results || []).map((r) => [r.product, r]));
  const rate = {};
  for (const r of ratings.results || []) rate[r.product] = r;
  const pub = Object.fromEntries((await all(env,
    "select product, avg(rating) a, count(*) n from reviews where status = 'published' group by product")).map((r) => [r.product, r]));
  let cat = null;
  let error = "";
  try {
    cat = await catalogue(env);
  } catch (e) {
    error = "The till's catalogue is unreachable right now: showing products with sales only.";
  }
  const list = (cat ? cat.products : Object.values(sold).map((s) => ({ id: s.product, ar: s.name, unit: s.unit })))
    .map((p) => {
      const s = sold[p.id] || {};
      const r = pub[p.id] || {};
      return { id: p.id, ar: p.ar || "", fr: p.fr || "", en: p.en || "", cat: p.cat || "", price: p.price ?? null, unit: p.unit || "",
        qty30: Math.round((s.qty || 0) * 1000) / 1000, rev30: Math.round((s.revenue || 0) * 100) / 100,
        avg: round1(r.a), count: r.n || 0, pending: (rate[p.id] || {}).pending || 0 };
    });
  list.sort((a, b) => b.rev30 - a.rev30 || b.count - a.count || String(a.ar).localeCompare(String(b.ar)));
  return { ok: true, products: list, categories: cat ? cat.categories : [], error };
}

// ---------- CSV ----------

function csvCell(v) {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@]/.test(s) || s.startsWith(String.fromCharCode(9)) || s.startsWith(String.fromCharCode(13))) s = "'" + s; // no formulas in Excel
  return /[",\n\r;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function csv(name, header, rows) {
  const lines = [header, ...rows].map((r) => r.map(csvCell).join(","));
  return new Response(BOM + lines.join(CRLF) + CRLF, {
    headers: head("text/csv; charset=utf-8", { "Content-Disposition": `attachment; filename="${name}"` }),
  });
}
function qtyText(q, unit) {
  if (unit !== "kg") return "x" + q;
  return q < 1 ? Math.round(q * 1000) + " g" : q + " kg";
}
async function exportOrders(env) {
  const [orders, items] = await env.DB.batch([
    env.DB.prepare("select * from orders order by at desc limit 20000"),
    env.DB.prepare("select order_id, name, name_till, product, qty, unit from order_items order by order_id, idx"),
  ]);
  const by = {};
  for (const i of items.results || []) (by[i.order_id] = by[i.order_id] || []).push(`${i.name || i.name_till || i.product} ${qtyText(i.qty, i.unit)}`);
  return csv(`almas-orders-${dayStart(0).slice(0, 10)}.csv`,
    ["id", "date_utc", "status", "name", "phone", "whatsapp", "address", "notes", "payment", "paid", "paid_at", "total_mad", "items", "lang", "source", "admin_note"],
    (orders.results || []).map((o) => [o.id, o.at, o.status, o.name, o.phone, o.phone_norm, o.address, o.notes, o.pay, o.paid ? "yes" : "no",
      o.paid_at || "", o.total, (by[o.id] || []).join(" | "), o.lang, o.source, o.admin_note]));
}
async function exportCustomers(env) {
  const rows = await all(env,
    "select c.*, count(o.id) orders, coalesce(sum(case when o.status <> 'cancelled' then o.total else 0 end), 0) spent, max(o.at) last_order, " +
    "(select count(*) from quotes q where q.phone_norm = c.phone_norm) quotes from customers c left join orders o on o.phone_norm = c.phone_norm " +
    "group by c.phone_norm order by coalesce(c.last_at, '') desc limit 20000");
  return csv(`almas-customers-${dayStart(0).slice(0, 10)}.csv`,
    ["whatsapp", "name", "kind", "business", "tags", "notes", "follow_up", "orders", "spent_mad", "quotes", "first_at", "last_order"],
    rows.map((c) => [c.phone_norm, c.name, c.kind, c.business, c.tags, c.notes, c.follow_up, c.orders, c.spent, c.quotes, c.first_at || "", c.last_order || ""]));
}

// ---------- admin routing ----------

const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; " +
  "base-uri 'none'; form-action 'self'; frame-ancestors 'none'";
const STATIC = { "index.html": "text/html; charset=utf-8", "app.js": "text/javascript; charset=utf-8", "app.css": "text/css; charset=utf-8" };

function asset(name) {
  if (!(name in STATIC) || typeof ASSETS[name] !== "string") return json({ ok: false, error: "not found" }, 404);
  return new Response(ASSETS[name], { headers: head(STATIC[name], { "Content-Security-Policy": CSP, "X-Robots-Tag": "noindex, nofollow" }) });
}

async function admin(req, env, url) {
  const path = url.pathname;
  if (path === "/admin" || path === "/admin/") return asset("index.html");
  if (path === "/admin/app.js" || path === "/admin/app.css") return asset(path.slice(7));
  if (path.startsWith("/admin/api/") && req.method === "POST") {
    // CSRF: a cross-site form cannot set a custom header or a JSON content type; a foreign Origin is refused too
    const origin = req.headers.get("Origin");
    if (req.headers.get("X-Almas-Csrf") !== "1" || !(req.headers.get("Content-Type") || "").includes("application/json") ||
        (origin && origin !== url.origin)) {
      throw new Http(403, "csrf");
    }
    if (path === "/admin/api/login") return login(req, env);
    if (path === "/admin/api/logout") {
      return json({ ok: true }, 200, { "Set-Cookie": `${COOKIE}=; Path=/admin; Max-Age=0; HttpOnly; Secure; SameSite=Strict` });
    }
  }
  // the page's first "am I signed in?" question answers 200 either way: a 401 there is a console error in every browser
  if (path === "/admin/api/me" && req.method === "GET") return json({ ok: true, admin: await isAdmin(req, env) });
  if (!(await isAdmin(req, env))) throw new Http(401, "login");
  const p = url.searchParams;
  if (req.method === "GET") {
    switch (path) {
      case "/admin/api/overview": return json(await overview(env));
      case "/admin/api/orders": return json(await listOrders(env, p));
      case "/admin/api/order": return json(await getOrder(env, text(p.get("id"), 40)));
      case "/admin/api/customers": return json(await listCustomers(env, p));
      case "/admin/api/customer": return json(await getCustomer(env, text(p.get("phone"), 20)));
      case "/admin/api/quotes": return json(await listQuotes(env, p));
      case "/admin/api/reviews": return json(await listReviews(env, p));
      case "/admin/api/products": return json(await products(env));
      case "/admin/api/standing": return json(await listStanding(env, p));
      case "/admin/api/sheet": return json(await sheetInfo(env));
      case "/admin/export/orders.csv": return exportOrders(env);
      case "/admin/export/customers.csv": return exportCustomers(env);
    }
  } else if (req.method === "POST") {
    const b = await body(req);
    switch (path) {
      case "/admin/api/order": return json(await updateOrder(env, b));
      case "/admin/api/order/delete": return json(await deleteOrder(env, b));
      case "/admin/api/customer": return json(await updateCustomer(env, b));
      case "/admin/api/customer/delete": return json(await deleteCustomer(env, b));
      case "/admin/api/quote": return json(await updateQuote(env, b));
      case "/admin/api/quote/delete": return json(await deleteQuote(env, b));
      case "/admin/api/review": return json(await updateReview(env, b));
      case "/admin/api/review/delete": return json(await deleteReview(env, b));
      case "/admin/api/standing": return json(await updateStanding(env, b));
      case "/admin/api/standing/run": return json(await runStanding(env, b));
      case "/admin/api/standing/delete": return json(await deleteStanding(env, b));
      case "/admin/api/points": return json(await adjustPoints(env, b));
      case "/admin/api/sheet": return json(await sheetConnect(env, b));
      case "/admin/api/sheet/test": { const r = await sheetSend(env, "test", [[nowIso(), "Test from the Almas back office."]]); if (!r.ok) throw new Http(400, r.error); return json(r); }
      case "/admin/api/sheet/backfill": return json(await sheetBackfill(env));
      case "/admin/api/sheet/disconnect": await setSetting(env, "sheet_url", ""); return json({ ok: true, connected: false });
    }
  }
  throw new Http(404, "not found");
}

// ---------- Google Sheet: every new order, request and review also lands as a row in the owner's own sheet ----------
// The owner pastes a small Apps Script into his sheet (the back office shows it, with this shop's secret in it) and
// deploys it as a web app; its URL is kept in D1. Rows go out after the reply (waitUntil), so a slow or missing
// sheet never delays or fails a customer's order: D1 stays the record, the sheet is a copy.

const SHEET_URL_RE = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{20,}\/exec$/;
const SHEET_HEADS = {
  order: ["Date", "Order", "Name", "Phone", "Address", "Items", "Total (DH)", "Payment", "Language", "Notes", "Source"],
  quote: ["Date", "Request", "Business", "Contact", "Phone", "City", "Type", "Event date", "Guests", "How often", "Items"],
  standing: ["Date", "From order", "Name", "Phone", "Business", "Every (days)", "Items", "Address", "Notes"],
  review: ["Date", "Product", "Stars", "Name", "Text", "Order", "Language"],
  test: ["Date", "Message"],
};

async function setting(env, k) {
  const r = await first(env, "select v from settings where k = ?", k);
  return r ? r.v : "";
}
async function setSetting(env, k, v) {
  await env.DB.prepare("insert into settings (k, v, updated_at) values (?, ?, ?) on conflict(k) do update set v = excluded.v, updated_at = excluded.updated_at")
    .bind(k, v, nowIso()).run();
}
async function sheetSecret(env) {
  let s = await setting(env, "sheet_secret");
  if (!s) {
    s = hex(crypto.getRandomValues(new Uint8Array(24)));
    await setSetting(env, "sheet_secret", s);
  }
  return s;
}

const cell = (v, max = 500) => text(v == null ? "" : v, max, true);
function itemsText(items) {
  return (Array.isArray(items) ? items : []).slice(0, 60).map((i) => {
    const q = Number(i && i.qty) || 0;
    const unit = i && i.unit === "kg" ? " kg" : " x";
    return q + unit + " " + cell((i && (i.name_till || i.name || i.product)) || "", 80);
  }).join("; ");
}
function sheetRow(kind, b) {
  const at = iso(b.at) || nowIso();
  if (kind === "order") return [at, cell(b.id, 40), cell(b.name, 80), cell(b.phone, 30), cell(b.address, 300), itemsText(b.items),
    num(b.total, 0, 100000000) ?? "", oneOf(b.pay, PAYS, "cod"), oneOf(b.lang, LANGS, "ar"), cell(b.notes, 600), cell(b.source, 40)];
  if (kind === "quote") return [at, cell(b.id, 40), cell(b.business, 100), cell(b.contact, 80), cell(b.phone, 30), cell(b.city, 60),
    cell(b.type, 40), cell(b.date, 10), cell(b.guests, 6), cell(b.freq, 30), cell(b.items, 1500)];
  if (kind === "standing") return [at, cell(b.from_order, 40), cell(b.name, 80), cell(b.phone, 30), cell(b.business, 100),
    Number(b.every_days) || "", itemsText(b.items), cell(b.address, 300), cell(b.notes, 600)];
  if (kind === "review") return [at, cell(b.product, 20), Number(b.rating) || "", cell(b.name, 60), cell(b.text, 1000),
    cell(b.order_id, 40), oneOf(b.lang, LANGS, "ar")];
  return null;
}

// one POST to the owner's Apps Script; it answers through a redirect, which fetch follows
async function sheetSend(env, kind, rows) {
  const url = await setting(env, "sheet_url");
  if (!url) return { ok: false, error: "not connected" };
  const secret = await sheetSecret(env);
  try {
    const r = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" }, redirect: "follow",
      body: JSON.stringify({ secret, kind, head: SHEET_HEADS[kind], rows }),
      signal: AbortSignal.timeout(15000),
    });
    const t = await r.text();
    let j = null;
    try { j = JSON.parse(t); } catch (e) { /* Google answered with a page: wrong URL or the script is not deployed for "Anyone" */ }
    if (!j) return { ok: false, error: "the sheet did not answer (HTTP " + r.status + "): check the web app URL and that access is set to Anyone" };
    if (!j.ok) return { ok: false, error: "the sheet refused: " + (j.error || "unknown") };
    return { ok: true, added: j.added || rows.length };
  } catch (e) {
    return { ok: false, error: "could not reach the sheet: " + String((e && e.message) || e).slice(0, 120) };
  }
}

async function sheetPush(env, kind, b) {
  const row = sheetRow(kind, b);
  if (!row) return;
  const r = await sheetSend(env, kind, [row]);
  if (!r.ok && r.error !== "not connected") console.error("almas-shop sheet", kind, r.error);
}

function sheetScript(secret) {
  return [
    "// Almas: new orders, business requests, standing orders and reviews arrive in this sheet as rows.",
    "// Paste all of this into Extensions > Apps Script, then Deploy > New deployment > Web app,",
    "// Execute as: Me, Who has access: Anyone. Copy the Web app URL into the Almas back office.",
    "var SECRET = \"" + secret + "\";",
    "var TABS = { order: \"Orders\", quote: \"Business requests\", standing: \"Standing orders\", review: \"Reviews\", test: \"Test\" };",
    "",
    "function doPost(e) {",
    "  var b;",
    "  try { b = JSON.parse(e.postData.contents); } catch (err) { return out({ ok: false, error: \"bad json\" }); }",
    "  if (!b || b.secret !== SECRET) return out({ ok: false, error: \"secret\" });",
    "  var tab = TABS[b.kind];",
    "  if (!tab || !b.rows || !b.rows.length) return out({ ok: false, error: \"nothing to add\" });",
    "  var lock = LockService.getScriptLock();",
    "  lock.waitLock(20000);",
    "  try {",
    "    var ss = SpreadsheetApp.getActiveSpreadsheet();",
    "    var sh = ss.getSheetByName(tab) || ss.insertSheet(tab);",
    "    if (sh.getLastRow() === 0 && b.head) {",
    "      sh.appendRow(b.head);",
    "      sh.getRange(1, 1, 1, b.head.length).setFontWeight(\"bold\").setBackground(\"#f3dfc0\");",
    "      sh.setFrozenRows(1);",
    "    }",
    "    var rows = b.rows.map(function (r) { return r.map(clean); });",
    "    sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);",
    "  } finally {",
    "    lock.releaseLock();",
    "  }",
    "  return out({ ok: true, added: b.rows.length });",
    "}",
    "",
    "// a cell that starts with = + - or @ would run as a formula, and a phone like 06 12 34 56 78 would lose its 0:",
    "// both are kept as text",
    "function clean(v) {",
    "  if (v === null || v === undefined) return \"\";",
    "  if (typeof v === \"string\" && (/^[=+\\-@]/.test(v) || /^0[0-9 ]+$/.test(v))) return \"'\" + v;",
    "  return v;",
    "}",
    "",
    "function out(o) {",
    "  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);",
    "}",
    "",
  ].join(NL);
}

async function sheetInfo(env) {
  const url = await setting(env, "sheet_url");
  return { ok: true, connected: !!url, url, script: sheetScript(await sheetSecret(env)) };
}
async function sheetConnect(env, b) {
  const url = text(b.url, 300).trim();
  if (!SHEET_URL_RE.test(url)) throw new Http(400, "Paste the Web app URL: it starts with https://script.google.com/macros/s/ and ends with /exec");
  await setSetting(env, "sheet_url", url);
  const r = await sheetSend(env, "test", [[nowIso(), "Almas is connected to this sheet."]]);
  if (!r.ok) {
    await setSetting(env, "sheet_url", "");
    throw new Http(400, r.error);
  }
  return { ok: true, connected: true, url };
}
async function sheetBackfill(env) {
  const [orders, items] = await env.DB.batch([
    env.DB.prepare("select * from orders order by at asc limit 2000"),
    env.DB.prepare("select order_id, name, name_till, product, qty, unit from order_items order by order_id, idx"),
  ]);
  const byOrder = {};
  for (const i of items.results || []) (byOrder[i.order_id] = byOrder[i.order_id] || []).push(i);
  const rows = (orders.results || []).map((o) => sheetRow("order", { ...o, items: byOrder[o.id] || [] }));
  if (!rows.length) return { ok: true, added: 0 };
  let added = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const r = await sheetSend(env, "order", rows.slice(i, i + 200));
    if (!r.ok) throw new Http(502, r.error + (added ? " (" + added + " rows were added before this)" : ""));
    added += r.added;
  }
  return { ok: true, added };
}

async function route(req, env) {
  const url = new URL(req.url);
  const path = url.pathname;
  if (path === "/health") {
    const r = await env.DB.prepare("select 1 x").first();
    return json({ ok: true, db: !!(r && r.x === 1) });
  }
  if (path === "/") return new Response(null, { status: 302, headers: { Location: "/admin" } });
  if (path.startsWith("/public/")) return publicApi(req, env, url);
  if (path.startsWith("/ingest/")) {
    if (req.method !== "POST") throw new Http(405, "POST only");
    if (!(await secretEquals(env, req.headers.get("X-Almas-Secret"), env.INGEST_SECRET))) throw new Http(401, "secret");
    const b = await body(req);
    const kinds = { "/ingest/order": ["order", ingestOrder], "/ingest/paid": [null, ingestPaid], "/ingest/quote": ["quote", ingestQuote],
      "/ingest/review": ["review", ingestReview], "/ingest/standing": ["standing", ingestStanding],
      "/ingest/points-redeem": [null, ingestRedeem], "/ingest/points-release": [null, ingestRelease] };
    const k = kinds[path];
    if (!k) throw new Http(404, "not found");
    const res = await k[1](env, b);
    if (k[0] && res && res.ok && !res.duplicate) later(env, sheetPush(env, k[0], b));
    return json(res);
  }
  if (path === "/admin" || path.startsWith("/admin/")) return admin(req, env, url);
  throw new Http(404, "not found");
}

// work that runs after the reply has gone (the Google Sheet copy)
function later(env, promise) {
  const p = Promise.resolve(promise).catch((e) => console.error("almas-shop later", e && e.stack ? e.stack : e));
  if (env.__ctx && env.__ctx.waitUntil) env.__ctx.waitUntil(p);
  return p;
}

export default {
  async fetch(req, env, ctx) {
    env = Object.assign({}, env, { __ctx: ctx });
    try {
      return await route(req, env);
    } catch (e) {
      if (e instanceof Http) {
        const extra = new URL(req.url).pathname.startsWith("/public/") ? cors(req) : undefined;
        return json({ ok: false, error: e.message }, e.status, extra);
      }
      console.error("almas-shop", e && e.stack ? e.stack : e);
      return json({ ok: false, error: "server error" }, 500);
    }
  },
};
