// Almas back office (vanilla JS, no build step). Every value is rendered with textContent through h(),
// never as HTML, because names, addresses and reviews come from the public.
"use strict";

const ORDER_STATUS = ["new", "confirmed", "preparing", "delivered", "cancelled"];
const QUOTE_STATUS = ["new", "contacted", "won", "lost"];
const PAY = { cod: "Cash on delivery", bank: "Bank transfer", card: "Card (Stripe)" };
const SHOP_AR = "معشبة ألماس";

const $ = (id) => document.getElementById(id);
const view = () => $("view");

function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") e.className = v;
    else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
    else if (k === "value") e.value = v;
    else e.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of kids.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    e.append(c instanceof Node ? c : String(c));
  }
  return e;
}
function clear(el, ...kids) {
  el.replaceChildren(...kids.flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false));
}

let toastTimer = 0;
function toast(msg, bad) {
  const t = $("toast");
  t.textContent = msg;
  t.className = "toast" + (bad ? " bad" : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add("hide"), bad ? 5000 : 2200);
}

async function api(path, data) {
  const opt = { credentials: "same-origin", headers: {} };
  if (data !== undefined) {
    opt.method = "POST";
    opt.headers["Content-Type"] = "application/json";
    opt.headers["X-Almas-Csrf"] = "1";
    opt.body = JSON.stringify(data);
  }
  const r = await fetch("/admin/api/" + path, opt);
  let j = {};
  try {
    j = await r.json();
  } catch (e) {
    /* not JSON: handled below */
  }
  if (r.status === 401 && path !== "login") {
    showLogin();
    throw new Error("Please sign in again.");
  }
  if (!r.ok || j.ok === false) throw new Error(j.error || "Error " + r.status);
  return j;
}

// ---------- formatting ----------

