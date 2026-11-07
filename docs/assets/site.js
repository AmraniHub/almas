/* Almas website: cart, live prices, filters, WhatsApp order, Meta pixel events.
   Product ids ("p13") are the same in the page, the Meta catalogue feed and the pixel events, which is what lets
   catalogue ads match a visitor to the product they looked at. */
(function () {
  "use strict";
  var A = window.ALMAS;
  if (!A) return;
  var KEY = "almas-cart-v1";
  var cart = {};
  try { cart = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { cart = {}; }

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch (e) { /* private mode */ } }
  function fmt(n) { var r = Math.round(n * 100) / 100; return String(r % 1 ? r.toFixed(2).replace(/0$/, "") : r); }
  function money(n) { return A.money.replace("{}", fmt(n)); }
  function step(id) { return A.p[id] && A.p[id].u === "kg" ? 0.25 : 1; }
  function amount(id, q) {
    if (A.p[id].u !== "kg") return fmt(q) + " ×";
    if (q < 1) {
      var g = Math.round(q * 1000);
      return A.lang === "ar" ? g + " غرام" : g + " g";
    }
    return A.lang === "ar" ? fmt(q) + " كيلو" : fmt(q) + " kg";
  }
  function track(ev, ids, value) {
    try {
      window.fbq("track", ev, { content_ids: ids, content_type: "product", value: Math.round(value * 100) / 100, currency: "MAD" });
    } catch (e) { /* pixel blocked or not configured */ }
  }

  /* live prices: the page was built from the till's catalogue; this brings any change since the build */
  function applyPrices() {
    $$("[data-price]").forEach(function (el) {
      var p = A.p[el.getAttribute("data-price")];
      if (p) el.textContent = money(p.price);
    });
  }
  try {
    fetch(A.feed, { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (!d || !d.products) return;
      d.products.forEach(function (p) { if (A.p[p.id] && p.price) A.p[p.id].price = p.price; });
      Object.keys(cart).forEach(function (id) { if (!A.p[id]) delete cart[id]; });
      applyPrices(); render();
    }).catch(function () {});
  } catch (e) { /* old browser: the built prices stay */ }

  /* cart */
  function count() { return Object.keys(cart).length; }
  function total() { return Object.keys(cart).reduce(function (s, id) { return s + cart[id] * A.p[id].price; }, 0); }
  function add(id, q) {
    if (!A.p[id]) return;
    cart[id] = Math.round(((cart[id] || 0) + q) * 100) / 100;
    if (cart[id] <= 0) delete cart[id];
    save(); render();
  }
  function render() {
    var c = $("[data-cart-count]");
    if (c) { c.textContent = count() || ""; if (count()) c.removeAttribute("data-zero"); else c.setAttribute("data-zero", ""); }
    var list = $("[data-cart-lines]");
    if (!list) return;
    list.innerHTML = "";
    Object.keys(cart).forEach(function (id) {
      var p = A.p[id];
      if (!p) return;
      var li = document.createElement("li");
      var other = A.lang === "ar" ? "" : '<span class="ln-ar" lang="ar">' + esc(p.ar) + "</span>";
      li.innerHTML = '<span><span class="ln-name">' + esc(p.n) + "</span><br>" + other + "</span>" +
        "<b>" + money(cart[id] * p.price) + "</b>" +
        '<span class="ln-ctl"><button type="button" data-dec aria-label="-">−</button><span>' + amount(id, cart[id]) +
        '</span><button type="button" data-inc aria-label="+">+</button><button type="button" class="rm" data-rm>' + esc(A.s.remove) + "</button></span>";
      $("[data-dec]", li).onclick = function () { add(id, -step(id)); };
      $("[data-inc]", li).onclick = function () { add(id, step(id)); };
      $("[data-rm]", li).onclick = function () { delete cart[id]; save(); render(); };
      list.appendChild(li);
    });
    var has = count() > 0;
    var empty = $("[data-cart-empty]"), form = $("[data-cart-form]");
    if (empty) empty.hidden = has;
    if (form) form.hidden = !has;
    var t = $("[data-cart-total]");
    if (t) t.textContent = money(total());
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (ch) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]; }); }

  var drawer = $("[data-drawer]");
  function openCart() {
    if (!drawer) return;
    drawer.hidden = false;
    document.body.style.overflow = "hidden";
  }
  function closeCart() { if (drawer) { drawer.hidden = true; document.body.style.overflow = ""; } }
  $$("[data-open-cart]").forEach(function (b) { b.onclick = openCart; });
  $$("[data-close-cart]").forEach(function (b) { b.onclick = closeCart; });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeCart(); });

  $$("[data-add]").forEach(function (b) {
    b.onclick = function () {
      var id = b.getAttribute("data-add");
      add(id, step(id));
      track("AddToCart", [id], step(id) * A.p[id].price);
      b.classList.add("done"); b.textContent = "✓";
      setTimeout(function () { b.classList.remove("done"); b.textContent = "+"; }, 900);
    };
  });

  /* product page: quantity picker, add, order this one product now */
  var pid = document.body.getAttribute("data-product");
  if (pid && A.p[pid]) {
    var q = 1; // 1 kg or one piece, the unit the price is shown for
    var box = $("[data-qty-for]"), lab = $("[data-qty-label]");
    var show = function () { if (lab) lab.textContent = amount(pid, q); };
    if (box) $$("[data-step]", box).forEach(function (b) {
      b.onclick = function () { q = Math.max(step(pid), Math.round((q + step(pid) * +b.getAttribute("data-step")) * 100) / 100); show(); };
    });
    show();
    var addq = $("[data-add-qty]");
    if (addq) addq.onclick = function () {
      add(pid, q); track("AddToCart", [pid], q * A.p[pid].price);
      addq.textContent = A.s.added + " ✓"; setTimeout(openCart, 250);
    };
    var one = $("[data-order-one]");
    if (one) one.onclick = function () {
      var p = A.p[pid];
      var line = amount(pid, q) + " " + p.ar + (A.lang === "ar" ? "" : " (" + p.n + ")");
      one.href = "https://wa.me/" + A.wa + "?text=" + encodeURIComponent(A.s.one_msg + line);
      track("InitiateCheckout", [pid], q * p.price);
    };
    track("ViewContent", [pid], A.p[pid].price);
  }

  /* WhatsApp order: the same layout as the app's, every line carrying the till's Arabic name */
  var form = $("[data-order-form]");
  if (form) form.onsubmit = function (e) {
    e.preventDefault();
    var f = new FormData(form), s = A.s, ids = Object.keys(cart);
    if (!ids.length) return;
    var lines = [s.order_head + " (" + s.o_from + ")", "", s.o_name + ": " + f.get("name"), s.o_phone + ": " + f.get("phone")];
    if (String(f.get("address") || "").trim()) lines.push(s.o_address + ": " + f.get("address"));
    if (String(f.get("notes") || "").trim()) lines.push(s.o_notes + ": " + String(f.get("notes")).trim());
    lines.push("", s.o_items + ":");
    ids.forEach(function (id) {
      var p = A.p[id];
      lines.push("• " + amount(id, cart[id]) + " " + p.ar + (A.lang === "ar" ? "" : " (" + p.n + ")") + " — " + money(cart[id] * p.price));
    });
    lines.push("", "*" + s.o_total + ": " + money(total()) + "*");
    track("InitiateCheckout", ids, total());
    try { window.fbq("track", "Lead", { content_ids: ids, content_type: "product", value: Math.round(total() * 100) / 100, currency: "MAD" }); } catch (err) {}
    window.location.href = "https://wa.me/" + A.wa + "?text=" + encodeURIComponent(lines.join("\n"));
  };

  /* home: search and shelf filter */
  var grid = $("[data-grid]");
  if (grid) {
    var shelf = "", term = "";
    var apply = function () {
      var shown = 0;
      $$(".card", grid).forEach(function (c) {
        var ok = (!shelf || c.getAttribute("data-cat") === shelf) && (!term || c.getAttribute("data-search").indexOf(term) >= 0);
        c.hidden = !ok; if (ok) shown++;
      });
      var none = $("[data-none]"); if (none) none.hidden = shown > 0;
    };
    $$("[data-filter]").forEach(function (b) {
      b.onclick = function () {
        shelf = b.getAttribute("data-filter");
        $$("[data-filter]").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
        apply();
      };
    });
    var sb = $("[data-search-box]");
    if (sb) sb.oninput = function () { term = sb.value.trim().toLowerCase(); apply(); };
  }

  /* any WhatsApp link: tell the pixel someone reached out */
  $$("a.wa-link").forEach(function (a) {
    if (a.hasAttribute("data-order-one")) return;
    a.addEventListener("click", function () { try { window.fbq("track", "Contact"); } catch (e) {} });
  });

  render();
})();
