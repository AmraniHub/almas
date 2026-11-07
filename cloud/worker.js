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
const LANGS = ["ar", "fr", "en"];
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
    }, 200, { ...c, "Cache-Control": "public, max-age=60" });
  }
  if (url.pathname === "/public/ratings") {
    const rows = await all(env, "select product, avg(rating) a, count(*) n from reviews where status = 'published' group by product");
    const out = {};
    for (const r of rows) out[r.product] = { avg: round1(r.a), count: r.n };
    return json(out, 200, { ...c, "Cache-Control": "public, max-age=300" });
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
  const [items, cust, revs] = await env.DB.batch([
    env.DB.prepare("select * from order_items where order_id = ? order by idx").bind(id),
    env.DB.prepare("select c.*, (select count(*) from orders where phone_norm = c.phone_norm) orders from customers c where phone_norm = ?").bind(o.phone_norm),
    env.DB.prepare("select id, product, rating, status, verified from reviews where order_id = ? order by id").bind(id),
  ]);
  return { ok: true, order: o, items: items.results || [], customer: (cust.results || [])[0] || null, reviews: revs.results || [] };
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
  return getOrder(env, id);
}

async function deleteOrder(env, b) {
  const id = text(b.id, 40);
  const res = await env.DB.batch([
    env.DB.prepare("delete from order_items where order_id = ?").bind(id),
    env.DB.prepare("delete from orders where id = ?").bind(id),
  ]);
  if (!res[1].meta || !res[1].meta.changes) throw new Http(404, "no such order");
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
  return { ok: true, customer: c, orders: orders.results || [], quotes: quotes.results || [] };
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
    }
  }
  throw new Http(404, "not found");
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
    if (path === "/ingest/order") return json(await ingestOrder(env, b));
    if (path === "/ingest/paid") return json(await ingestPaid(env, b));
    if (path === "/ingest/quote") return json(await ingestQuote(env, b));
    if (path === "/ingest/review") return json(await ingestReview(env, b));
    throw new Http(404, "not found");
  }
  if (path === "/admin" || path.startsWith("/admin/")) return admin(req, env, url);
  throw new Http(404, "not found");
}

export default {
  async fetch(req, env) {
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