function money(n) {
  const v = Math.round(Number(n || 0) * 100) / 100;
  return v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + " MAD";
}
// Morocco is on UTC+0; browsers still carry the old +01:00 rule for Africa/Casablanca, so show UTC
function when(at, withTime = true) {
  if (!at) return "";
  const d = new Date(at);
  if (isNaN(d)) return at;
  const o = { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" };
  if (withTime) Object.assign(o, { hour: "2-digit", minute: "2-digit", hour12: false });
  return d.toLocaleString("en-GB", o);
}
function qty(q, unit) {
  q = Number(q || 0);
  if (unit !== "kg") return "× " + q;
  return q < 1 ? Math.round(q * 1000) + " g" : Math.round(q * 1000) / 1000 + " kg";
}
function stars(n) {
  n = Math.max(0, Math.min(5, Math.round(Number(n || 0))));
  return "★".repeat(n) + "☆".repeat(5 - n);
}
const chip = (cls, label) => h("span", { class: "chip " + cls }, label || cls);
const ar = (s) => h("span", { class: "ar", dir: "auto" }, s || "");
function waLink(phone, msg) {
  return "https://wa.me/" + encodeURIComponent(String(phone || "").replace(/\D/g, "")) + (msg ? "?text=" + encodeURIComponent(msg) : "");
}
function waButton(phone, msg, label) {
  if (!phone) return null;
  return h("a", { class: "btn wa", href: waLink(phone, msg), target: "_blank", rel: "noopener noreferrer" }, label || "WhatsApp");
}
function orderMessage(o) {
  const total = Math.round(Number(o.total || 0) * 100) / 100;
  return `السلام عليكم ${o.name || ""}، شكرا لطلبكم من ${SHOP_AR}. نؤكد استلام طلبكم رقم ${o.id} بمبلغ إجمالي قدره ${total} درهم. ` +
    "نرجو تأكيد العنوان والوقت المناسب للتوصيل. مع خالص التحية.";
}
function reorderMessage(r) {
  const list = r.items.slice(0, 6).map((x) => qty(x.qty, x.unit) + " " + x.name).join("، ");
  return `السلام عليكم ${r.business || r.name || ""}، نرجو أن تكونوا بخير. مضى ${r.days} يومًا على طلبكم الأخير من ${SHOP_AR}` +
    (list ? ` (${list})` : "") + ". هل تودّون أن نجهّز لكم الطلب نفسه؟ يكفي أن تردّوا بـ«نعم» أو ترسلوا التعديلات.";
}
// one basket line per product, each in its own direction: Arabic names and Latin quantities do not scramble
function itemsLine(items) {
  return h("span", { class: "items-line" }, items.map((x) => h("span", { class: "it", dir: "auto" }, qty(x.qty, x.unit) + " " + (x.name_till || x.name || x.product))));
}
const EVERY_LABEL = { 7: "every week", 14: "every 2 weeks", 30: "every month" };
const EVERY_AR = { 7: "كل أسبوع", 14: "كل أسبوعين", 30: "كل شهر" };
function standingMessage(s) {
  const list = s.items.slice(0, 8).map((x) => qty(x.qty, x.unit) + " " + (x.name_till || x.name || x.product)).join("، ");
  return `السلام عليكم ${s.business || s.name || ""}، حان موعد طلبكم الدوري (${EVERY_AR[s.every_days] || ""}) من ${SHOP_AR}` +
    (list ? `: ${list}` : "") + ". هل نجهّزه لكم كالمعتاد؟ يمكنكم الرد بـ«نعم» أو إرسال أي تعديل.";
}
function standingWelcome(s) {
  return `السلام عليكم ${s.business || s.name || ""}، شكرًا لثقتكم في ${SHOP_AR}. فعّلنا طلبكم الدوري (${EVERY_AR[s.every_days] || ""})، ` +
    `وسنراسلكم قبل كل موعد لتأكيده. الموعد القادم: ${s.next_date}.`;
}
function standingRowView(s) {
  return h("div", { class: "row" },
    h("div", { class: "main" },
      h("div", {}, h("b", { dir: "auto" }, s.business || s.name), " ", chip(s.status), " ", h("span", { class: "small muted" }, EVERY_LABEL[s.every_days] || s.every_days + " days")),
      h("div", { class: "small muted" }, s.status === "active" ? "next: " + s.next_date : "requested " + when(s.created_at, false), s.last_order ? " · last order " + s.last_order : ""),
      h("div", { class: "small" }, itemsLine(s.items))),
    h("div", { class: "side" }, h("a", { class: "btn ghost small", href: "#standing" }, "Open")));
}
function standingCard(s) {
  const every = selectOf(["7", "14", "30"], String(s.every_days), { 7: "Every week", 14: "Every 2 weeks", 30: "Every month" });
  const next = h("input", { type: "date", value: s.next_date });
  const note = h("textarea", { placeholder: "Internal note" }, s.admin_note || "");
  const save = async (extra, msg) => {
    try {
      await api("standing", { id: s.id, every_days: Number(every.value), next_date: next.value, admin_note: note.value, ...extra });
      toast(msg || "Saved");
      render();
    } catch (e) {
      toast(e.message, true);
    }
  };
  return h("div", { class: "card" + (s.due ? " due" : "") },
    h("div", { class: "actions" }, h("b", { dir: "auto" }, s.business || s.name), chip(s.status), s.due ? chip("due", "due") : null,
      h("span", { class: "id" }, "#" + s.id)),
    h("div", { class: "small muted" }, s.name, " · ", s.phone, " · ", h("a", { href: "#customer/" + encodeURIComponent(s.phone_norm) }, "customer file"),
      " · first order ", h("a", { href: "#order/" + encodeURIComponent(s.from_order) }, s.from_order)),
    h("dl", { class: "kv" },
      h("dt", {}, "Basket"), h("dd", {}, itemsLine(s.items)),
      h("dt", {}, "Payment"), h("dd", {}, s.pay === "bank" ? "bank transfer" : "on delivery"),
      s.address ? [h("dt", {}, "Address"), h("dd", { dir: "auto" }, s.address)] : null,
      s.notes ? [h("dt", {}, "Customer note"), h("dd", { dir: "auto" }, s.notes)] : null,
      s.last_order ? [h("dt", {}, "Last order"), h("dd", {}, h("a", { href: "#order/" + encodeURIComponent(s.last_order) }, s.last_order), s.last_done ? " (" + s.last_done + ")" : "")] : null),
    h("div", { class: "actions" }, h("label", { class: "small" }, "Rhythm ", every), h("label", { class: "small" }, "Next date ", next)),
    note,
    h("div", { class: "actions" },
      s.status === "pending" ? h("button", { type: "button", onclick: () => save({ status: "active" }, "Activated") }, "Activate") : null,
      s.status === "pending" ? waButton(s.phone_norm, standingWelcome({ ...s, next_date: next.value }), "WhatsApp: activated") : null,
      s.status === "active" ? waButton(s.phone_norm, standingMessage(s), "WhatsApp: confirm this delivery") : null,
      s.status === "active" ? h("button", { type: "button", onclick: async () => {
        try {
          const r = await api("standing/run", { id: s.id });
          toast("Order " + r.order_id + " created, " + money(r.total) + (r.skipped ? " (" + r.skipped + " product no longer sold, skipped)" : ""));
          location.hash = "order/" + encodeURIComponent(r.order_id);
        } catch (e) {
          toast(e.message, true);
        }
      } }, "Create today's order") : null,
      h("button", { type: "button", class: "ghost", onclick: () => save({}) }, "Save"),
      s.status === "active" ? h("button", { type: "button", class: "ghost", onclick: () => save({ status: "paused" }, "Paused") }, "Pause") : null,
      s.status === "paused" ? h("button", { type: "button", onclick: () => save({ status: "active" }, "Resumed") }, "Resume") : null,
      s.status !== "stopped" ? h("button", { type: "button", class: "ghost", onclick: () => save({ status: "stopped" }, "Stopped") }, "Stop") : null,
      dangerButton("Delete", async () => {
        await api("standing/delete", { id: s.id });
        toast("Standing order deleted");
        render();
      })));
}
async function standingView(params) {
  const status = params.get("status") || "";
  const d = await api("standing" + (status ? "?status=" + encodeURIComponent(status) : ""));
  markNav("standing");
  clear(view(), h("h1", {}, "Standing orders"),
    h("p", { class: "small muted" }, "A customer's basket repeated every week, 2 weeks or month. Requests from the website arrive as pending: activate them, " +
      "confirm each delivery on WhatsApp, then \"Create today's order\" makes a normal order at the till's current prices and moves the next date on."),
    filterBar(params, [{ name: "status", label: "Pending, active and paused", options: [["pending", "Pending"], ["active", "Active"], ["paused", "Paused"], ["stopped", "Stopped"]] }],
      (p) => { location.hash = "standing" + (p.toString() ? "?" + p : ""); }),
    d.standing.length ? d.standing.map(standingCard) : h("p", { class: "empty" }, "No standing orders yet. Customers ask for one by ticking \"Repeat this order\" in the cart."));
}
function quoteMessage(q) {
  return `السلام عليكم ${q.contact || ""}، شكرا لاهتمامكم بمنتجات ${SHOP_AR}. تلقّينا طلب عرض الأسعار الخاص بـ${q.business || "مؤسستكم"}، ` +
    "وسنرسل لكم العرض في أقرب وقت. هل يمكننا الاتصال بكم لتأكيد الكميات المطلوبة؟";
}
// A delete button that needs a second tap (native confirm() is unreliable in some in-app browsers)
function dangerButton(label, action) {
  let armed = 0;
  const b = h("button", { class: "danger small", type: "button" }, label);
  b.addEventListener("click", async () => {
    if (!armed) {
      armed = setTimeout(() => { armed = 0; b.classList.remove("armed"); b.textContent = label; }, 4000);
      b.classList.add("armed");
      b.textContent = "Tap again to confirm";
      return;
    }
    clearTimeout(armed);
    armed = 0;
    b.disabled = true;
    try {
      await action();
    } catch (e) {
      toast(e.message, true);
      b.disabled = false;
    }
  });
  return b;
}
function selectOf(options, value, labels) {
  return h("select", {}, options.map((o) => h("option", { value: o, selected: o === value }, labels ? labels[o] || o : o)));
}
function loading() {
  clear(view(), h("p", { class: "muted" }, "Loading…"));
}
function failed(e) {
  clear(view(), h("div", { class: "card" }, h("p", { class: "err" }, e.message), h("button", { type: "button", onclick: render }, "Retry")));
}

// ---------- login ----------

function showLogin() {
  $("login").classList.remove("hide");
  $("nav").classList.add("hide");
  $("logout").classList.add("hide");
  clear(view());
  setTimeout(() => $("key").focus(), 50);
}
function showApp() {
  $("login").classList.add("hide");
  $("nav").classList.remove("hide");
  $("logout").classList.remove("hide");
}

// ---------- views ----------

let counts = null;
function markNav(tab) {
  for (const a of document.querySelectorAll("#nav a")) {
    a.classList.toggle("on", a.dataset.tab === tab);
    const n = counts && { orders: counts.to_handle, reviews: counts.pending_reviews, quotes: counts.new_quotes, standing: (counts.standing_pending || 0) + (counts.standing_due || []).length }[a.dataset.tab];
    const old = a.querySelector(".count");
    if (old) old.remove();
    if (n) a.append(h("span", { class: "count" }, n));
  }
}

async function overviewView() {
  const d = await api("overview");
  counts = d;
  markNav("overview");
  const kpi = (label, value, sub, href, alert) =>
    h(href ? "a" : "div", { class: "kpi" + (alert ? " alert" : ""), href }, h("b", {}, value), h("span", {}, label), sub ? h("div", { class: "small muted" }, sub) : null);
  const n = (k) => k + (k === 1 ? " order" : " orders");
  clear(view(),
    h("h1", {}, "Overview"),
    h("div", { class: "kpis" },
      kpi("Today", money(d.today.revenue), n(d.today.orders)),
      kpi("Last 7 days", money(d.d7.revenue), n(d.d7.orders)),
      kpi("Last 30 days", money(d.d30.revenue), n(d.d30.orders)),
      kpi("Orders to handle", d.to_handle, "status new", "#orders?status=new", d.to_handle > 0),
      kpi("Unpaid bank transfers", d.unpaid_bank.orders, money(d.unpaid_bank.amount), "#orders?pay=bank&paid=0", d.unpaid_bank.orders > 0),
      kpi("Pending reviews", d.pending_reviews, "to publish or hide", "#reviews", d.pending_reviews > 0),
      kpi("New quote requests", d.new_quotes, "restaurants, hotels, events", "#quotes?status=new", d.new_quotes > 0)),
    (d.standing_due || []).length || d.standing_pending ? h("div", { class: "card" }, h("h2", {}, "Standing orders"),
      d.standing_pending ? h("p", {}, h("a", { href: "#standing?status=pending" }, d.standing_pending + (d.standing_pending === 1 ? " new request" : " new requests")), " waiting for your OK.") : null,
      (d.standing_due || []).length ? h("div", { class: "rows" }, d.standing_due.map(standingRowView)) : null) : null,
    (d.reorder || []).length ? h("div", { class: "card" }, h("h2", {}, "Due to reorder"),
      h("p", { class: "small muted" }, "From each customer's own rhythm: restaurants, hotels and event organisers first. One tap opens WhatsApp with a reminder naming their last order."),
      h("div", { class: "rows" }, d.reorder.map((r) => h("div", { class: "row" },
        h("div", { class: "main" },
          h("div", {}, h("a", { href: "#customer/" + encodeURIComponent(r.phone_norm) }, h("b", { dir: "auto" }, r.business || r.name || "+" + r.phone_norm)), " ", chip(r.kind)),
          h("div", { class: "small muted" }, r.days + " days since the last order" + (r.gap ? " · usually every " + r.gap + " days" : "") + " · " + r.orders + (r.orders === 1 ? " order" : " orders")),
          h("div", { class: "small" }, itemsLine(r.items))),
        h("div", { class: "side" }, waButton(r.phone_norm, reorderMessage(r), "WhatsApp reminder")))))) : null,
    h("div", { class: "grid2" },
      h("div", { class: "card" }, h("h2", {}, "Latest orders"),
        d.recent.length ? h("div", { class: "rows" }, d.recent.map(orderRow)) : h("p", { class: "empty" }, "No orders yet.")),
      h("div", { class: "card" }, h("h2", {}, "Top products, 30 days"),
        d.top.length ? h("table", {}, h("thead", {}, h("tr", {}, h("th", {}, "Product"), h("th", { class: "num" }, "Sold"), h("th", { class: "num" }, "Revenue"))),
          h("tbody", {}, d.top.map((t) => h("tr", {}, h("td", {}, ar(t.name || t.name_till || t.product)), h("td", { class: "num" }, qty(t.qty, t.unit)), h("td", { class: "num" }, money(t.revenue))))))
          : h("p", { class: "empty" }, "No sales in the last 30 days."),
        h("h2", {}, "Export"),
        h("div", { class: "actions" },
          h("a", { class: "btn ghost small", href: "/admin/export/orders.csv" }, "Orders CSV"),
          h("a", { class: "btn ghost small", href: "/admin/export/customers.csv" }, "Customers CSV")))));
}

function orderRow(o) {
  return h("a", { class: "row", href: "#order/" + encodeURIComponent(o.id) },
    h("div", { class: "main" }, h("div", {}, h("b", { dir: "auto" }, o.name || "(no name)"), " ", h("span", { class: "id" }, o.id)),
      h("div", { class: "small muted" }, when(o.at), " · ", PAY[o.pay] || o.pay)),
    h("div", { class: "side" }, h("div", {}, h("b", {}, money(o.total))),
      h("div", {}, chip(o.status), " ", o.pay !== "cod" ? chip(o.paid ? "paid" : "unpaid") : null)));
}

function filterBar(params, fields, onChange) {
  const form = h("form", { class: "filters", role: "search" });
  for (const f of fields) {
    let el;
    if (f.options) {
      el = h("select", { name: f.name, "aria-label": f.label }, h("option", { value: "" }, f.label), f.options.map(([v, l]) => h("option", { value: v, selected: params.get(f.name) === v }, l)));
      el.addEventListener("change", () => form.requestSubmit());
    } else {
      el = h("input", { type: "search", name: f.name, placeholder: f.label, value: params.get(f.name) || "", "aria-label": f.label });
    }
    form.append(el);
  }
  form.append(h("button", { type: "submit", class: "ghost" }, "Filter"));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const p = new URLSearchParams();
    for (const [k, v] of new FormData(form)) if (v) p.set(k, v);
    onChange(p);
  });
  return form;
}

