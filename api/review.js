// POST /api/review/: a customer's review of a product, from the form under each product page. Stored in the shop's
// back office (cloud/) as "pending": nothing is shown on the site until the owner publishes it from the admin.
// "Verified purchase" is decided there, from the order number and phone the customer gives (both optional).
import { telegram, cloud, LANGS } from "./_lib.js";

const CTRL = new RegExp("[" + String.fromCharCode(0) + "-" + String.fromCharCode(31) + String.fromCharCode(127) + "]", "g");

function clean(v, max) {
  return String(v == null ? "" : v).replace(CTRL, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "POST only" });
  let b;
  try {
    b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  } catch (e) {
    return res.status(400).json({ ok: false, error: "json" });
  }
  if (b.website) return res.status(200).json({ ok: true }); // honeypot
  const product = clean(b.product, 12), rating = Number(b.rating);
  const text = clean(b.text, 600), name = clean(b.name, 80), order = clean(b.order, 24).toUpperCase(), phone = clean(b.phone, 20);
  const lang = Object.keys(LANGS).includes(b.lang) ? b.lang : "ar";
  if (!/^p\d{1,6}$/.test(product) || !Number.isInteger(rating) || rating < 1 || rating > 5 || text.length < 3 || !name) {
    return res.status(400).json({ ok: false, error: "rating, text and name" });
  }
  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const d = await cloud("/ingest/review", { product, rating, text, name, lang, order_id: order || undefined, phone: phone || undefined, ip });
  if (!d || !d.ok) return res.status(d && d.error === "rate" ? 429 : 502).json({ ok: false, error: (d && d.error) || "store unreachable" });
  const admin = String(process.env.ALMAS_CLOUD_URL || "").replace(/\/$/, "") + "/admin";
  await telegram([
    `⭐ رأي جديد في انتظار المراجعة — ${"★".repeat(rating)}${"☆".repeat(5 - rating)}`,
    `المنتج: ${product}${d.verified ? " · مشترٍ مؤكَّد" : ""}`,
    `${name}: ${text}`,
    `لغة الزبون: ${LANGS[lang]}`,
    `انشره أو أخفه من لوحة الإدارة: ${admin}`,
  ].join("\n"));
  return res.status(200).json({ ok: true, verified: !!d.verified });
}
