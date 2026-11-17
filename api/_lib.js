// Shared by the order and payment functions (Vercel does not expose files starting with "_" as routes).
// Env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_IDS (the Almas shop bot and its owners), STRIPE_SECRET_KEY (card payments;
// absent = no card option).
import { createHash } from "node:crypto";

export const SITE_TZ = "Africa/Casablanca";

export async function telegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chats = String(process.env.TELEGRAM_CHAT_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);
  let sent = 0;
  for (const chat of chats) {
    try {
      const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
        signal: AbortSignal.timeout(8000),
      });
      if (r.ok) sent++;
    } catch (e) {
      /* one chat down must not lose the order for the other */
    }
  }
  return sent;
}

// Stripe's API takes form encoding with bracketed keys: {a: {b: 1}, l: [{x: 2}]} -> a[b]=1&l[0][x]=2
function form(obj, prefix = "", out = []) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object") form(v, key, out);
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
  }
  return out;
}

export async function stripe(method, path, params) {
  const r = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: params ? form(params).join("&") : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error ? d.error.message : `stripe ${r.status}`);
  return d;
}

export function money(n) {
  const r = Math.round(n * 100) / 100;
  return `${Number.isInteger(r) ? r : r.toFixed(2)} درهم`;
}

// The shop's back office (Cloudflare Worker "almas-shop", cloud/): every order, quote, payment and review is copied
// there for the admin dashboard. Best effort: Telegram stays the alert, so a cloud outage never loses an order.
// Env: ALMAS_CLOUD_URL, ALMAS_CLOUD_SECRET.
export async function cloud(path, body) {
  const base = process.env.ALMAS_CLOUD_URL, secret = process.env.ALMAS_CLOUD_SECRET;
  if (!base || !secret) return null;
  try {
    const r = await fetch(base.replace(/\/$/, "") + path, {
      method: "POST",
      headers: { "content-type": "application/json", "x-almas-secret": secret },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(6000),
    });
    return await r.json().catch(() => null);
  } catch (e) {
    return null;
  }
}

export const LANGS = { ar: "العربية", fr: "الفرنسية", en: "الإنجليزية", es: "الإسبانية" };

// Meta Conversions API: the same Lead / Purchase the page's pixel sends, sent again from the server so an ad blocker
// or a closed tab does not lose it. Meta keeps one of the two because both carry the same event_id.
// Env: META_CAPI_TOKEN (absent = nothing is sent), META_PIXEL_ID, META_GRAPH_VERSION, META_TEST_EVENT_CODE (only
// while testing in Events Manager). Best effort: never delays an order by more than 4 s, never fails it.

const sha = (s) => createHash("sha256").update(s).digest("hex");

export function phoneE164(phone) {
  // Moroccan habits: 06..., 07..., +212..., 00212...; anything else keeps its digits
  let d = String(phone || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 10 && d.startsWith("0")) d = "212" + d.slice(1);
  return d;
}

function cookie(req, name) {
  const m = String((req.headers && req.headers.cookie) || "").match(new RegExp("(?:^|;\\s*)" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[1]) : "";
}

export function metaBody(req, { name, id, value, phone, contents, sourceUrl, now = Date.now() }) {
  const h = req.headers || {};
  const ip = String(h["x-forwarded-for"] || "").split(",")[0].trim() || String(h["x-real-ip"] || "");
  const user = { client_ip_address: ip || undefined, client_user_agent: h["user-agent"] || undefined,
                 fbp: cookie(req, "_fbp") || undefined, fbc: cookie(req, "_fbc") || undefined };
  const ph = phoneE164(phone);
  if (ph.length >= 9) user.ph = [sha(ph)];
  const custom = { currency: "MAD" };
  if (value != null) custom.value = Math.round(Number(value) * 100) / 100;
  if (contents && contents.length) {
    custom.contents = contents.map((c) => ({ id: String(c.id), quantity: c.quantity }));
    custom.content_ids = contents.map((c) => String(c.id));
    custom.content_type = "product";
  }
  const ev = { event_name: name, event_time: Math.floor(now / 1000), event_id: id, action_source: "website",
               event_source_url: sourceUrl || h.referer || undefined, user_data: user, custom_data: custom };
  const body = { data: [JSON.parse(JSON.stringify(ev))] };
  if (process.env.META_TEST_EVENT_CODE) body.test_event_code = process.env.META_TEST_EVENT_CODE;
  return body;
}

export async function metaEvent(req, event) {
  const token = process.env.META_CAPI_TOKEN;
  if (!token) return null;
  const pixel = process.env.META_PIXEL_ID || "4765542090366259";
  const ver = process.env.META_GRAPH_VERSION || "v24.0";
  try {
    const r = await fetch(`https://graph.facebook.com/${ver}/${pixel}/events`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(metaBody(req, event)),
      signal: AbortSignal.timeout(4000),
    });
    return await r.json().catch(() => null);
  } catch (e) {
    return null;
  }
}