async function listView(tab, endpoint, key, params, fields, rowFn, emptyText, extra) {
  markNav(tab);
  const rows = h("div", { class: "rows" });
  const more = h("button", { type: "button", class: "ghost more hide" }, "Load more");
  let offset = 0;
  async function page() {
    const p = new URLSearchParams(params);
    p.set("offset", offset);
    more.disabled = true;
    const d = await api(endpoint + "?" + p);
    const list = d[key];
    if (!offset && !list.length) rows.append(h("p", { class: "empty" }, emptyText));
    rows.append(...list.map(rowFn));
    offset += list.length;
    more.classList.toggle("hide", !d.more);
    more.disabled = false;
  }
  more.addEventListener("click", () => page().catch((e) => toast(e.message, true)));
  await page();
  clear(view(), h("h1", {}, tab[0].toUpperCase() + tab.slice(1)), extra || null,
    filterBar(params, fields, (p) => { location.hash = tab + (p.toString() ? "?" + p : ""); }), rows, more);
}

function ordersView(params) {
  return listView("orders", "orders", "orders", params, [
    { name: "q", label: "Search name, phone or order no." },
    { name: "status", label: "Any status", options: ORDER_STATUS.map((s) => [s, s]) },
    { name: "pay", label: "Any payment", options: Object.entries(PAY) },
    { name: "paid", label: "Paid or not", options: [["0", "Unpaid"], ["1", "Paid"]] },
  ], orderRow, "No orders match.",
  h("div", { class: "actions noprint" }, h("a", { class: "btn ghost small", href: "/admin/export/orders.csv" }, "Export CSV")));
}

