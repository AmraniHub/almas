// Referrals: a real customer invites a real new one; both get points when the newcomer's first order is delivered.
//   node --test cloud/tests/referral.test.mjs
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
const SITE = "https://almas-epices.vercel.app";
let worker, env, cookie = "", seq = 0;

before(async () => {
  const dir = mkdtempSync(join(tmpdir(), "almas-ref-"));
  const file = join(dir, "worker.mjs");
  writeFileSync(file, bundle(), "utf8");
  worker = (await import(pathToFileURL(file).href)).default;
  env = {
    DB: fakeD1(join(HERE, "..", "schema.sql")),
    INGEST_SECRET: SECRET, ADMIN_KEY: KEY, SESSION_SECRET: "session-secret-for-tests",
    ARONIUM: { fetch: async () => new Response(JSON.stringify({ products: [{ id: "p6", ar: "كمون", price: 120, unit: "kg" }] })) },
  };
  const r = await call("/admin/api/login", { method: "POST", body: { key: KEY }, headers: { "X-Almas-Csrf": "1" }, ip: "10.1.1.1" });
  cookie = r.headers.get("Set-Cookie").split(";")[0];
});

function call(path, { method = "GET", body, headers = {}, ip = "10.0.0.2" } = {}) {
  const h = { "CF-Connecting-IP": ip, ...headers };
  if (body !== undefined) h["Content-Type"] = "application/json";
  return worker.fetch(new Request(BASE + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }), env);
}
const ingest = async (kind, body) => (await call("/ingest/" + kind, { method: "POST", body, headers: { "X-Almas-Secret": SECRET } })).json();
const admin = async (path, body) => (await call("/admin/api/" + path, { method: body ? "POST" : "GET", body,
  headers: body ? { Cookie: cookie, "X-Almas-Csrf": "1" } : { Cookie: cookie } })).json();
const rows = (sql, ...a) => env.DB.raw.prepare(sql).all(...a);
const balance = (pn) => rows("select coalesce(sum(points), 0) b from points where phone_norm = ?", pn)[0].b;
const pnOf = (phone) => "212" + phone.slice(1);
async function order(phone, total, extra = {}) {
  const id = "AL-RF-" + String(++seq).padStart(4, "0");
  await ingest("order", { id, at: new Date().toISOString(), name: "Buyer " + seq, phone, pay: "cod", total, source: "web", address: "Rue " + seq + " Tanger",
    items: [{ product: "p6", name_till: "كمون", name: "Cumin", qty: 1, unit: "kg", unit_price: total, line: total }], ...extra });
  return id;
}
const status = (id, s) => admin("order", { id, status: s });
const ref = (id) => rows("select * from referrals where order_id = ?", id)[0];
// a customer with a delivered order, and the invite code the website shows them
async function inviter(phone) {
  const id = await order(phone, 300);
  const before = await (await call("/public/points", { method: "POST", body: { phone, ids: [id] }, ip: "10.9." + seq + ".1", headers: { Origin: SITE } })).json();
  assert.equal(before.invite.code, "", "no code before a delivered order");
  await status(id, "delivered");
  const d = await (await call("/public/points", { method: "POST", body: { phone, ids: [id] }, ip: "10.9." + seq + ".2", headers: { Origin: SITE } })).json();
  assert.match(d.invite.code, /^[A-Z2-9]{6}$/);
  return d.invite.code;
}

test("a real newcomer's first delivered order rewards both, once", async () => {
  const code = await inviter("0612000001");
  const friend = "0612000002";
  const id = await order(friend, 400, { ref: code });
  assert.equal(ref(id).status, "pending");
  assert.equal(balance(pnOf(friend)), 0, "nothing before delivery");
  await status(id, "confirmed");
  await status(id, "preparing");
  assert.deepEqual([ref(id).status, balance(pnOf(friend))], ["pending", 0], "confirmed or preparing is not delivered");
  await status(id, "delivered");
  assert.equal(ref(id).status, "rewarded");
  assert.equal(balance(pnOf("0612000001")), 30 + 100); // own order 300 MAD + the invite
  assert.equal(balance(pnOf(friend)), 40 + 100); // own order 400 MAD + welcome
  await status(id, "delivered");
  await admin("order", { id, admin_note: "re-saved" });
  assert.equal(rows("select * from points where order_id = ? and kind in ('refer', 'welcome')", id).length, 2);
  const again = await (await call("/public/points", { method: "POST", body: { phone: "0612000001", ids: [rows("select id from orders where phone_norm = ? order by at limit 1", pnOf("0612000001"))[0].id] }, ip: "10.8.8.8", headers: { Origin: SITE } })).json();
  assert.equal(again.invite.code, code, "the code stays the same");
  assert.equal(again.invite.friends, 1);
});

test("fakes get nothing: own code, an existing customer, a second invite, an unknown code", async () => {
  const code = await inviter("0612000011");
  const own = await order("0612000011", 500, { ref: code });
  await status(own, "delivered");
  assert.deepEqual([ref(own).status, ref(own).note], ["rejected", "own invite code"]);
  const old = "0612000012";
  await order(old, 250);
  const second = await order(old, 500, { ref: code });
  await status(second, "delivered");
  assert.deepEqual([ref(second).status, ref(second).note], ["rejected", "not a new customer"]);
  const code2 = await inviter("0612000013");
  const friend = "0612000014";
  const first = await order(friend, 300, { ref: code });
  const another = await order(friend, 300, { ref: code2 }); // the same newcomer, invited again by someone else
  assert.equal(ref(another), undefined, "one invite per newcomer");
  assert.equal(ref(first).referrer, pnOf("0612000011"));
  const unknown = await order("0612000015", 900, { ref: "ZZZZZZ" });
  assert.equal(ref(unknown), undefined);
  assert.equal(rows("select * from points where kind in ('refer', 'welcome') and phone_norm in (?, ?)", pnOf("0612000011"), pnOf("0612000012")).length, 0);
});

