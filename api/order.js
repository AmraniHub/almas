// POST /api/order: a website order. Priced again here from the till's live catalogue (the browser's prices are
// never trusted), numbered, and sent to the shop owners through the Almas shop bot on Telegram.
// Env: TELEGRAM_BOT_TOKEN (the shop bot), TELEGRAM_CHAT_IDS (comma-separated owner chats).
import { telegram, stripe, money, cloud, LANGS as LANG } from "./_lib.js";

const CATALOG = "https://aronium-shop.amrani4online.workers.dev/app/catalog.json";
const PAY = { cod: "💵 عند الاستلام أو في المتجر", bank: "🏦 تحويل بنكي (CIH)", card: "💳 بطاقة بنكية (Stripe)" };

function clean(v, max) {
  return String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
}

function moroccanWa(phone) {
  // 06 12 34 56 78 -> 212612345678, +212 6... -> 2126..., anything else: digits as typed
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 10 && d.startsWith("0")) d = "212" + d.slice(1);
  return d;
}

function amount(unit, q) {
  if (unit !== "kg") return `${q} ×`;
  return q < 1 ? `${Math.round(q * 1000)} غ` : `${q} كلغ`;
}


let cached = null; // { at, byId }: a warm function reuses the till's prices for 5 minutes

async function catalogue() {
  if (cached && Date.now() - cached.at < 300000) return cached.byId;
  const r = await fetch(CATALOG, { signal: AbortSignal.timeout(10000), headers: { "user-agent": "almas-site" } });
  if (!r.ok) throw new Error("catalogue " + r.status);
  const d = await r.json();
  const byId = Object.fromEntries((d.products || []).map((p) => [p.id, p]));
  if (!Object.keys(byId).length) throw new Error("empty catalogue");
  cached = { at: Date.now(), byId };
  return byId;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "POST only" });
  const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  if (b.website) return res.status(200).json({ ok: true, number: "AL-0" }); // honeypot: a bot filled the hidden field

  const name = clean(b.name, 80), phone = clean(b.phone, 30), address = clean(b.address, 200), notes = clean(b.notes, 300);
  const pay = b.pay === "bank" ? "bank" : b.pay === "card" && process.env.STRIPE_SECRET_KEY ? "card" : "cod";
  const lang = Object.keys(LANG).includes(b.lang) ? b.lang : "ar";
  const digits = phone.replace(/\D/g, "");
  if (!name || digits.length < 9 || digits.length > 15) return res.status(400).json({ ok: false, error: "name and phone" });
  const items = Array.isArray(b.items) ? b.items.slice(0, 60) : [];
  if (!items.length) return res.status(400).json({ ok: false, error: "empty cart" });

  let cat;
  try {
    cat = await catalogue();
  } catch (e) {
    return res.status(503).json({ ok: false, error: "catalogue unavailable" });
  }
  const lines = [];
  let total = 0;
  for (const it of items) {
    const p = cat[String(it.id)];
    const q = Math.round(Number(it.q) * 100) / 100;
    const step = p && p.unit === "kg" ? 0.25 : 1;
    if (!p || !(q > 0) || q > 500 || Math.abs(q / step - Math.round(q / step)) > 1e-6) continue;
    const line = q * p.price;
    total += line;
    lines.push({ id: p.id, ar: p.ar, fr: p.fr, unit: p.unit, q, price: p.price, line });
  }
  if (!lines.length) return res.status(400).json({ ok: false, error: "no known product" });

  const now = new Date();
  const number = `AL-${now.toISOString().slice(2, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;
  const wa = moroccanWa(phone);
  const text = [
    `🛒 طلب جديد من الموقع — ${number}`,
    "",
    `👤 ${name}`,
    `📞 ${phone}${wa ? `  →  https://wa.me/${wa}` : ""}`,
    address ? `📍 ${address}` : "",
    `💳 ${PAY[pay]}`,
    notes ? `📝 ${notes}` : "",
    "",
    ...lines.map((l) => `• ${amount(l.unit, l.q)} ${l.ar} (${l.fr}) — ${money(l.line)}`),
    "",
    `المجموع: ${money(total)}`,
    `لغة الزبون: ${LANG[lang]}`,
  ].filter((x, i, a) => x !== "" || (a[i - 1] !== "" && i > 0)).join("\n");

  // card: the Stripe page is opened before the shop is told, so a refused card setup never announces an order
  let url = "";
  if (pay === "card") {
    const origin = `https://${req.headers["x-forwarded-host"] || req.headers.host}`;
    const base = origin + (lang === "ar" ? "" : `/${lang}`);
    try {
      const s = await stripe("POST", "checkout/sessions", {
        mode: "payment",
        locale: lang === "ar" ? "fr" : lang, // Stripe Checkout has no Arabic
        success_url: `${base}/merci/?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${base}/?cancel=${number}`,
        client_reference_id: number,
        metadata: { order: number, phone },
        payment_intent_data: { metadata: { order: number }, statement_descriptor_suffix: "ALMAS", description: `Almas ${number}` },
        line_items: lines.map((l) => ({
          quantity: 1,
          price_data: {
            currency: "mad",
            unit_amount: Math.round(l.line * 100),
            product_data: { name: `${l.fr} — ${amountFr(l.unit, l.q)}`, description: l.ar },
          },
        })),
      });
      url = s.url;
    } catch (e) {
      return res.status(502).json({ ok: false, error: "card", detail: String(e.message || e).slice(0, 200) });
    }
  }

  const sent = await telegram(text + (pay === "card" ? "\n⏳ في انتظار الأداء بالبطاقة" : ""));
  if (!sent) return res.status(502).json({ ok: false, error: "telegram unreachable" });
  await cloud("/ingest/order", {
    id: number, at: now.toISOString(), lang, name, phone, address, notes, pay, source: "web",
    total: Math.round(total * 100) / 100,
    items: lines.map((l) => ({ product: l.id, name_till: l.ar, name: l.fr, qty: l.q, unit: l.unit, unit_price: l.price,
                               line: Math.round(l.line * 100) / 100 })),
  });
  return res.status(200).json({
    ok: true, number, total: Math.round(total * 100) / 100, url,
    lines: lines.map((l) => ({ id: l.id, q: l.q, line: Math.round(l.line * 100) / 100 })),
  });
}

function amountFr(unit, q) {
  if (unit !== "kg") return `${q} ×`;
  return q < 1 ? `${Math.round(q * 1000)} g` : `${q} kg`;
}