function itemsTable(items, total) {
  return h("table", {},
    h("thead", {}, h("tr", {}, h("th", {}, "Product"), h("th", { class: "num" }, "Qty"), h("th", { class: "num" }, "Unit price"), h("th", { class: "num" }, "Line"))),
    h("tbody", {}, items.map((i) => h("tr", {},
      h("td", {}, ar(i.name || i.name_till || i.product), i.name_till && i.name_till !== i.name ? h("div", { class: "small muted", dir: "auto" }, i.name_till) : null),
      h("td", { class: "num" }, qty(i.qty, i.unit)),
      h("td", { class: "num" }, money(i.unit_price) + (i.unit === "kg" ? "/kg" : "")),
      h("td", { class: "num" }, money(i.line))))),
    h("tfoot", {}, h("tr", {}, h("td", { colspan: 3 }, "Total"), h("td", { class: "num" }, money(total)))));
}

async function orderView(id) {
  markNav("orders");
  const d = await api("order?id=" + encodeURIComponent(id));
  const o = d.order;
  const status = selectOf(ORDER_STATUS, o.status);
  const note = h("textarea", { "aria-label": "Internal note", placeholder: "Internal note (only you see it)" }, o.admin_note || "");
  async function save(change, msg) {
    try {
      await api("order", Object.assign({ id: o.id }, change));
      toast(msg);
      render();
    } catch (e) {
      toast(e.message, true);
    }
  }
  clear(view(),
    h("a", { class: "back", href: "#orders" }, "← Orders"),
    h("h1", {}, "Order ", o.id),
    h("div", { class: "actions" }, chip(o.status), o.pay !== "cod" ? chip(o.paid ? "paid" : "unpaid") : null, h("span", { class: "muted small" }, when(o.at))),
    h("div", { class: "grid2" },
      h("div", {},
        h("div", { class: "card" }, h("h2", {}, "Items"), itemsTable(d.items, o.total),
          h("div", { class: "actions" },
            waButton(o.phone_norm, orderMessage(o), "WhatsApp confirmation"),
            h("a", { class: "btn ghost", href: "#slip/" + encodeURIComponent(o.id) }, "Packing slip"))),
        h("div", { class: "card" }, h("h2", {}, "Status"),
          h("div", { class: "actions" }, status, h("button", { type: "button", onclick: () => save({ status: status.value }, "Status saved") }, "Save status")),
          h("h2", {}, "Payment"),
          h("p", {}, PAY[o.pay] || o.pay, " · ", o.paid ? "paid " + when(o.paid_at) : "not paid",
            o.stripe_session ? h("div", { class: "small muted" }, "Stripe: " + o.stripe_session) : null),
          h("div", { class: "actions" },
            h("button", { type: "button", class: o.paid ? "ghost" : "", onclick: () => save({ paid: !o.paid }, o.paid ? "Marked unpaid" : "Marked paid") },
              o.paid ? "Mark unpaid" : "Mark paid")),
          h("h2", {}, "Internal note"), note,
          h("div", { class: "actions" }, h("button", { type: "button", onclick: () => save({ admin_note: note.value }, "Note saved") }, "Save note")))),
      h("div", {},
        h("div", { class: "card" }, h("h2", {}, "Customer"),
          h("dl", { class: "kv" },
            h("dt", {}, "Name"), h("dd", { dir: "auto" }, o.name),
            h("dt", {}, "Phone"), h("dd", {}, o.phone, o.phone_norm && o.phone_norm !== o.phone ? h("div", { class: "small muted" }, "+" + o.phone_norm) : null),
            h("dt", {}, "Address"), h("dd", { dir: "auto" }, o.address || "—"),
            h("dt", {}, "Notes"), h("dd", { dir: "auto" }, o.notes || "—"),
            h("dt", {}, "Language"), h("dd", {}, o.lang),
            o.source ? [h("dt", {}, "Source"), h("dd", {}, o.source)] : null),
          d.customer ? h("div", { class: "actions" }, h("a", { class: "btn ghost small", href: "#customer/" + encodeURIComponent(d.customer.phone_norm) },
            "Customer file (" + d.customer.orders + " order" + (d.customer.orders === 1 ? "" : "s") + ")")) : null),
        d.reviews.length ? h("div", { class: "card" }, h("h2", {}, "Reviews from this order"),
          d.reviews.map((r) => h("div", {}, h("span", { class: "stars" }, stars(r.rating)), " ", r.product, " ", chip(r.status), r.verified ? [" ", chip("verified")] : null))) : null,
        h("div", { class: "card noprint" }, h("h2", {}, "Delete"),
          h("p", { class: "small muted" }, "Only for spam or test orders. This cannot be undone."),
          dangerButton("Delete order", async () => {
            await api("order/delete", { id: o.id });
            toast("Order deleted");
            location.hash = "orders";
          })))));
}