test("a small first order, the same address, and too many invites wait for the owner, who decides", async () => {
  const inv = "0612000021";
  const code = await inviter(inv);
  const small = await order("0612000022", 120, { ref: code });
  await status(small, "delivered");
  assert.equal(ref(small).status, "small");
  const home = await order("0612000023", 500, { ref: code, address: rows("select address from orders where phone_norm = ? limit 1", pnOf(inv))[0].address.toUpperCase() + " " });
  assert.equal(ref(home).status, "review");
  await status(home, "delivered");
  assert.equal(balance(pnOf("0612000023")), 50, "no welcome while it waits");
  const r = await admin("referral", { order_id: home, action: "approve" });
  assert.equal(r.referral.status, "rewarded");
  assert.equal(balance(pnOf("0612000023")), 150);
  await admin("referral", { order_id: small, action: "reject" });
  assert.equal(ref(small).status, "rejected");
  // the monthly cap: set to 2 for the test, the inviter already has 1 rewarded
  const rules = (await admin("points/rules")).rules;
  await admin("points/rules", { ...rules, referral: { ...rules.referral, month_cap: 2 } });
  const a = await order("0612000024", 300, { ref: code });
  await status(a, "delivered");
  const b = await order("0612000025", 300, { ref: code });
  await status(b, "delivered");
  assert.deepEqual([ref(a).status, ref(b).status], ["rewarded", "capped"]);
  assert.equal((await admin("referral", { order_id: b, action: "approve" })).referral.status, "rewarded");
  await admin("points/rules", { ...rules, referral: rules.referral });
  const list = await admin("referrals?status=rewarded");
  assert.ok(list.referrals.length >= 3 && list.counts.rejected >= 1);
});

test("cancelling or deleting the first order takes both rewards back; switched off, nothing is given", async () => {
  const inv = "0612000031", code = await inviter(inv);
  const id = await order("0612000032", 400, { ref: code });
  await status(id, "delivered");
  assert.equal(balance(pnOf(inv)), 130);
  await status(id, "cancelled");
  assert.deepEqual([balance(pnOf(inv)), balance(pnOf("0612000032"))], [30, 0]);
  await status(id, "delivered");
  assert.equal(ref(id).status, "rewarded", "delivered again: rewarded again");
  await admin("order/delete", { id });
  assert.equal(ref(id), undefined);
  assert.equal(balance(pnOf(inv)), 30);
  const rules = (await admin("points/rules")).rules;
  await admin("points/rules", { ...rules, referral: { ...rules.referral, enabled: false } });
  const off = await order("0612000033", 400, { ref: code });
  await status(off, "delivered");
  assert.equal(ref(off).status, "pending");
  assert.equal(balance(pnOf("0612000033")), 40);
  const pub = await (await call("/public/points", { method: "POST", body: { phone: inv, ids: [rows("select id from orders where phone_norm = ? limit 1", pnOf(inv))[0].id] }, ip: "10.7.7.7", headers: { Origin: SITE } })).json();
  assert.equal(pub.invite, null, "no invite link while referrals are off");
  await admin("points/rules", { ...rules, referral: { ...rules.referral, enabled: true } });
  await status(off, "preparing");
  await status(off, "delivered");
  assert.equal(ref(off).status, "rewarded", "switched back on, the next delivery pays");
});

test("the order page shows who invited the customer; the rules are public for the website", async () => {
  const code = await inviter("0612000041");
  const id = await order("0612000042", 300, { ref: code });
  const o = await admin("order?id=" + id);
  assert.equal(o.referral.referrer, pnOf("0612000041"));
  assert.equal(o.referral.status, "pending");
  const pub = await (await call("/public/points-rules")).json();
  assert.deepEqual([pub.referral.referrer_points, pub.referral.newcomer_points, pub.referral.min_order], [100, 100, 200]);
  assert.equal((await admin("points/rules", { referral: { min_order: -1 } })).ok, false);
});

test("a card order rewards only once the card payment is in", async () => {
  const code = await inviter("0612000051");
  const id = await order("0612000052", 400, { ref: code, pay: "card" });
  await status(id, "delivered");
  assert.deepEqual([ref(id).status, balance(pnOf("0612000052"))], ["pending", 0]);
  await ingest("paid", { id, amount: 400, stripe_session: "cs_test_ref" });
  assert.equal(ref(id).status, "rewarded");
  assert.equal(balance(pnOf("0612000052")), 140);
});

test("the website can ask whether an invite code is real, and learns nothing else", async () => {
  const code = await inviter("0612000061");
  const ask = async (c) => (await (await call("/public/ref-check?code=" + c, { headers: { Origin: SITE } })).json());
  assert.deepEqual(await ask(code), { ok: true, valid: true });
  assert.deepEqual(await ask(code.toLowerCase()), { ok: true, valid: true });
  assert.deepEqual(await ask("ZZZZZZ"), { ok: true, valid: false });
  assert.deepEqual(await ask("abc"), { ok: true, valid: false });
  const rules = (await admin("points/rules")).rules;
  await admin("points/rules", { ...rules, referral: { ...rules.referral, enabled: false } });
  assert.deepEqual(await ask(code), { ok: true, valid: false }, "invites switched off: no code is promised");
  await admin("points/rules", { ...rules, referral: { ...rules.referral, enabled: true } });
});
