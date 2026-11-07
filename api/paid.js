// GET /api/paid/?session_id=cs_...: the thank-you page asks whether a card payment went through. Asks Stripe itself
// (the browser's word is never trusted) and tells the shop on Telegram once per payment: the PaymentIntent is
// marked notified=1 so a reload or a second tab does not announce it again. A webhook can replace this when Almas
// gets its own Stripe account.
import { telegram, stripe, money, cloud } from "./_lib.js";

export default async function handler(req, res) {
  const id = String((req.query && req.query.session_id) || "");
  if (!/^cs_(live|test)_[A-Za-z0-9]+$/.test(id) || !process.env.STRIPE_SECRET_KEY) {
    return res.status(400).json({ ok: false });
  }
  let s;
  try {
    s = await stripe("GET", `checkout/sessions/${id}?expand[]=payment_intent`);
  } catch (e) {
    return res.status(502).json({ ok: false });
  }
  const number = (s.metadata && s.metadata.order) || s.client_reference_id || "";
  const total = (s.amount_total || 0) / 100;
  const paid = s.payment_status === "paid";
  const pi = s.payment_intent && typeof s.payment_intent === "object" ? s.payment_intent : null;
  if (paid && pi && !(pi.metadata && pi.metadata.notified)) {
    const sent = await telegram(`✅ تم الأداء بالبطاقة — ${number}\nالمبلغ: ${money(total)}${s.livemode ? "" : "\n(وضع التجربة)"}`);
    await cloud("/ingest/paid", { id: number, stripe_session: id, amount: total });
    if (sent) {
      try {
        await stripe("POST", `payment_intents/${pi.id}`, { metadata: { notified: "1" } });
      } catch (e) {
        /* the shop was told; at worst a reload tells it again */
      }
    }
  }
  return res.status(200).json({ ok: true, paid, number, total });
}