async function slipView(id) {
  markNav("orders");
  const d = await api("order?id=" + encodeURIComponent(id));
  const o = d.order;
  clear(view(),
    h("div", { class: "actions noprint" }, h("a", { class: "btn ghost", href: "#order/" + encodeURIComponent(o.id) }, "← Back"),
      h("button", { type: "button", onclick: () => window.print() }, "Print")),
    h("div", { class: "card slip" },
      h("div", { class: "slip-head" }, h("div", {}, h("b", {}, "Almas"), h("div", { class: "small" }, "Packing slip")),
        h("div", {}, h("b", {}, o.id), h("div", { class: "small" }, when(o.at)))),
      h("dl", { class: "kv" },
        h("dt", {}, "Customer"), h("dd", { dir: "auto" }, o.name),
        h("dt", {}, "Phone"), h("dd", {}, o.phone),
        h("dt", {}, "Address"), h("dd", { dir: "auto" }, o.address || "—"),
        h("dt", {}, "Notes"), h("dd", { dir: "auto" }, o.notes || "—"),
        h("dt", {}, "Payment"), h("dd", {}, (PAY[o.pay] || o.pay) + (o.pay === "cod" ? " — collect " + money(o.total) : o.paid ? " — paid" : " — NOT PAID"))),
      h("h2", {}, "Items"), itemsTable(d.items, o.total)));
}

