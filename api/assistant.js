// POST /api/assistant/: the shop's chat assistant ("Tajine"). Answers in the visitor's language from the shop's own
// facts and catalogue, and returns the ids of the products it suggests so the page can show them with an add button.
//
// Free models only, tried in order until one answers:
//   1. Google Gemini Flash models on the free tier (env GEMINI_API_KEY; ASSISTANT_GEMINI_MODELS overrides the list)
//   2. Meta Llama 3.3 70B on Cloudflare Workers AI, free daily allowance (env CF_AI_TOKEN + CF_ACCOUNT_ID)
// None configured = 503 "not configured", and the page answers with its own search.
import names from "../site/names.json" with { type: "json" };

const CATALOG = "https://aronium-shop.amrani4online.workers.dev/app/catalog.json";
const GEMINI_MODELS = (process.env.ASSISTANT_GEMINI_MODELS || "gemini-3.5-flash,gemini-3-flash-preview,gemini-3.1-flash-lite")
  .split(",").map((s) => s.trim()).filter(Boolean);
const LLAMA = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const PER_IP = 20; // messages per visitor per window
const WINDOW_MS = 10 * 60 * 1000;
const hits = new Map(); // per warm instance: a soft limit, enough to stop one visitor eating the free quota
const BUDGET_MS = 24000; // the whole answer, all fallbacks included

let cached = null; // { at, system, ids }

async function systemPrompt() {
  if (cached && Date.now() - cached.at < 10 * 60 * 1000) return cached;
  const r = await fetch(CATALOG, { signal: AbortSignal.timeout(10000), headers: { "user-agent": "almas-site" } });
  if (!r.ok) throw new Error("catalogue " + r.status);
  const d = await r.json();
  const cats = Object.fromEntries((d.categories || []).map((c) => [c.id, c.fr]));
  const products = (d.products || []).slice().sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }));
  const lines = products.map((p) => {
    const n = names[p.id] || {};
    return `${p.id} | ${n.ar || p.ar} | ${n.fr || p.fr} | ${n.en || p.en} | ${n.es || p.fr} | ${cats[p.cat] || p.cat} | ${p.price} MAD/${p.unit === "kg" ? "kg" : "piece"}`;
  });
  const system = `You are Tajine, the shop assistant of Almas (معشبة ألماس, "Almas Épices & Herbes"), a spice and herb shop in Ksar Sghir near Tangier, Morocco. On the website you appear as a friendly little tagine. You help visitors find products, choose what to buy for a dish or an event, and order.

Facts you may state (nothing else about the shop):
- Products are sold by the kilo (in 250 g steps) or by the piece, at the prices in the catalogue below. 250 g costs a quarter of the kilo price.
- Orders are placed on the website (add to the cart, then confirm the order) or on WhatsApp +212 627 716 149. The shop confirms the price, the delivery and the time with the customer on WhatsApp.
- Payment: on delivery, at the shop, or by bank transfer. Card payment only if the checkout shows it.
- Restaurants, hotels, caterers and wedding organisers can ask for a price for large quantities on the "Professionals" page or on WhatsApp.
- The shop is in Ksar Sghir; directions are on the website (Google Maps and Waze buttons).

Rules:
- Answer in the language of the visitor's last message: French, English, Spanish or Arabic. Arabic answers are always in Modern Standard Arabic (الفصحى), never in Darija, even when the visitor writes in Darija (in Arabic or Latin letters): understand the Darija, answer in Fusha.
- Keep it short: at most 70 words, warm and practical. Plain text, no markdown, no lists with asterisks.
- Only suggest products that are in the catalogue, by their id. Never invent a product, a price, a delivery fee, a delivery zone, opening hours, a stock level or a promotion. If you do not know, say so and suggest WhatsApp.
- Never promise delivery to any place or by any date: say that the shop confirms delivery with the customer on WhatsApp.
- Cooking advice is welcome (Moroccan dishes, quantities per guest, which spices go together). For herbs and beauty products, describe traditional uses only as tradition, never as medical treatment; for any health question, tell the visitor to ask a doctor or pharmacist.
- When the visitor wants something you cannot do (a custom quote, a delivery question, a complaint), set "whatsapp" to true.
- Put at most 4 product ids in "products", the most useful first, and only ids from the catalogue. In "reply", name products by their name in the visitor's language, never by id (no "p14"): the page shows the products under your answer.
- Reply with one JSON object only: {"reply": string, "products": [ids], "whatsapp": boolean}.

Catalogue (id | Arabic | French | English | Spanish | shelf | price):
${lines.join("\n")}`;
  const label = Object.fromEntries(products.map((p) => {
    const n = names[p.id] || {};
    return [p.id, { ar: n.ar || p.ar, fr: n.fr || p.fr, en: n.en || p.en, es: n.es || p.fr }];
  }));
  cached = { at: Date.now(), system, ids: new Set(products.map((p) => p.id)), label };
  return cached;
}

