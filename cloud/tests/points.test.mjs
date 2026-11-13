// Loyalty points in the back office: earned on delivery, spent at checkout, given back on cancel, lapsing after a year.
//   node --test cloud/tests/points.test.mjs
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdtempSync, readFileSync } from "node:fs";
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
let worker, env, cookie = "";

before(async () => {
  const dir = mkdtempSync(join(tmpdir(), "almas-points-"));
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
const order = (id, phone, total, extra = {}) => ingest("order", {
  id, at: new Date().toISOString(), name: "Buyer", phone, pay: "cod", total, source: "web",
  items: [{ product: "p6", name_till: "كمون", name: "Cumin", qty: 1, unit: "kg", unit_price: total, line: total }], ...extra,
});
const status = (id, s) => admin("order", { id, status: s });
const publicPoints = (phone, ids, ip = "10.3.3.3") =>
  call("/public/points", { method: "POST", body: { phone, ids }, ip, headers: { Origin: SITE } });

test("the rules in the worker and on the website are the same numbers", () => {
  const src = readFileSync(join(HERE, "..", "worker.js"), "utf8");
  const m = src.match(/const POINTS = (\{[^}]+\});/);
  assert.ok(m, "POINTS constant");
  const worker = Function("return " + m[1])();
  const site = JSON.parse(readFileSync(join(HERE, "..", "..", "site", "config.json"), "utf8")).points;
  for (const k of Object.keys(worker)) assert.equal(site[k], worker[k], k);
});

test("points arrive only when the order is delivered, once, and leave if it goes back or is cancelled", async () => {
  const pn = "212611000001";
  await order("AL-PT-0001", "0611000001", 237.5);
  await status("AL-PT-0001", "confirmed");
  assert.equal(balance(pn), 0);
  await status("AL-PT-0001", "delivered");
  assert.equal(balance(pn), 23); // 1 point per 10 MAD, rounded down
  await status("AL-PT-0001", "delivered");
  await admin("order", { id: "AL-PT-0001", admin_note: "re-saved" });
  assert.equal(rows("select * from points where order_id = 'AL-PT-0001'").length, 1);
  await status("AL-PT-0001", "preparing");
  assert.equal(balance(pn), 0);
  await status("AL-PT-0001", "delivered");
  await status("AL-PT-0001", "cancelled");
  assert.equal(balance(pn), 0);
});

test("a card order earns only once it is paid", async () => {
  const pn = "212611000002";
  await order("AL-PT-0002", "0611000002", 300, { pay: "card" });
  await status("AL-PT-0002", "delivered");
  assert.equal(balance(pn), 0);
  await ingest("paid", { id: "AL-PT-0002", amount: 300, stripe_session: "cs_test_x" });
  assert.equal(balance(pn), 30);
});

test("spending: needs the phone's own order number, 100 points, whole steps, at most 10% of the order", async () => {
  const pn = "212611000003", phone = "0611000003";
  await order("AL-PT-0003", phone, 990);
  await status("AL-PT-0003", "delivered"); // 99 points: one short of the minimum
  let r = await ingest("points-redeem", { id: "AL-PT-0004", phone, total: 500, points: 100, known: ["AL-PT-0003"] });
  assert.deepEqual([r.points, r.reason], [0, "balance"]);
  await admin("points", { phone_norm: pn, points: 251, note: "bought at the shop" });
  assert.equal(balance(pn), 350);
  r = await ingest("points-redeem", { id: "AL-PT-0004", phone, total: 500, points: 999, known: ["AL-NOPE-0001"] });
  assert.deepEqual([r.points, r.reason], [0, "proof"]); // the phone alone is not enough
  r = await ingest("points-redeem", { id: "AL-PT-0004", phone, total: 150, points: 300, known: ["AL-PT-0003"] });
  assert.deepEqual([r.points, r.discount], [100, 10]); // 10% of 150 MAD = 15 MAD: one step of 10
  r = await ingest("points-redeem", { id: "AL-PT-0004", phone, total: 150, points: 300, known: ["AL-PT-0003"] });
  assert.deepEqual([r.points, r.discount], [100, 10]); // a retry holds nothing more
  assert.equal(balance(pn), 250);
  r = await ingest("points-redeem", { id: "AL-PT-0005", phone, total: 90, points: 200, known: ["AL-PT-0003"] });
  assert.deepEqual([r.points, r.reason], [0, "basket"]); // 10% of 90 MAD is less than one step
  r = await ingest("points-redeem", { id: "AL-PT-0006", phone, total: 2000, points: 250, known: ["AL-PT-0003"] });
  assert.deepEqual([r.points, r.discount], [200, 20]);
  assert.equal(balance(pn), 50);
});

test("two orders at the same moment cannot spend the same points", async () => {
  const pn = "212611000007", phone = "0611000007";
  await order("AL-PT-0007", phone, 1500);
  await status("AL-PT-0007", "delivered"); // 150 points
  const res = await Promise.all(["AL-PT-0008", "AL-PT-0009", "AL-PT-0010"].map((id) =>
    ingest("points-redeem", { id, phone, total: 1000, points: 100, known: ["AL-PT-0007"] })));
  assert.equal(res.filter((x) => x.points === 100).length, 1);
  assert.equal(balance(pn), 50);
});

test("the discounted part earns nothing; cancelling gives the spent points back; a failed order releases them", async () => {
  const pn = "212611000011", phone = "0611000011";
  await order("AL-PT-0011", phone, 2000);
  await status("AL-PT-0011", "delivered"); // 200
  const r = await ingest("points-redeem", { id: "AL-PT-0012", phone, total: 500, points: 200, known: ["AL-PT-0011"] });
  assert.equal(r.points, 200);
  await order("AL-PT-0012", phone, 480); // 500 - 20 MAD paid with points
  await status("AL-PT-0012", "delivered");
  assert.equal(balance(pn), 48);
  await status("AL-PT-0012", "cancelled");
  assert.equal(balance(pn), 200);
  // release before the order exists (the shop could not be told): the hold goes; after it exists, nothing moves
  await ingest("points-redeem", { id: "AL-PT-0013", phone, total: 1000, points: 100, known: ["AL-PT-0011"] });
  assert.equal(balance(pn), 100);
  assert.equal((await ingest("points-release", { id: "AL-PT-0013" })).released, 1);
  assert.equal(balance(pn), 200);
  await ingest("points-redeem", { id: "AL-PT-0014", phone, total: 1000, points: 100, known: ["AL-PT-0011"] });
  await order("AL-PT-0014", phone, 990);
  assert.equal((await ingest("points-release", { id: "AL-PT-0014" })).released, 0);
  assert.equal(balance(pn), 100);
  await admin("order/delete", { id: "AL-PT-0014" }); // a deleted order gives its points back too
  assert.equal(balance(pn), 200);
});

test("points lapse 12 months after the last earning, and a new order does not bring old points back", async () => {
  const pn = "212611000015", phone = "0611000015";
  await order("AL-PT-0015", phone, 3000);
  await status("AL-PT-0015", "delivered");
  const old = new Date(Date.now() - 400 * 86400000).toISOString();
  env.DB.raw.prepare("update points set at = ? where order_id = 'AL-PT-0015'").run(old);
  const r = await ingest("points-redeem", { id: "AL-PT-0016", phone, total: 2000, points: 100, known: ["AL-PT-0015"] });
  assert.deepEqual([r.points, r.reason], [0, "balance"]);
  assert.equal(balance(pn), 0);
  assert.equal(rows("select * from points where phone_norm = ? and kind = 'expire'", pn).length, 1);
  await order("AL-PT-0017", phone, 500);
  await status("AL-PT-0017", "delivered");
  assert.equal(balance(pn), 50);
});

test("the public balance needs the phone and one of its order numbers", async () => {
  const phone = "0611000018";
  await order("AL-PT-0018", phone, 1234);
  await order("AL-PT-0019", phone, 456);
  await status("AL-PT-0018", "delivered");
  assert.equal((await publicPoints(phone, ["AL-PT-9999"])).status, 404);
  assert.equal((await publicPoints("0699999999", ["AL-PT-0018"])).status, 404);
  const r = await publicPoints("+212 611000018", ["AL-PT-0019"]);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("Access-Control-Allow-Origin"), SITE);
  const d = await r.json();
  assert.equal(d.balance, 123);
  assert.equal(d.mad, 10); // whole steps only: 100 of the 123 points
  assert.equal(d.pending, 45);
  assert.match(d.expires, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(d.history[0].kind, "earn");
  assert.equal(d.rules.step, 100);
});

test("the owner adjusts points with a note, never below zero, and sees them on the customer, the order and the overview", async () => {
  const pn = "212611000020";
  await order("AL-PT-0020", "0611000020", 700);
  await status("AL-PT-0020", "delivered");
  assert.equal((await admin("points", { phone_norm: pn, points: 10, note: "" })).ok, false);
  assert.equal((await admin("points", { phone_norm: pn, points: -71, note: "typo" })).ok, false);
  const a = await admin("points", { phone_norm: pn, points: -20, note: "returned a jar" });
  assert.equal(a.points.balance, 50);
  const c = await admin("customer?phone=" + pn);
  assert.equal(c.points.balance, 50);
  assert.equal(c.points.history.length, 2);
  const o = await admin("order?id=AL-PT-0020");
  assert.equal(o.points[0].kind, "earn");
  assert.equal(o.points[0].points, 70);
  const ov = await admin("overview");
  assert.ok(ov.points_out.points > 0);
});

test("a hold whose order never reached the back office goes back after a day", async () => {
  const pn = "212611000021", phone = "0611000021";
  await order("AL-PT-0021", phone, 1000);
  await status("AL-PT-0021", "delivered");
  await ingest("points-redeem", { id: "AL-PT-0022", phone, total: 1000, points: 100, known: ["AL-PT-0021"] });
  assert.equal(balance(pn), 0);
  env.DB.raw.prepare("update points set at = ? where order_id = 'AL-PT-0022'").run(new Date(Date.now() - 2 * 86400000).toISOString());
  const d = await (await publicPoints(phone, ["AL-PT-0021"], "10.4.4.4")).json();
  assert.equal(d.balance, 100);
});