function customersView(params) {
  return listView("customers", "customers", "customers", params, [
    { name: "q", label: "Search name, phone, tag" },
    { name: "kind", label: "Home and pro", options: [["home", "Home"], ["pro", "Pro"]] },
    { name: "due", label: "All customers", options: [["1", "Follow-up due"]] },
  ], (c) => h("a", { class: "row", href: "#customer/" + encodeURIComponent(c.phone_norm) },
    h("div", { class: "main" }, h("div", {}, h("b", { dir: "auto" }, c.name || "(no name)"), " ", chip(c.kind, c.kind === "pro" ? "pro" : "home"),
      c.business ? h("span", { class: "small muted", dir: "auto" }, " " + c.business) : null),
    h("div", { class: "small muted" }, "+" + c.phone_norm, c.tags ? " · " + c.tags : "",
      c.follow_up ? [" · follow up ", h("b", {}, c.follow_up)] : null)),
    h("div", { class: "side" }, h("div", {}, h("b", {}, money(c.spent))),
      h("div", { class: "small muted" }, c.orders + " order" + (c.orders === 1 ? "" : "s") + (c.quotes ? " · " + c.quotes + " quote" + (c.quotes === 1 ? "" : "s") : "")),
      h("div", { class: "small muted" }, c.last_order ? "last " + when(c.last_order, false) : ""))),
  "No customers match.",
  h("div", { class: "actions" }, h("a", { class: "btn ghost small", href: "/admin/export/customers.csv" }, "Export CSV")));
}

async function customerView(pn) {
  markNav("customers");
  const d = await api("customer?phone=" + encodeURIComponent(pn));
  const c = d.customer;
  const f = {
    name: h("input", { value: c.name, maxlength: 80 }),
    kind: selectOf(["home", "pro"], c.kind, { home: "Home cook", pro: "Pro (restaurant, hotel, events)" }),
    business: h("input", { value: c.business, maxlength: 100 }),
    tags: h("input", { value: c.tags, maxlength: 200, placeholder: "e.g. ramadan, wholesale, vip" }),
    follow_up: h("input", { type: "date", value: c.follow_up }),
    notes: h("textarea", { maxlength: 2000 }, c.notes),
  };
  const field = (label, el) => h("div", { class: "field" }, h("label", {}, label), el);
  const spent = d.orders.filter((o) => o.status !== "cancelled").reduce((s, o) => s + Number(o.total || 0), 0);
  clear(view(),
    h("a", { class: "back", href: "#customers" }, "← Customers"),
    h("h1", { dir: "auto" }, c.name || "+" + c.phone_norm),
    h("div", { class: "actions" }, chip(c.kind), h("span", {}, "+" + c.phone_norm), waButton(c.phone_norm, "السلام عليكم " + (c.name || "") + "، ", "WhatsApp")),
    h("div", { class: "grid2" },
      h("div", {},
        h("div", { class: "card" }, h("h2", {}, "Orders (" + d.orders.length + ") · " + money(spent)),
          d.orders.length ? h("div", { class: "rows" }, d.orders.map((o) => orderRow(Object.assign({ name: c.name }, o)))) : h("p", { class: "empty" }, "No orders.")),
        h("div", { class: "card" }, h("h2", {}, "Quote requests (" + d.quotes.length + ")"),
          d.quotes.length ? h("div", { class: "rows" }, d.quotes.map((q) => h("a", { class: "row", href: "#quotes?q=" + encodeURIComponent(q.id) },
            h("div", { class: "main" }, h("b", { dir: "auto" }, q.business), " ", h("span", { class: "id" }, q.id), h("div", { class: "small muted" }, when(q.at), " · ", q.type)),
            h("div", { class: "side" }, chip(q.status))))) : h("p", { class: "empty" }, "No quote requests."))),
      h("div", {},
        h("div", { class: "card" }, h("h2", {}, "Customer file"),
          field("Name", f.name), field("Kind", f.kind), field("Business", f.business), field("Tags", f.tags),
          field("Follow up on", f.follow_up), field("Notes", f.notes),
          h("div", { class: "actions" },
            h("button", { type: "button", onclick: async () => {
              try {
                await api("customer", { phone_norm: c.phone_norm, name: f.name.value, kind: f.kind.value, business: f.business.value,
                  tags: f.tags.value, follow_up: f.follow_up.value, notes: f.notes.value });
                toast("Saved");
                render();
              } catch (e) {
                toast(e.message, true);
              }
            } }, "Save"),
            f.follow_up.value ? h("button", { type: "button", class: "ghost", onclick: () => { f.follow_up.value = ""; } }, "Clear follow-up") : null)),
        h("div", { class: "card" }, h("h2", {}, "Delete"),
          h("p", { class: "small muted" }, "Removes this customer file only; their orders stay."),
          dangerButton("Delete customer", async () => {
            await api("customer/delete", { phone_norm: c.phone_norm });
            toast("Customer deleted");
            location.hash = "customers";
          })))));
}

