// Shared by the order and payment functions (Vercel does not expose files starting with "_" as routes).
// Env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_IDS (the Almas shop bot and its owners), STRIPE_SECRET_KEY (card payments;
// absent = no card option).

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
