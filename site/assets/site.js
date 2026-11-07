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
    if (count()) { var dn = $("[data-done]"); if (dn) dn.hidden = true; list.hidden = false; } // a new cart after an order
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
    renderUpsell();
  }

  /* upsell: what goes with the cart, from the shelves that complete it, best sellers first */
  var GOES_WITH = { spices: ["blends", "herbs", "spices"], blends: ["spices", "blends"], herbs: ["herbs", "spices"],
    seeds: ["seeds", "pastry"], pastry: ["pastry", "seeds"], pantry: ["pantry", "spices"],
    beauty: ["beauty", "incense"], incense: ["incense", "beauty"] };
  function suggestions(n) {
    var ids = Object.keys(cart), shelves = [];
    ids.forEach(function (id) { (GOES_WITH[A.p[id].c] || [A.p[id].c]).forEach(function (c) { if (shelves.indexOf(c) < 0) shelves.push(c); }); });
    var out = [];
    shelves.forEach(function (c) {
      Object.keys(A.p).filter(function (id) { return A.p[id].c === c && !cart[id] && out.indexOf(id) < 0; })
        .sort(function (a, b) { return A.p[b].r - A.p[a].r; }).slice(0, 2)
        .forEach(function (id) { if (out.length < n) out.push(id); });
    });
    return out;
  }
  function miniItem(id, attr) {
    var p = A.p[id], unit = p.u === "kg" ? A.s.kg : A.s.piece;
    return '<li><a href="' + p.l + '"><img src="' + p.i + '" alt="" width="56" height="56" loading="lazy"><span><b>' + esc(p.n) +
      "</b><small>" + esc(A.lang === "ar" ? p.fr : p.ar) + "</small><small>" + money(p.price) + " " + esc(unit) + "</small></span></a>" +
      '<button type="button" class="add" ' + attr + '="' + id + '" aria-label="' + esc(A.s.add) + '">+</button></li>';
  }
  function addFrom(b, attr) {
    var id = b.getAttribute(attr);
    add(id, step(id));
    track("AddToCart", [id], step(id) * A.p[id].price);
    b.classList.add("done"); b.textContent = "✓";
  }
  function renderUpsell() {
    var box = $("[data-upsell]"), list = $("[data-upsell-list]");
    if (!box || !list) return;
    var ids = count() ? suggestions(4) : [];
    box.hidden = !ids.length;
    list.innerHTML = ids.map(function (id) { return miniItem(id, "data-up"); }).join("");
    $$("[data-up]", list).forEach(function (b) { b.onclick = function () { addFrom(b, "data-up"); }; });
  }

  /* search in any of the three languages: accents, Arabic vowel marks and letter variants do not matter */
  var ch = String.fromCharCode;
  var LATIN_MARKS = new RegExp("[" + ch(0x300) + "-" + ch(0x36f) + "]", "g");
  var AR_MARKS = new RegExp("[" + ch(0x64b) + "-" + ch(0x652) + ch(0x640) + "]", "g");
  var AR_SAME = [[new RegExp("[" + ch(0x623) + ch(0x625) + ch(0x622) + "]", "g"), ch(0x627)], [new RegExp(ch(0x629), "g"), ch(0x647)],
    [new RegExp(ch(0x649), "g"), ch(0x64a)], [new RegExp(ch(0x624), "g"), ch(0x648)], [new RegExp(ch(0x626), "g"), ch(0x64a)]];
  function norm(s) {
    s = String(s || "").toLowerCase().normalize("NFD").replace(LATIN_MARKS, "").replace(AR_MARKS, "");
    AR_SAME.forEach(function (r) { s = s.replace(r[0], r[1]); });
    return s.replace(/[^a-z0-9؀-ۿ]+/g, " ").trim();
  }
  /* consonant skeletons, so spellings meet: the till's الكيمون and a customer's كمون, or Darija in Latin letters
     (kamoun, kharkoum, skinjbir, zaatar) against the Arabic name */
  var AL = ch(0x627) + ch(0x644), AR_VOWELS = new RegExp("[" + ch(0x627) + ch(0x648) + ch(0x64a) + ch(0x621) + "]", "g");
  var AR2LAT = {};
  [[0x628, "b"], [0x62a, "t"], [0x62b, "t"], [0x62c, "j"], [0x62d, "h"], [0x62e, "kh"], [0x62f, "d"], [0x630, "d"], [0x631, "r"],
   [0x632, "z"], [0x633, "s"], [0x634, "ch"], [0x635, "s"], [0x636, "d"], [0x637, "t"], [0x638, "d"], [0x63a, "gh"], [0x641, "f"],
   [0x642, "k"], [0x643, "k"], [0x644, "l"], [0x645, "m"], [0x646, "n"], [0x647, "h"]].forEach(function (x) { AR2LAT[ch(x[0])] = x[1]; });
  function arWords(s) { return norm(s).split(" ").map(function (w) { return w.length > 3 && w.indexOf(AL) === 0 ? w.slice(2) : w; }); }
  function arSkel(s) { return arWords(s).map(function (w) { return w.replace(AR_VOWELS, ""); }).join(" "); }
  function arToLat(s) { return arWords(s).map(function (w) { return w.split("").map(function (c) { return AR2LAT[c] || ""; }).join(""); }).join(" "); }
  function latSkel(s) { return norm(s).replace(/sh/g, "ch").replace(/q/g, "k").replace(/[aeiouyw]/g, ""); }
  var INDEX = {}, SKEL = {};
  Object.keys(A.p).forEach(function (id) {
    var p = A.p[id];
    INDEX[id] = norm([p.n, p.ar, p.fr, p.en, A.cats ? A.cats[p.c] : ""].join(" "));
    SKEL[id] = arSkel(p.ar) + " | " + arToLat(p.ar);
  });
  function find(q) {
    var words = norm(q).split(" ").filter(Boolean);
    if (!words.length) return Object.keys(A.p).sort(function (a, b) { return A.p[b].r - A.p[a].r; }).slice(0, 8);
    var arabic = /[؀-ۿ]/.test(q);
    var skel = (arabic ? arSkel(q) : latSkel(q)).split(" ").filter(function (w) { return w.length >= 2; });
    return Object.keys(A.p).map(function (id) {
      var h = INDEX[id], score = 0, ok = true;
      for (var i = 0; i < words.length; i++) {
        var at = h.indexOf(words[i]);
        if (at < 0) { ok = false; break; }
        score += at === 0 || h.charAt(at - 1) === " " ? 3 : 1; // a word that starts a name counts more
      }
      if (!ok) { // a near spelling: every consonant skeleton of the query inside the product's
        if (!skel.length || !skel.every(function (w) { return SKEL[id].indexOf(w) >= 0; })) return null;
        score = 0.5;
      }
      return [id, score + Math.min(A.p[id].r, 200) / 1000];
    }).filter(Boolean).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 8).map(function (x) { return x[0]; });
  }
  var sv = $("[data-search-panel]"), si = $("[data-search-input]");
  function showResults() {
    var q = si.value, ids = find(q), head = $("[data-search-head]"), list = $("[data-search-results]");
    head.textContent = !norm(q) ? A.s.search_pop : ids.length ? "" : A.s.search_none;
    list.innerHTML = ids.map(function (id) { return miniItem(id, "data-sadd"); }).join("");
    $$("[data-sadd]", list).forEach(function (b) { b.onclick = function () { addFrom(b, "data-sadd"); }; });
  }
  function openSearch() { if (!sv) return; sv.hidden = false; document.body.style.overflow = "hidden"; showResults(); setTimeout(function () { si.focus(); }, 30); }
  function closeSearch() { if (sv && !sv.hidden) { sv.hidden = true; document.body.style.overflow = ""; } }
  $$("[data-open-search]").forEach(function (b) { b.onclick = openSearch; });
  $$("[data-close-search]").forEach(function (b) { b.onclick = closeSearch; });
  if (si) si.oninput = showResults;
  if (sv) sv.addEventListener("click", function (e) { if (e.target === sv) closeSearch(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeSearch(); });

  /* product page gallery: thumbnails pick a picture, swiping moves the highlight */
  $$("[data-gallery]").forEach(function (g) {
    var track = $(".g-track", g), thumbs = $$("[data-g]", g);
    var mark = function (i) { thumbs.forEach(function (t, k) { if (k === i) t.setAttribute("aria-current", "true"); else t.removeAttribute("aria-current"); }); };
    thumbs.forEach(function (t, i) {
      t.onclick = function () { track.scrollTo({ left: track.children[i].offsetLeft - track.offsetLeft, behavior: "smooth" }); mark(i); };
    });
    track.addEventListener("scroll", function () {
      var w = track.clientWidth || 1;
      mark(Math.min(thumbs.length - 1, Math.round(Math.abs(track.scrollLeft) / w)));
    }, { passive: true });
  });
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

  /* the order: sent to the shop (Telegram, through /api/order, priced again there from the till), then a
     confirmation; WhatsApp carries the same text, the app's layout with the till's Arabic name on every line */
  function orderText(f, number) {
    var s = A.s, ids = Object.keys(cart);
    var lines = [s.order_head + " (" + s.o_from + ")", ""];
    if (number) lines.push(s.o_number + ": " + number);
    lines.push(s.o_name + ": " + f.get("name"), s.o_phone + ": " + f.get("phone"));
    if (String(f.get("address") || "").trim()) lines.push(s.o_address + ": " + f.get("address"));
    lines.push(s.o_pay + ": " + (f.get("pay") === "bank" ? s.pay_bank : s.pay_cod));
    if (String(f.get("notes") || "").trim()) lines.push(s.o_notes + ": " + String(f.get("notes")).trim());
    lines.push("", s.o_items + ":");
    ids.forEach(function (id) {
      var p = A.p[id];
      lines.push("• " + amount(id, cart[id]) + " " + p.ar + (A.lang === "ar" ? "" : " (" + p.n + ")") + " — " + money(cart[id] * p.price));
    });
    lines.push("", "*" + s.o_total + ": " + money(total()) + "*");
    return lines.join("\n");
  }
  var form = $("[data-order-form]");
  if (form) {
    $$("input[name=pay]", form).forEach(function (r) {
      r.onchange = function () { var b = $("[data-bank]"); if (b) b.hidden = form.pay.value !== "bank"; };
    });
    form.onsubmit = function (e) {
      e.preventDefault();
      var f = new FormData(form), ids = Object.keys(cart), btn = $("[data-send]", form);
      if (!ids.length || (btn && btn.disabled)) return;
      var value = total();
      if (btn) { btn.disabled = true; btn.textContent = A.s.sending; }
      track("InitiateCheckout", ids, value);
      var body = { lang: A.lang, name: f.get("name"), phone: f.get("phone"), address: f.get("address"), notes: f.get("notes"),
                   pay: f.get("pay"), website: f.get("website"), items: ids.map(function (id) { return { id: id, q: cart[id] }; }) };
      var fallback = function () {
        alert(A.s.fail);
        window.location.href = "https://wa.me/" + A.wa + "?text=" + encodeURIComponent(orderText(f, ""));
      };
      fetch(A.api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        .then(function (r) { return r.json().catch(function () { return {}; }); })
        .then(function (d) {
          if (d && !d.ok && d.error === "card") { // Stripe refused this order: let them pick another way to pay
            if (btn) { btn.disabled = false; btn.textContent = A.s.send; }
            return alert(A.s.card_fail);
          }
          if (!d || !d.ok) { if (btn) { btn.disabled = false; btn.textContent = A.s.send; } return fallback(); }
          if (d.url) { window.location.href = d.url; return; } // card: Stripe's payment page, then /merci/
          try { window.fbq("track", "Lead", { content_ids: ids, content_type: "product", value: d.total, currency: "MAD" }); } catch (err) {}
          var wa = $("[data-done-wa]");
          if (wa) wa.href = "https://wa.me/" + A.wa + "?text=" + encodeURIComponent(orderText(f, d.number));
          $("[data-done-body]").textContent = A.s.done_body.replace("{n}", d.number).replace("{t}", money(d.total));
          var db = $("[data-done-bank]"); if (db) db.hidden = f.get("pay") !== "bank";
          $("[data-cart-form]").hidden = true;
          $("[data-cart-lines]").hidden = true;
          $("[data-done]").hidden = false;
          cart = {}; save();
          var c = $("[data-cart-count]"); if (c) { c.textContent = ""; c.setAttribute("data-zero", ""); }
        })
        .catch(function () { if (btn) { btn.disabled = false; btn.textContent = A.s.send; } fallback(); });
    };
  }
  /* /pro/: price request from a restaurant, hotel or wedding organiser, to the shop's Telegram */
  var qf = $("[data-quote-form]");
  if (qf) qf.onsubmit = function (e) {
    e.preventDefault();
    var f = new FormData(qf), btn = $("[data-q-send]", qf), body = { lang: A.lang };
    f.forEach(function (v, k) { body[k] = v; });
    if (btn) { btn.disabled = true; btn.textContent = A.s.sending; }
    var fail = function () {
      if (btn) { btn.disabled = false; btn.textContent = A.s.q_send; }
      alert(A.s.q_fail);
      var lines = [body.type, body.business + (body.city ? " — " + body.city : ""), body.contact, body.phone, body.freq,
                   body.date, body.guests, "", body.items].filter(function (x) { return x !== undefined && x !== null; });
      window.location.href = "https://wa.me/" + A.wa + "?text=" + encodeURIComponent(lines.join("\n"));
    };
    fetch(A.qapi, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (d) {
        if (!d || !d.ok) return fail();
        try { window.fbq("track", "Lead", { content_name: "pro-quote", content_category: body.type }); } catch (err) {}
        $$("input, select, textarea, button", qf).forEach(function (x) { x.disabled = true; });
        if (btn) btn.hidden = true;
        var done = $("[data-q-done]", qf); if (done) done.hidden = false;
      })
      .catch(fail);
  };

  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-copy]");
    if (!b) return;
    var done = function () { var old = A.s.copy; b.textContent = A.s.copied; setTimeout(function () { b.textContent = old; }, 1500); };
    if (navigator.clipboard) navigator.clipboard.writeText(b.getAttribute("data-copy")).then(done, function () {});
  });

  /* home: search and shelf filter */
  var grid = $("[data-grid]");
  if (grid) {
    var shelf = "", term = "";
    var apply = function () {
      var shown = 0;
      $$(".card", grid).forEach(function (c) {
        var ok = (!shelf || c.getAttribute("data-cat") === shelf) && (!term || norm(c.getAttribute("data-search")).indexOf(term) >= 0);
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
    if (sb) sb.oninput = function () { term = norm(sb.value); apply(); };
  }

  /* any WhatsApp link: tell the pixel someone reached out */
  $$("a.wa-link").forEach(function (a) {
    if (a.hasAttribute("data-order-one")) return;
    a.addEventListener("click", function () { try { window.fbq("track", "Contact"); } catch (e) {} });
  });

  render();
})();