function limited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  list.push(now);
  hits.set(ip, list);
  return list.length > PER_IP;
}

// The model's JSON, even when it wraps it in a code fence or adds a sentence around it
function parse(text) {
  const s = String(text || "");
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a >= 0 && b > a) {
    try {
      return JSON.parse(s.slice(a, b + 1));
    } catch (e) { /* fall through */ }
  }
  return s.trim() ? { reply: s.trim().slice(0, 600), products: [], whatsapp: false } : null;
}

const GEMINI_SCHEMA = {
  type: "OBJECT",
  properties: { reply: { type: "STRING" }, products: { type: "ARRAY", items: { type: "STRING" } }, whatsapp: { type: "BOOLEAN" } },
  required: ["reply", "products", "whatsapp"],
};

async function gemini(model, system, turns, ms) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: turns.map((t) => ({ role: t.role === "assistant" ? "model" : "user", parts: [{ text: t.content }] })),
      generationConfig: {
        responseMimeType: "application/json", responseSchema: GEMINI_SCHEMA, maxOutputTokens: 1200, temperature: 0.4,
        thinkingConfig: { thinkingLevel: "low" },
      },
      safetySettings: ["HARASSMENT", "HATE_SPEECH", "SEXUALLY_EXPLICIT", "DANGEROUS_CONTENT"]
        .map((c) => ({ category: "HARM_CATEGORY_" + c, threshold: "BLOCK_ONLY_HIGH" })),
    }),
    signal: AbortSignal.timeout(ms),
  });
  if (!r.ok) throw new Error(`gemini ${model} ${r.status}`);
  const d = await r.json();
  const text = (((d.candidates || [])[0] || {}).content || {}).parts;
  return parse((text || []).filter((p) => !p.thought).map((p) => p.text || "").join(""));
}

async function llama(system, turns, ms) {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/ai/run/${LLAMA}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.CF_AI_TOKEN}` },
    body: JSON.stringify({
      messages: [{ role: "system", content: system }, ...turns],
      max_tokens: 700, temperature: 0.4,
      response_format: {
        type: "json_schema",
        json_schema: {
          type: "object",
          properties: { reply: { type: "string" }, products: { type: "array", items: { type: "string" } }, whatsapp: { type: "boolean" } },
          required: ["reply", "products", "whatsapp"],
        },
      },
    }),
    signal: AbortSignal.timeout(ms),
  });
  if (!r.ok) throw new Error(`llama ${r.status}`);
  const d = await r.json();
  const out = d.result && d.result.response;
  return typeof out === "object" && out ? out : parse(out);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "POST only" });
  const providers = [];
  if (process.env.GEMINI_API_KEY) GEMINI_MODELS.forEach((m) => providers.push([m, (s, t, ms) => gemini(m, s, t, ms)]));
  if (process.env.CF_AI_TOKEN && process.env.CF_ACCOUNT_ID) providers.push(["llama", llama]);
  if (!providers.length) return res.status(503).json({ ok: false, error: "not configured" });
  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "?";
  if (limited(ip)) return res.status(429).json({ ok: false, error: "slow down" });
  let b;
  try {
    b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  } catch (e) {
    return res.status(400).json({ ok: false, error: "json" });
  }
  // the last turns only, each cut short: a visitor cannot paste a book into the quota
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
  const start = Date.now();
  const tried = [];
  for (const [name, ask] of providers) {
    const left = BUDGET_MS - (Date.now() - start);
    if (left < 3000) break;
    try {
      const out = await ask(ctx.system, turns, Math.min(left, name === "llama" ? left : 12000));
      if (!out || !String(out.reply || "").trim()) throw new Error(name + " empty");
      const products = (Array.isArray(out.products) ? out.products : []).map(String).filter((id) => ctx.ids.has(id)).slice(0, 4);
      // a model that still writes "p14" in its sentence: the product's name instead
      const lang = ["ar", "fr", "en", "es"].includes(b.lang) ? b.lang : "fr";
      const reply = String(out.reply).replace(/\(?\b(p\d{1,6})\b\)?/g, (m, id) => (ctx.label[id] ? ctx.label[id][lang] : m));
      return res.status(200).json({ ok: true, reply: reply.slice(0, 1200), products, whatsapp: !!out.whatsapp, by: name });
    } catch (e) {
      tried.push(String(e.message || e).slice(0, 60)); // busy, quota, timeout: the next model takes over
    }
  }
  return res.status(502).json({ ok: false, error: "assistant unavailable", tried });
}
