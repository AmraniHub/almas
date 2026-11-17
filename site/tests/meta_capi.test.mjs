// Meta Conversions API from the order / quote / payment functions. No network: fetch is replaced, so nothing reaches
// Meta, Telegram, Stripe or the back office. Run: node --test site/tests/meta_capi.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const calls = [];
const CATALOG = { products: [{ id: "p13", ar: "فلفل", fr: "Paprika", unit: "kg", price: 80 }] };
globalThis.fetch = async (url, opts = {}) => {
  calls.push({ url: String(url), opts });
  const json = (o) => ({ ok: true, status: 200, json: async () => o });
  if (String(url).includes("catalog.json")) return json(CATALOG);
  if (String(url).includes("graph.facebook.com")) return json({ events_received: 1 });
  return json({ ok: true });
};
process.env.TELEGRAM_BOT_TOKEN = "t";
process.env.TELEGRAM_CHAT_IDS = "1";
process.env.ALMAS_CLOUD_URL = "https://cloud.example";
process.env.ALMAS_CLOUD_SECRET = "s";

const lib = await import("../../api/_lib.js");
const order = (await import("../../api/order.js")).default;
const quote = (await import("../../api/quote.js")).default;

const req = (body) => ({
  method: "POST", body,
  headers: { "x-forwarded-for": "41.250.1.2, 10.0.0.1", "user-agent": "UA-test", referer: "https://almas5.com/fr/",
             cookie: "a=1; _fbp=fb.1.123.456; _fbc=fb.1.123.abc", host: "almas5.com" },
});
const res = () => { const r = { code: 0, body: null }; r.status = (c) => { r.code = c; return r; }; r.json = (b) => { r.body = b; return r; }; return r; };
const graph = () => calls.filter((c) => c.url.includes("graph.facebook.com"));
const sha = (s) => createHash("sha256").update(s).digest("hex");

test("phone normalised the Moroccan way before hashing", () => {
  assert.equal(lib.phoneE164("06 12 34 56 78"), "212612345678");
  assert.equal(lib.phoneE164("+212 7 54 41 64 77"), "212754416477");
  assert.equal(lib.phoneE164("0033 6 11 22 33 44"), "33611223344");
});

test("event body: hashed phone only, IP from the first forwarded hop, pixel cookies, MAD value", () => {
  const b = lib.metaBody(req({}), { name: "Lead", id: "lead-AL-1", value: 160.004, phone: "0612345678",
                                     contents: [{ id: "p13", quantity: 2 }], now: 1_700_000_000_000 });
  const e = b.data[0];
  assert.equal(e.event_name, "Lead");
  assert.equal(e.event_id, "lead-AL-1");
  assert.equal(e.event_time, 1_700_000_000);
  assert.equal(e.action_source, "website");
  assert.equal(e.event_source_url, "https://almas5.com/fr/");
  assert.deepEqual(e.user_data.ph, [sha("212612345678")]);
  assert.ok(!JSON.stringify(b).includes("0612345678") && !JSON.stringify(b).includes("212612345678"), "raw phone never sent");
  assert.equal(e.user_data.client_ip_address, "41.250.1.2");
  assert.equal(e.user_data.fbp, "fb.1.123.456");
  assert.equal(e.user_data.fbc, "fb.1.123.abc");
  assert.deepEqual(e.custom_data, { currency: "MAD", value: 160, contents: [{ id: "p13", quantity: 2 }], content_ids: ["p13"], content_type: "product" });
  assert.equal(b.test_event_code, undefined);
});

test("no token: nothing is sent and the order still goes through", async () => {
  delete process.env.META_CAPI_TOKEN;
  calls.length = 0;
  const r = res();
  await order(req({ name: "Sara", phone: "0612345678", items: [{ id: "p13", q: 2 }], pay: "cod", lang: "fr" }), r);
  assert.equal(r.code, 200);
  assert.equal(graph().length, 0);
});

test("cash order: one Lead with the order number as id, token in the header not the URL", async () => {
  process.env.META_CAPI_TOKEN = "TOKEN123";
  calls.length = 0;
  const r = res();
  await order(req({ name: "Sara", phone: "0612345678", items: [{ id: "p13", q: 2 }], pay: "cod", lang: "fr" }), r);
  assert.equal(r.code, 200);
  const g = graph();
  assert.equal(g.length, 1);
  assert.match(g[0].url, /graph\.facebook\.com\/v24\.0\/4765542090366259\/events$/);
  assert.ok(!g[0].url.includes("TOKEN123"));
  assert.equal(g[0].opts.headers.authorization, "Bearer TOKEN123");
  const e = JSON.parse(g[0].opts.body).data[0];
  assert.equal(e.event_name, "Lead");
  assert.equal(e.event_id, "lead-" + r.body.number);
  assert.equal(e.custom_data.value, 160);
});

test("a Meta outage never fails the order", async () => {
  process.env.META_CAPI_TOKEN = "TOKEN123";
  const real = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    if (String(url).includes("graph.facebook.com")) throw new Error("down");
    return real(url, opts);
  };
  const r = res();
  await order(req({ name: "Sara", phone: "0612345678", items: [{ id: "p13", q: 1 }], pay: "bank", lang: "ar" }), r);
  globalThis.fetch = real;
  assert.equal(r.code, 200);
  assert.ok(r.body.ok);
});

test("honeypot (a bot) sends nothing to Meta", async () => {
  process.env.META_CAPI_TOKEN = "TOKEN123";
  calls.length = 0;
  await order(req({ website: "spam", name: "x", phone: "0612345678", items: [{ id: "p13", q: 1 }] }), res());
  assert.equal(graph().length, 0);
});

test("pro quote: Lead with the quote number, returned to the page for the pixel's eventID", async () => {
  process.env.META_CAPI_TOKEN = "TOKEN123";
  calls.length = 0;
  const r = res();
  await quote(req({ business: "Hotel X", phone: "0612345678", items: "10 kg cumin", lang: "fr" }), r);
  assert.equal(r.code, 200);
  assert.match(r.body.id, /^Q-\d{6}-\d{4}$/);
  const e = JSON.parse(graph()[0].opts.body).data[0];
  assert.equal(e.event_id, "quote-" + r.body.id);
  assert.equal(e.event_name, "Lead");
});

test("test event code is added only when set", () => {
  process.env.META_TEST_EVENT_CODE = "TEST123";
  assert.equal(lib.metaBody(req({}), { name: "Lead", id: "x" }).test_event_code, "TEST123");
  delete process.env.META_TEST_EVENT_CODE;
});
