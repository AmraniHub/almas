// POST /api/assistant/: the shop's chat assistant ("العشّاب" / Achab, drawn as a little tagine). Answers in the visitor's language from the shop's own
// facts and catalogue, and returns the ids of the products it suggests so the page can show them with an add button.
//
// Free models only, tried in order until one answers:
//   1. Google Gemini Flash models on the free tier (env GEMINI_API_KEY; ASSISTANT_GEMINI_MODELS overrides the list)
//   2. Meta Llama 3.3 70B on Cloudflare Workers AI, free daily allowance (env CF_AI_TOKEN + CF_ACCOUNT_ID)
// None configured = 503 "not configured", and the page answers with its own search.
import names from "../site/names.json" with { type: "json" };
import packs from "../site/packs.json" with { type: "json" };

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
  const price = Object.fromEntries(products.map((p) => [p.id, p]));
  const boxes = packs.packs.map((k) => {
    const total = k.items.reduce((t, [id, q]) => t + (price[id] ? price[id].price * (price[id].unit === "kg" ? q : Math.max(1, Math.round(q))) : 0), 0);
    return `box:${k.id} | ${k.ar} | ${k.fr} | ${k.items.map(([id, q]) => `${id} x${q}`).join(", ")} | total ${Math.round(total * 100) / 100} MAD`;
  });
  const system = `You are Achab (in Arabic العشّاب, "the herbalist"), the salesperson of Almas (معشبة ألماس, "Almas Épices & Herbes"), a spice and herb shop in Ksar Sghir near Tangier, Morocco. On the website you appear as a friendly little tagine on a wood fire. If asked your name: العشّاب in Arabic, Achab in other languages.

YOUR JOB IS TO SELL, the way the best shopkeeper in a Moroccan souk sells: warmly, with real knowledge, and always towards a purchase.
1. Understand the need in one look: the dish, the number of guests, the occasion, home or business. Ask at most one short question, only when you cannot recommend without it.
2. Recommend specific products with quantities (weighed products in 250 g steps, the rest by the piece). When one of the ready-made boxes fits, recommend the box: it is the easiest buy.
3. Add one natural complement (what goes with it: the spice that finishes the dish, the herb for the tea after it). One, not a list.
4. Make it concrete with a price, but only a price written in the lists below: a box's total, or a product's price per kg or per piece. Never add up a sum yourself (the page shows the exact total under your answer).
5. Close: invite the visitor to add it to the cart and confirm the order, and reassure that payment can be on delivery and the shop confirms everything on WhatsApp. End every answer with one clear next step.
Persuade honestly: never invent a discount, a promotion, a stock shortage, a delivery time or a health benefit. Confidence and knowledge sell; pressure does not.

Facts you may state (nothing else about the shop):
- Products are sold by the kilo (in 250 g steps) or by the piece, at the prices in the catalogue below. 250 g costs a quarter of the kilo price.
- Orders are placed on the website (add to the cart, then confirm the order) or on WhatsApp +212 627 716 149. The shop confirms the price, the delivery and the time with the customer on WhatsApp.
- Payment: on delivery, at the shop, or by bank transfer. Card payment only if the checkout shows it.
- A customer can ask, in the cart, for the same order to repeat every week, 2 weeks or month.
- Restaurants, hotels, caterers and wedding organisers: the "Professionals" page for a price on large quantities and for standing orders.
- The shop is in Ksar Sghir near Tangier; Google Maps and Waze take the visitor to the door.

Rules:
- Answer in the language of the visitor's last message: French, English, Spanish or Arabic. Arabic answers are always in Modern Standard Arabic (الفصحى), never in Darija, even when the visitor writes in Darija (in Arabic or Latin letters): understand the Darija, answer in Fusha.
- Keep it short: at most 70 words, warm and confident. Plain text, no markdown, no lists with asterisks.
- Only recommend products and boxes from the lists below, by their id. Never invent a product, a price, a delivery fee, a delivery zone, opening hours, a stock level or a promotion. If you do not know, say so and offer WhatsApp.
- Never promise delivery to any place or by any date: the shop confirms delivery with the customer on WhatsApp.
- Cooking advice is welcome (Moroccan dishes, quantities per guest, which spices go together). Talk about taste, aroma, warmth and tradition; never say a product heals, treats, prevents, boosts immunity, slims, or is good for any organ or condition, in any language. For any health question, tell the visitor to ask a doctor or pharmacist.
- "items": at most 4, the most useful first: {"id": a product id or "box:<id>", "qty": kilos for weighed products (0.25, 0.5, 1...) or pieces; 1 for a box}.
- In "reply", name products by their name in the visitor's language, never by id (no "p14", no "box:"): the page shows them under your answer with an add button.
- "action": "cart" when you recommend products (the page shows "Add all to cart"); "checkout" when the visitor is ready or asks how to order; "directions" when they want to come to the shop or ask where it is; "pro" for a restaurant, hotel, caterer or event; "none" otherwise.
- "whatsapp": true when the visitor wants something you cannot do (a custom quote, a delivery question, a complaint).
- Reply with one JSON object only: {"reply": string, "items": [{"id": string, "qty": number}], "action": string, "whatsapp": boolean}.

Ready-made boxes (box id | Arabic | French | contents | total at today's prices):
${boxes.join("\n")}

Catalogue (id | Arabic | French | English | Spanish | shelf | price):
${lines.join("\n")}`;
  const label = Object.fromEntries(products.map((p) => {
    const n = names[p.id] || {};
    return [p.id, { ar: n.ar || p.ar, fr: n.fr || p.fr, en: n.en || p.en, es: n.es || p.fr }];
  }));
  for (const k of packs.packs) label["box:" + k.id] = { ar: k.ar, fr: k.fr, en: k.en, es: k.es };
  cached = { at: Date.now(), system, ids: new Set(products.map((p) => p.id).concat(packs.packs.map((k) => "box:" + k.id))), label,
             units: Object.fromEntries(products.map((p) => [p.id, p.unit])) };
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
  properties: {
    reply: { type: "STRING" },
    items: { type: "ARRAY", items: { type: "OBJECT", properties: { id: { type: "STRING" }, qty: { type: "NUMBER" } }, required: ["id", "qty"] } },
    action: { type: "STRING", enum: ["cart", "checkout", "directions", "pro", "none"] },
    whatsapp: { type: "BOOLEAN" },
  },
  required: ["reply", "items", "action", "whatsapp"],
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
          properties: {
            reply: { type: "string" },
            items: { type: "array", items: { type: "object", properties: { id: { type: "string" }, qty: { type: "number" } }, required: ["id", "qty"] } },
            action: { type: "string", enum: ["cart", "checkout", "directions", "pro", "none"] },
            whatsapp: { type: "boolean" },
          },
          required: ["reply", "items", "action", "whatsapp"],
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
      const raw = Array.isArray(out.items) ? out.items : (Array.isArray(out.products) ? out.products.map((id) => ({ id, qty: 0 })) : []);
      const items = raw.map((x) => (typeof x === "string" ? { id: x, qty: 0 } : x || {}))
        .map((x) => ({ id: String(x.id || ""), qty: Number(x.qty) || 0 }))
        .filter((x) => ctx.ids.has(x.id)).slice(0, 4)
        .map((x) => {
          if (x.id.startsWith("box:")) return { id: x.id, qty: 1 };
          if (ctx.units[x.id] === "kg") return { id: x.id, qty: Math.min(50, Math.max(0.25, Math.round((x.qty || 0.25) * 4) / 4)) };
          return { id: x.id, qty: Math.min(200, Math.max(1, Math.round(x.qty || 1))) };
        });
      const products = items.map((x) => x.id).filter((id) => !id.startsWith("box:"));
      const action = ["cart", "checkout", "directions", "pro"].includes(out.action) ? out.action : (items.length ? "cart" : "none");
      // a model that still writes "p14" in its sentence: the product's name instead
      const lang = ["ar", "fr", "en", "es"].includes(b.lang) ? b.lang : "fr";
      const reply = String(out.reply).replace(/\(?\b((?:box:[a-z-]+)|(?:p\d{1,6}))\b\)?/g, (m, id) => (ctx.label[id] ? ctx.label[id][lang] : m));
      return res.status(200).json({ ok: true, reply: reply.slice(0, 1200), items, products, action, whatsapp: !!out.whatsapp, by: name });
    } catch (e) {
      tried.push(String(e.message || e).slice(0, 60)); // busy, quota, timeout: the next model takes over
    }
  }
  return res.status(502).json({ ok: false, error: "assistant unavailable", tried });
}
