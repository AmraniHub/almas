// POST /api/assistant/: the shop's chat assistant ("the tagine"). Answers in the visitor's language from the shop's
// own facts and catalogue, and returns the ids of the products it suggests so the page can show them with an add
// button. Env: ANTHROPIC_API_KEY (absent = 503 "not configured", and the page answers with its own search).
import Anthropic from "@anthropic-ai/sdk";

const CATALOG = "https://aronium-shop.amrani4online.workers.dev/app/catalog.json";
const MODEL = "claude-opus-5-5";
const PER_IP = 20; // messages per visitor per window
const WINDOW_MS = 10 * 60 * 1000;
const hits = new Map(); // per warm instance: a soft limit, enough to stop one visitor running up the bill

let cached = null; // { at, system, ids }

async function systemPrompt() {
  if (cached && Date.now() - cached.at < 10 * 60 * 1000) return cached;
  const r = await fetch(CATALOG, { signal: AbortSignal.timeout(10000), headers: { "user-agent": "almas-site" } });
  if (!r.ok) throw new Error("catalogue " + r.status);
  const d = await r.json();
  const cats = Object.fromEntries((d.categories || []).map((c) => [c.id, c.fr]));
  // sorted by id so the text, and so the cached prefix, stays byte-identical between requests
  const products = (d.products || []).slice().sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }));
  const lines = products.map((p) => `${p.id} | ${p.ar} | ${p.fr} | ${p.en} | ${cats[p.cat] || p.cat} | ${p.price} MAD/${p.unit === "kg" ? "kg" : "pièce"}`);
  const system = `You are the shop assistant of Almas (معشبة ألماس, "Almas Épices & Herbes"), a spice and herb shop in Ksar Sghir near Tangier, Morocco. On the website you appear as a friendly little tagine. You help visitors find products, choose what to buy for a dish or an event, and order.

Facts you may state (nothing else about the shop):
- Products are sold by the kilo (in 250 g steps) or by the piece, at the prices in the catalogue below.
- Orders are placed on the website (cart, then "Confirm the order") or on WhatsApp +212 627 716 149. The shop confirms the price, the delivery and the time with the customer on WhatsApp.
- Payment: on delivery, at the shop, or by bank transfer. Card payment only if the checkout shows it.
- Restaurants, hotels, caterers and wedding organisers can ask for a price for large quantities on the "Professionnels" page or on WhatsApp.
- The shop is in Ksar Sghir; directions are on the website (Google Maps and Waze buttons).

Rules:
- Answer in the visitor's language: French, English, Spanish or Arabic. Arabic answers are always in Modern Standard Arabic (الفصحى), never in Darija, even when the visitor writes in Darija (in Arabic or Latin letters) - understand the Darija, answer in Fusha. Keep it short: at most 80 words, warm and practical.
- Only suggest products that are in the catalogue, by their id. Never invent a product, a price, a delivery fee, a delivery zone, opening hours, a stock level or a promotion. If you do not know, say so and suggest WhatsApp.
- Cooking advice is welcome (Moroccan dishes, quantities per guest, which spices go together). For herbs and beauty products, describe traditional uses only as tradition, never as medical treatment; for any health question, tell the visitor to ask a doctor or pharmacist.
- When the visitor wants something you cannot do (a custom quote, a delivery question, a complaint), set "whatsapp" to true.
- Put at most 4 product ids in "products", the most useful first, and only ids from the catalogue.

Catalogue (id | Arabic name | French | English | shelf | price):
${lines.join("\n")}`;
  cached = { at: Date.now(), system, ids: new Set(products.map((p) => p.id)) };
  return cached;
}

const SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string" },
    products: { type: "array", items: { type: "string" } },
    whatsapp: { type: "boolean" },
  },
  required: ["reply", "products", "whatsapp"],
  additionalProperties: false,
};

function limited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  list.push(now);
  hits.set(ip, list);
  return list.length > PER_IP;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "POST only" });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ ok: false, error: "not configured" });
  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "?";
  if (limited(ip)) return res.status(429).json({ ok: false, error: "slow down" });
  const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  // the last turns only, each cut short: a visitor cannot paste a book into the bill
  const turns = (Array.isArray(b.messages) ? b.messages : []).slice(-10)
    .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "").slice(0, 600) }))
    .filter((m) => m.content.trim());
  if (!turns.length || turns[turns.length - 1].role !== "user") return res.status(400).json({ ok: false, error: "message" });

  let ctx;
  try {
    ctx = await systemPrompt();
  } catch (e) {
    return res.status(503).json({ ok: false, error: "catalogue unavailable" });
  }
  const client = new Anthropic();
  try {
    const r = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 2000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default", // a declined request is re-run on Anthropic's recommended fallback model
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      system: [{ type: "text", text: ctx.system, cache_control: { type: "ephemeral" } }],
      messages: turns,
    });
    if (r.stop_reason === "refusal") return res.status(200).json({ ok: true, reply: "", products: [], whatsapp: true });
    const text = r.content.filter((c) => c.type === "text").map((c) => c.text).join("");
    let out;
    try {
      out = JSON.parse(text);
    } catch (e) {
      out = { reply: text.slice(0, 600), products: [], whatsapp: false };
    }
    const products = (Array.isArray(out.products) ? out.products : []).filter((id) => ctx.ids.has(id)).slice(0, 4);
    return res.status(200).json({ ok: true, reply: String(out.reply || "").slice(0, 1200), products, whatsapp: !!out.whatsapp });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return res.status(429).json({ ok: false, error: "busy" });
    if (e instanceof Anthropic.AuthenticationError) return res.status(503).json({ ok: false, error: "not configured" });
    if (e instanceof Anthropic.APIError) return res.status(502).json({ ok: false, error: "assistant " + e.status });
    return res.status(502).json({ ok: false, error: "assistant unreachable" });
  }
}
