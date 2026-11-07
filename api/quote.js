// POST /api/quote/: a price request from a restaurant, hotel, caterer or wedding organiser (the /pro/ page),
// sent to the shop owners through the Almas shop bot on Telegram.
import { telegram } from "./_lib.js";

const LANG = { ar: "العربية", fr: "الفرنسية", en: "الإنجليزية" };

function clean(v, max) {
  return String(v == null ? "" : v).replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, " ").trim().slice(0, max);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "POST only" });
  const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  if (b.website) return res.status(200).json({ ok: true }); // honeypot
  const f = {
    type: clean(b.type, 40), business: clean(b.business, 100), contact: clean(b.contact, 80), phone: clean(b.phone, 30),
    city: clean(b.city, 60), freq: clean(b.freq, 30), date: clean(b.date, 10), guests: clean(b.guests, 6), items: clean(b.items, 1500),
  };
  const lang = ["ar", "fr", "en"].includes(b.lang) ? b.lang : "ar";
  const digits = f.phone.replace(/\D/g, "");
  if (!f.business || !f.items || digits.length < 9 || digits.length > 15) {
    return res.status(400).json({ ok: false, error: "business, phone and products" });
  }
  let wa = digits.startsWith("00") ? digits.slice(2) : digits;
  if (wa.length === 10 && wa.startsWith("0")) wa = "212" + wa.slice(1);
  const text = [
    `📋 طلب ثمن من مؤسسة — ${f.type || "؟"}`,
    "",
    `🏢 ${f.business}${f.city ? ` — ${f.city}` : ""}`,
    f.contact ? `👤 ${f.contact}` : "",
    `📞 ${f.phone}  →  https://wa.me/${wa}`,
    f.freq ? `🔁 ${f.freq}` : "",
    f.date ? `📅 ${f.date}` : "",
    f.guests ? `👥 ${f.guests} ضيف` : "",
    "",
    "🛒 المنتجات والكميات:",
    f.items,
    "",
    `لغة الزبون: ${LANG[lang]}`,
  ].filter((x, i, a) => x !== "" || (i > 0 && a[i - 1] !== "")).join("\n");
  const sent = await telegram(text);
  if (!sent) return res.status(502).json({ ok: false, error: "telegram unreachable" });
  return res.status(200).json({ ok: true });
}