function quoteRow(q) {
  const status = selectOf(QUOTE_STATUS, q.status);
  const note = h("textarea", { placeholder: "Internal note" }, q.admin_note || "");
  return h("div", { class: "card" },
    h("div", { class: "actions" }, h("b", { dir: "auto" }, q.business), chip(q.status), h("span", { class: "id" }, q.id)),
    h("div", { class: "small muted" }, when(q.at), q.type ? " · " + q.type : "", q.city ? " · " : "", q.city ? h("span", { dir: "auto" }, q.city) : null),
    h("dl", { class: "kv" },
      h("dt", {}, "Contact"), h("dd", {}, h("span", { dir: "auto" }, q.contact || "—"), " · ", q.phone,
        q.phone_norm ? [" · ", h("a", { href: "#customer/" + encodeURIComponent(q.phone_norm) }, "customer file")] : null),
      q.freq ? [h("dt", {}, "Frequency"), h("dd", {}, q.freq)] : null,
      q.event_date ? [h("dt", {}, "Event date"), h("dd", {}, q.event_date)] : null,
      q.guests ? [h("dt", {}, "Guests"), h("dd", {}, q.guests)] : null,
      h("dt", {}, "Products"), h("dd", { class: "review-text", dir: "auto" }, q.items || "—")),
    note,
    h("div", { class: "actions" }, status,
      h("button", { type: "button", onclick: async () => {
        try {
          await api("quote", { id: q.id, status: status.value, admin_note: note.value });
          toast("Saved");
          render();
        } catch (e) {
          toast(e.message, true);
        }
      } }, "Save"),
      waButton(q.phone_norm, quoteMessage(q), "WhatsApp"),
      dangerButton("Delete", async () => {
        await api("quote/delete", { id: q.id });
        toast("Quote deleted");
        render();
      })));
}

function quotesView(params) {
  return listView("quotes", "quotes", "quotes", params, [
    { name: "q", label: "Search business, contact, city" },
    { name: "status", label: "Any status", options: QUOTE_STATUS.map((s) => [s, s]) },
  ], quoteRow, "No quote requests match.");
}

async function reviewsView(params) {
  markNav("reviews");
  const d = await api("reviews?" + params);
  const set = async (r, status) => {
    try {
      await api("review", { id: r.id, status });
      toast(status === "published" ? "Published" : status === "hidden" ? "Hidden" : "Saved");
      render();
    } catch (e) {
      toast(e.message, true);
    }
  };
  clear(view(), h("h1", {}, "Reviews"),
    filterBar(params, [{ name: "status", label: "Any status", options: [["pending", "pending"], ["published", "published"], ["hidden", "hidden"]] }],
      (p) => { location.hash = "reviews" + (p.toString() ? "?" + p : ""); }),
    d.reviews.length ? d.reviews.map((r) => h("div", { class: "card" },
      h("div", { class: "actions" }, h("span", { class: "stars" }, stars(r.rating)), chip(r.status), r.verified ? chip("verified", "verified buyer") : null,
        h("span", { class: "small muted" }, when(r.at))),
      h("div", {}, h("b", {}, r.product_name ? ar(r.product_name.ar) : r.product), " ", h("span", { class: "id" }, r.product)),
      r.text ? h("p", { class: "review-text", dir: "auto" }, r.text) : h("p", { class: "muted" }, "(rating only)"),
      h("div", { class: "small muted" }, "— ", h("span", { dir: "auto" }, r.name || "anonymous"), " · ", r.lang,
        r.order_id ? [" · order ", r.order_exists ? h("a", { href: "#order/" + encodeURIComponent(r.order_id) }, r.order_id) : r.order_id + " (not found)"] : null),
      h("div", { class: "actions" },
        r.status !== "published" ? h("button", { type: "button", onclick: () => set(r, "published") }, "Publish") : null,
        r.status !== "hidden" ? h("button", { type: "button", class: "ghost", onclick: () => set(r, "hidden") }, "Hide") : null,
        dangerButton("Delete", async () => {
          await api("review/delete", { id: r.id });
          toast("Review deleted");
          render();
        }))))
      : h("p", { class: "empty" }, "No reviews."));
}

async function productsView(params) {
  markNav("products");
  const d = await api("products");
  const q = (params.get("q") || "").trim().toLowerCase();
  const list = d.products.filter((p) => !q || [p.ar, p.fr, p.en, p.id].join(" ").toLowerCase().includes(q));
  clear(view(), h("h1", {}, "Products"),
    d.error ? h("p", { class: "err" }, d.error) : null,
    filterBar(params, [{ name: "q", label: "Search product" }], (p) => { location.hash = "products" + (p.toString() ? "?" + p : ""); }),
    h("p", { class: "small muted" }, list.length + " products · sales are the last 30 days, cancelled orders excluded"),
    h("div", { class: "rows" }, list.map((p) => h("div", { class: "row" },
      h("div", { class: "main" }, h("div", {}, h("b", {}, ar(p.ar)), " ", h("span", { class: "id" }, p.id)),
        h("div", { class: "small muted" }, [p.fr, p.en].filter(Boolean).join(" · "))),
      h("div", { class: "side" },
        h("div", {}, p.price !== null ? money(p.price) + (p.unit === "kg" ? "/kg" : "") : ""),
        h("div", { class: "small" }, p.qty30 ? qty(p.qty30, p.unit) + " · " + money(p.rev30) : h("span", { class: "muted" }, "no sales")),
        h("div", { class: "small" }, p.count ? [h("span", { class: "stars" }, stars(p.avg)), " " + p.avg + " (" + p.count + ")"] : h("span", { class: "muted" }, "no reviews"),
          p.pending ? h("a", { href: "#reviews?status=pending" }, " +" + p.pending + " pending") : null))))));
}

// ---------- Google Sheet ----------

async function sheetView() {
  markNav("sheet");
  const d = await api("sheet");
  const copy = async (btn) => {
    try { await navigator.clipboard.writeText(d.script); btn.textContent = "Copied ✓"; }
    catch (e) { code.select(); document.execCommand("copy"); btn.textContent = "Copied ✓"; }
    setTimeout(() => { btn.textContent = "Copy the code"; }, 2000);
  };
  const code = h("textarea", { class: "code", readonly: true, rows: 12, spellcheck: "false" });
  code.value = d.script;
  const urlIn = h("input", { type: "url", placeholder: "https://script.google.com/macros/s/.../exec", value: d.url || "" });
  const busy = (btn, fn) => async () => {
    btn.disabled = true;
    try { await fn(); } catch (e) { toast(e.message, true); } finally { btn.disabled = false; }
  };
  const connectBtn = h("button", { type: "button" }, d.connected ? "Save and test again" : "Connect");
  connectBtn.onclick = busy(connectBtn, async () => { await api("sheet", { url: urlIn.value.trim() }); toast("Connected: a test row is in the tab “Test”."); sheetView(); });
  const testBtn = h("button", { type: "button", class: "ghost" }, "Send a test row");
  testBtn.onclick = busy(testBtn, async () => { await api("sheet/test", {}); toast("Test row sent to the tab “Test”."); });
  const backBtn = h("button", { type: "button", class: "ghost" }, "Copy all past orders into the sheet");
  backBtn.onclick = busy(backBtn, async () => {
    if (!confirm("Add every order so far to the tab “Orders”? Run it once, or rows will be repeated.")) return;
    const r = await api("sheet/backfill", {}); toast(r.added + " orders added to the sheet.");
  });
  const offBtn = h("button", { type: "button", class: "ghost small" }, "Disconnect");
  offBtn.onclick = busy(offBtn, async () => { await api("sheet/disconnect", {}); toast("Disconnected."); sheetView(); });
  const copyBtn = h("button", { type: "button", class: "ghost" }, "Copy the code");
  copyBtn.onclick = () => copy(copyBtn);
  clear(view(), h("h1", {}, "Google Sheet"),
    h("p", { class: d.connected ? "ok" : "muted" }, d.connected
      ? "Connected. Every new order, business request, standing order and review is added to your sheet a few seconds after it arrives."
      : "Not connected yet. Once connected, every new order, business request, standing order and review is also added to a Google Sheet of yours."),
    d.connected ? h("div", { class: "card" }, h("h2", {}, "Connected sheet"),
      h("p", { class: "small muted break" }, d.url),
      h("div", { class: "actions" }, testBtn, backBtn, offBtn)) : null,
    h("div", { class: "card" }, h("h2", {}, d.connected ? "Set up again" : "Connect in 5 steps"),
      h("ol", { class: "steps" },
        h("li", {}, "Open ", h("a", { href: "https://sheets.new", target: "_blank", rel: "noopener" }, "a new Google Sheet"), " in the Google account that should own the orders, and name it, for example “Almas orders”."),
        h("li", {}, "In the sheet: Extensions → Apps Script. Delete what is in the editor, paste the code below, then press Save."),
        h("li", {}, "Deploy → New deployment → the gear → Web app. Execute as: Me. Who has access: Anyone. Press Deploy."),
        h("li", {}, "Google asks for permission: Authorize access → your account → Advanced → Go to the project → Allow. It is your own script, writing only to this sheet."),
        h("li", {}, "Copy the Web app URL, paste it here and press Connect. A test row appears in the tab “Test”.")),
      h("div", { class: "actions" }, copyBtn),
      code,
      h("p", { class: "small muted" }, "The code holds this shop's private key: anyone without it cannot write to your sheet. Do not share it."),
      h("label", {}, "Web app URL", urlIn),
      h("div", { class: "actions" }, connectBtn)));
}

// ---------- router ----------

async function render() {
  const raw = decodeURIComponent(location.hash.slice(1)) || "overview";
  const [path, query] = raw.split("?");
  const params = new URLSearchParams(query || "");
  const [tab, arg] = [path.split("/")[0], path.split("/").slice(1).join("/")];
  loading();
  try {
    if (!counts && tab !== "overview") api("overview").then((d) => { counts = d; markNav(tab === "order" || tab === "slip" ? "orders" : tab === "customer" ? "customers" : tab); }).catch(() => {});
    if (tab === "orders") await ordersView(params);
    else if (tab === "order") await orderView(arg);
    else if (tab === "slip") await slipView(arg);
    else if (tab === "customers") await customersView(params);
    else if (tab === "customer") await customerView(arg);
    else if (tab === "quotes") await quotesView(params);
    else if (tab === "reviews") await reviewsView(params);
    else if (tab === "products") await productsView(params);
    else if (tab === "standing") await standingView(params);
    else if (tab === "sheet") await sheetView();
    else await overviewView();
    window.scrollTo(0, 0);
  } catch (e) {
    if (!$("login").classList.contains("hide")) return;
    failed(e);
  }
}

async function start() {
  $("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("loginMsg").textContent = "";
    try {
      await api("login", { key: $("key").value });
      $("key").value = "";
      showApp();
      render();
    } catch (err) {
      $("loginMsg").textContent = err.message;
    }
  });
  $("logout").addEventListener("click", async () => {
    try {
      await api("logout", {});
    } catch (e) {
      /* the cookie is cleared either way below */
    }
    counts = null;
    showLogin();
  });
  window.addEventListener("hashchange", render);
  let me = null;
  try {
    me = await api("me");
  } catch (e) {
    /* offline or server error: the login form is the safe place to start */
  }
  if (!me || !me.admin) {
    showLogin();
    return;
  }
  showApp();
  render();
}

start();
