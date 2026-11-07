/* Almas website: cart, live prices, filters, WhatsApp order, Meta pixel events.
   Product ids ("p13") are the same in the page, the Meta catalogue feed and the pixel events, which is what lets
   catalogue ads match a visitor to the product they looked at. */
(function () {
  "use strict";
  var A = window.ALMAS;
  if (!A) return;
  var KEY = "almas-cart-v1";
  var cart = {};
  var showQty = null; // the product page's quantity display, refreshed when live prices arrive
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
      return A.lang === "ar" ? g + " غ" : g + " g";
    }
    return A.lang === "ar" ? fmt(q) + " كلغ" : fmt(q) + " kg";
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
    $$("[data-pack-total]").forEach(function (el) { el.textContent = money(packTotal(el.getAttribute("data-pack-total"))); });
    $$("[data-eur-pack]").forEach(function (el) { el.textContent = eur(packTotal(el.getAttribute("data-eur-pack"))); });
    $$("[data-eur-unit]").forEach(function (el) { var p = A.p[el.getAttribute("data-eur-unit")]; if (p) el.textContent = eur(p.price); });
    if (showQty) showQty();
  }
  /* an approximate euro price beside the dirham one, for customers in Europe (payment stays in dirhams) */
  function eur(mad) {
    if (!A.eur || !(mad > 0)) return "";
    var v = (Math.round(mad * A.eur * 100) / 100).toFixed(2);
    if (A.lang === "fr" || A.lang === "es") v = v.replace(".", ",");
    return A.lang === "ar" ? "≈ " + v + " يورو" : A.lang === "en" ? "≈ €" + v : "≈ " + v + " €";
  }
  function packQty(pid, q) { return A.p[pid] && A.p[pid].u !== "kg" ? Math.max(1, Math.round(q)) : q; }
  function packTotal(id) {
    var k = A.packs && A.packs[id];
    return k ? k.items.reduce(function (s, x) { return s + (A.p[x[0]] ? A.p[x[0]].price * packQty(x[0], x[1]) : 0); }, 0) : 0;
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
    if (q > 0 && typeof Sound !== "undefined") Sound.clink();
    cart[id] = Math.round(((cart[id] || 0) + q) * 100) / 100;
    if (cart[id] <= 0) delete cart[id];
    save(); render();
  }
  function render() {
    var c = $("[data-cart-count]");
    if (c) {
      var was = c.textContent;
      c.textContent = count() || "";
      if (count()) c.removeAttribute("data-zero"); else c.setAttribute("data-zero", "");
      if (was && was !== c.textContent) { c.classList.remove("bump"); void c.offsetWidth; c.classList.add("bump"); }
    }
    var list = $("[data-cart-lines]");
    if (!list) return;
    if (count()) { var dn = $("[data-done]"); if (dn) dn.hidden = true; list.hidden = false; } // a new cart after an order
    list.innerHTML = "";
    Object.keys(cart).forEach(function (id) {
      var p = A.p[id];
      if (!p) return;
      var li = document.createElement("li");
      var other = A.lang === "ar" ? "" : '<span class="ln-ar" lang="ar">' + esc(p.ar) + "</span><br>";
      var each = '<small class="ln-unit">' + money(p.price) + " " + esc(p.u === "kg" ? A.s.kg : A.s.piece) + "</small>";
      li.innerHTML = '<span><span class="ln-name">' + esc(p.n) + "</span><br>" + other + each + "</span>" +
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
    var te = $("[data-eur-total]");
    if (te) te.textContent = eur(total());
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
    INDEX[id] = norm([p.n, p.ar, p.t, p.fr, p.en, p.es, A.cats ? A.cats[p.c] : ""].join(" "));
    SKEL[id] = arSkel(p.ar + " " + p.t) + " | " + arToLat(p.ar + " " + p.t);
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
    var box = $("[data-qty-for]"), lab = $("[data-qty-label]"), qp = $("[data-qty-price]");
    var show = function () {
      if (lab) lab.textContent = amount(pid, q);
      if (qp) { qp.textContent = money(q * A.p[pid].price); qp.classList.remove("bump"); void qp.offsetWidth; qp.classList.add("bump"); }
      var qe = $("[data-eur-qty]"); if (qe) qe.textContent = eur(q * A.p[pid].price);
    };
    showQty = show;
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
      var line = amount(pid, q) + " " + (p.t || p.ar) + (p.t === p.n ? "" : " (" + p.n + ")") + " — " + money(q * p.price);
      one.href = "https://wa.me/" + A.wa + "?text=" + encodeURIComponent(A.s.one_msg + line);
      track("InitiateCheckout", [pid], q * p.price);
    };
    track("ViewContent", [pid], A.p[pid].price);
  }

  /* voice: the phone's own speech recognition, in the page's language (Moroccan Arabic on the Arabic pages, which
     also understands Darija); the words land in the box and the results follow as if typed. No support, no button. */
  var Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
  var VOICE_LANG = { ar: "ar-MA", fr: "fr-FR", en: "en-US", es: "es-ES" };
  if (Speech) {
    $$("[data-mic]").forEach(function (b) {
      var input = $(b.getAttribute("data-mic"));
      if (!input) return;
      b.hidden = false;
      var rec = null, placeholder = input.placeholder;
      var stop = function () { b.classList.remove("on"); input.placeholder = placeholder; rec = null; };
      b.onclick = function () {
        if (rec) { try { rec.stop(); } catch (e) {} return; }
        try { rec = new Speech(); } catch (e) { return; }
        rec.lang = VOICE_LANG[A.lang] || "ar-MA";
        rec.interimResults = true;
        rec.maxAlternatives = 1;
        rec.onresult = function (ev) {
          var text = "";
          for (var i = 0; i < ev.results.length; i++) text += ev.results[i][0].transcript;
          input.value = text.trim();
          input.dispatchEvent(new Event("input", { bubbles: true }));
          if (ev.results[ev.results.length - 1].isFinal && b.getAttribute("data-mic").indexOf("as-form") >= 0 && input.value) {
            var form = input.form; if (form && form.requestSubmit) form.requestSubmit();
          }
        };
        rec.onerror = function (ev) { if (ev.error === "not-allowed" || ev.error === "service-not-allowed") alert(A.s.mic_no); };
        rec.onend = stop;
        b.classList.add("on");
        input.value = "";
        input.placeholder = A.s.mic_on;
        try { rec.start(); } catch (e) { stop(); }
        try { window.fbq("trackCustom", "VoiceSearch"); } catch (e) {}
      };
    });
  }

  /* back to the catalogue as it was left: the browser's own back when the visitor came from the catalogue (same
     shelf, same scroll, instantly), the catalogue link otherwise (an ad or a shared link landed them here) */
  $$("[data-back]").forEach(function (a) {
    a.addEventListener("click", function (e) {
      var ref = document.referrer;
      if (ref && ref.indexOf(location.origin) === 0 && window.history.length > 1 && !/\/p\//.test(new URL(ref).pathname)) {
        e.preventDefault();
        window.history.back();
      }
    });
  });
  /* the catalogue remembers its shelf and scroll when a product is opened, for a back that lands where it left */
  var HKEY = "almas-home";
  if ($("[data-grid]")) {
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest(".card-link");
      if (!a) return;
      var on = $("[data-filter][aria-pressed=true]");
      try { sessionStorage.setItem(HKEY, JSON.stringify({ shelf: on ? on.getAttribute("data-filter") : "", y: window.pageYOffset, path: location.pathname })); } catch (err) {}
    });
    var nav = (performance.getEntriesByType && performance.getEntriesByType("navigation")[0]) || {};
    var saved = null;
    try { saved = JSON.parse(sessionStorage.getItem(HKEY) || "null"); } catch (err) {}
    if (saved && saved.path === location.pathname && (nav.type === "back_forward" || location.hash === "#products")) {
      setTimeout(function () {
        var chip = saved.shelf ? $('[data-filter="' + saved.shelf + '"]') : null;
        if (chip && chip.getAttribute("aria-pressed") !== "true") {
          $$("[data-filter]").forEach(function (x) { x.setAttribute("aria-pressed", x === chip ? "true" : "false"); });
          $$(".card", $("[data-grid]")).forEach(function (c) { c.hidden = c.getAttribute("data-cat") !== saved.shelf; });
        }
        window.scrollTo(0, saved.y);
      }, 0);
    }
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
    if (+f.get("repeat")) lines.push("🔁 " + A.s["rep_" + f.get("repeat")]);
    if (f.get("dest") && f.get("dest") !== "ma") lines.push("🇪🇺 " + (f.get("dest") === "eu_ship" ? "→ " + (f.get("country") || "Europe") : "↩ " + (f.get("collector") || "")));
    if (String(f.get("notes") || "").trim()) lines.push(s.o_notes + ": " + String(f.get("notes")).trim());
    lines.push("", s.o_items + ":");
    ids.forEach(function (id) {
      var p = A.p[id];
      lines.push("• " + amount(id, cart[id]) + " " + (p.t || p.ar) + (p.t === p.n ? "" : " (" + p.n + ")") + " — " + money(cart[id] * p.price));
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
                   pay: f.get("pay"), website: f.get("website"), dest: f.get("dest"), country: f.get("country"), collector: f.get("collector"), repeat: +f.get("repeat") || 0,
                   items: ids.map(function (id) { return { id: id, q: cart[id] }; }) };
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
          $("[data-done-body]").textContent = A.s.done_body.replace("{n}", d.number).replace("{t}", money(d.total)) +
            (+f.get("repeat") ? " " + A.s.rep_done.replace("{e}", A.s["rep_" + f.get("repeat")]) : "");
          var db = $("[data-done-bank]"); if (db) db.hidden = f.get("pay") !== "bank";
          $("[data-cart-form]").hidden = true;
          $("[data-cart-lines]").hidden = true;
          $("[data-done]").hidden = false;
          remember(d.number, d.total, f, ids);
          var ab = $("[data-app-box]"); if (ab) ab.hidden = isInstalled();
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
    var old = b.textContent;
    var done = function () { b.textContent = A.s.copied; setTimeout(function () { b.textContent = old; }, 1500); };
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
        toGridTop();
      };
    });
    /* after a shelf or a search changes the list, show its first products just under the sticky header and shelf
       bar, instead of leaving the visitor far below a now-shorter list */
    var toGridTop = function () {
      var wrapEl = $("[data-chips-wrap]"), head = $("header.top");
      // the bar is measured as it will be once inside the products: the shelf row alone, the search box tucked away
      var barH = wrapEl ? wrapEl.offsetHeight + 16 : 60;
      var y = grid.getBoundingClientRect().top + window.pageYOffset - (head ? head.offsetHeight : 0) - barH - 10;
      if (Math.abs(window.pageYOffset - y) > 4) window.scrollTo({ top: Math.max(0, y), behavior: reduce ? "auto" : "smooth" });
    };
    var sb = $("[data-search-box]");
    if (sb) sb.oninput = function () { term = norm(sb.value); apply(); if (window.pageYOffset > grid.offsetTop) toGridTop(); };
    // the shelf chip that was tapped scrolls into view inside its own row
    /* the shelf row: one line that slides; faded edges and (with a mouse) arrows where shelves are hidden; the
       mouse wheel slides it while there is more to see, then lets the page scroll as usual */
    var chipsWrap = $("[data-chips-wrap]"), chipsRow = $("[data-chips]"), tools = $("[data-tools]");
    var rtl = document.documentElement.dir === "rtl";
    var edges = function () {
      if (!chipsWrap) return;
      var r = chipsRow.getBoundingClientRect(), kids = chipsRow.children, lo = Infinity, hi = -Infinity;
      for (var i = 0; i < kids.length; i++) { var k = kids[i].getBoundingClientRect(); lo = Math.min(lo, k.left); hi = Math.max(hi, k.right); }
      chipsWrap.classList.toggle("more-left", lo < r.left - 2);
      chipsWrap.classList.toggle("more-right", hi > r.right + 2);
    };
    if (chipsWrap) {
      chipsRow.addEventListener("scroll", edges, { passive: true });
      window.addEventListener("resize", edges);
      window.addEventListener("load", edges);
      edges();
      $$("[data-chips-nav]", chipsWrap).forEach(function (b) {
        b.onclick = function () { chipsRow.scrollBy({ left: +b.getAttribute("data-chips-nav") * chipsRow.clientWidth * 0.7, behavior: reduce ? "auto" : "smooth" }); };
      });
      chipsRow.addEventListener("wheel", function (e) {
        if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
        var forward = e.deltaY > 0, toLeft = rtl ? forward : !forward;
        if (!chipsWrap.classList.contains(toLeft ? "more-left" : "more-right")) return; // at the end: the page scrolls
        e.preventDefault();
        chipsRow.scrollBy({ left: (rtl ? -1 : 1) * e.deltaY, behavior: "auto" });
      }, { passive: false });
    }
    // inside the products, the search box tucks away (the header's search button stays): only the shelf row is pinned
    var shop = $("#products"), compactTick = false;
    var compact = function () {
      compactTick = false;
      if (!tools || !shop) return;
      var sb2 = $("[data-search-box]");
      var inside = window.pageYOffset > shop.offsetTop + 60 && document.activeElement !== sb2 && !(sb2 && sb2.value);
      tools.classList.toggle("compact", inside);
    };
    window.addEventListener("scroll", function () { if (!compactTick) { compactTick = true; requestAnimationFrame(compact); } }, { passive: true });
    compact();
    // (it scrolls the row itself, never the page, so it cannot cancel the jump to the products)
    $$("[data-filter]").forEach(function (b) {
      b.addEventListener("click", function () {
        var row = b.parentElement, br = b.getBoundingClientRect(), rr = row.getBoundingClientRect();
        if (row.scrollWidth > row.clientWidth) {
          row.scrollBy({ left: (br.left + br.width / 2) - (rr.left + rr.width / 2), behavior: reduce ? "auto" : "smooth" });
        }
      });
    });
  }

  /* any WhatsApp link: tell the pixel someone reached out */
  $$("a.wa-link").forEach(function (a) {
    if (a.hasAttribute("data-order-one")) return;
    a.addEventListener("click", function () { try { window.fbq("track", "Contact"); } catch (e) {} });
  });

  /* smooth header: a shadow once the page scrolls; the back-to-top arrow after one screen */
  var topBar = $("header.top"), toTop = $("[data-to-top]"), ticking = false;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function onScroll() {
    ticking = false;
    var y = window.pageYOffset || document.documentElement.scrollTop;
    if (topBar) topBar.classList.toggle("scrolled", y > 8);
    if (toTop) toTop.hidden = y < window.innerHeight * 0.9;
  }
  window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();
  if (toTop) toTop.onclick = function () { window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" }); };

  /* star ratings from the shop's cloud: published reviews only */
  function starsHtml(avg) {
    var full = Math.round(avg * 2) / 2, out = "";
    for (var i = 1; i <= 5; i++) out += '<i class="' + (full >= i ? "on" : full >= i - 0.5 ? "half" : "") + '">★</i>';
    return '<span class="st" dir="ltr" aria-hidden="true">' + out + "</span>";
  }
  function countText(n) { return A.s.rv_count.replace("{n}", n); }
  if (A.cloud && $("[data-stars]")) {
    fetch(A.cloud + "/public/ratings").then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (!d) return;
      $$("[data-stars]").forEach(function (el) {
        var x = d[el.getAttribute("data-stars")];
        if (!x || !x.count) return;
        el.innerHTML = starsHtml(x.avg) + "<small>" + fmt(x.avg) + " · " + esc(countText(x.count)) + "</small>";
        el.setAttribute("aria-label", fmt(x.avg) + "/5, " + countText(x.count));
        el.hidden = false;
      });
    }).catch(function () {});
  }

  /* reviews under a product: the published ones, and the form to write one */
  var rv = $("[data-reviews]");
  if (rv && A.cloud) {
    var rid = rv.getAttribute("data-reviews");
    var dateFmt = function (iso) {
      try { return new Date(iso + "T12:00:00Z").toLocaleDateString(A.lang === "ar" ? "ar-MA" : A.lang, { year: "numeric", month: "long", day: "numeric" }); }
      catch (e) { return iso; }
    };
    fetch(A.cloud + "/public/reviews?product=" + encodeURIComponent(rid)).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (!d || !d.count) return;
      $("[data-rv-sum]", rv).innerHTML = starsHtml(d.avg) + " <b>" + fmt(d.avg) + "</b>/5 · " + esc(countText(d.count));
      $("[data-rv-list]", rv).innerHTML = d.reviews.map(function (x) {
        return '<li><div class="rv-top">' + starsHtml(x.rating) + "<b>" + esc(x.name) + "</b>" +
          (x.verified ? '<span class="rv-ok">✓ ' + esc(A.s.rv_verified) + "</span>" : "") +
          '<time datetime="' + esc(x.date) + '">' + esc(dateFmt(x.date)) + "</time></div><p>" + esc(x.text) + "</p></li>";
      }).join("");
    }).catch(function () {});
    var rf = $("[data-rv-form]", rv), ro = $("[data-rv-open]", rv);
    if (ro && rf) ro.onclick = function () { rf.hidden = false; ro.hidden = true; var t = $("textarea", rf); if (t) t.focus(); };
    if (rf) rf.onsubmit = function (e) {
      e.preventDefault();
      var f = new FormData(rf), btn = $("[data-rv-send]", rf);
      if (!f.get("rating") || String(f.get("text") || "").trim().length < 3) return alert(A.s.rv_need);
      var label = btn ? btn.textContent : "";
      if (btn) { btn.disabled = true; btn.textContent = A.s.sending; }
      var body = { lang: A.lang, product: rid, rating: +f.get("rating"), text: f.get("text"), name: f.get("name"),
                   order: f.get("order"), phone: f.get("phone"), website: f.get("website") };
      fetch(A.rapi, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        .then(function (r) { return r.json().catch(function () { return {}; }); })
        .then(function (d) {
          if (!d || !d.ok) throw new Error("review");
          $$("input, textarea, fieldset, button", rf).forEach(function (x) { x.disabled = true; });
          if (btn) btn.hidden = true;
          $("[data-rv-done]", rf).hidden = false;
        })
        .catch(function () { if (btn) { btn.disabled = false; btn.textContent = label; } alert(A.s.rv_fail); });
    };
  }

  /* sounds of the moment, never a background: a small brass bell when the chat opens, tea poured into a glass when
     Tajine answers, a spoon on a tea glass when something goes into the cart. Made in the browser (no file to
     download), quiet, and only right after the visitor's own tap. The speaker button in the chat mutes all three,
     and the choice is remembered. */
  var Sound = (function () {
    var AC = window.AudioContext || window.webkitAudioContext, ctx = null, out = null, SKEY = "almas-sound";
    function on() { try { return localStorage.getItem(SKEY) !== "off"; } catch (e) { return true; } }
    function ready() {
      if (!AC || !on()) return false;
      try {
        if (!ctx) { ctx = new AC(); out = ctx.createGain(); out.gain.value = 0.55; out.connect(ctx.destination); }
        if (ctx.state === "suspended") ctx.resume();
        return true;
      } catch (e) { return false; }
    }
    function tone(freq, start, dur, peak, type) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || "sine"; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(peak, start + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      o.connect(g); g.connect(out); o.start(start); o.stop(start + dur + 0.05);
    }
    // a small brass bell: a few inharmonic partials, the high ones dying first
    function bell() {
      if (!ready()) return;
      var t = ctx.currentTime + 0.02, f = 1046;
      [[1, 0.09, 1.6], [2.76, 0.04, 0.9], [5.4, 0.02, 0.5], [8.93, 0.01, 0.3]].forEach(function (p) { tone(f * p[0], t, p[2], p[1]); });
    }
    // a spoon touching a tea glass: two bright, very short pings
    function clink() {
      if (!ready()) return;
      var t = ctx.currentTime + 0.01;
      tone(2637, t, 0.35, 0.05); tone(4186, t, 0.22, 0.025); tone(3520, t + 0.09, 0.25, 0.022);
    }
    // tea poured from high into a glass: a stream of filtered noise whose pitch rises as the glass fills
    function pour() {
      if (!ready()) return;
      var t = ctx.currentTime + 0.02, dur = 1.15, len = Math.floor(ctx.sampleRate * dur);
      var buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      var src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), bp2 = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = buf;
      bp.type = "bandpass"; bp.Q.value = 6; bp.frequency.setValueAtTime(700, t); bp.frequency.exponentialRampToValueAtTime(1900, t + dur);
      bp2.type = "bandpass"; bp2.Q.value = 3; bp2.frequency.setValueAtTime(2600, t); bp2.frequency.exponentialRampToValueAtTime(4200, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.08);
      for (var k = 1; k < 10; k++) g.gain.setValueAtTime(0.1 + Math.random() * 0.08, t + k * 0.1); // the little gulps of a stream
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(bp); src.connect(bp2); bp.connect(g); bp2.connect(g); g.connect(out);
      src.start(t); src.stop(t + dur + 0.05);
    }
    return { bell: bell, clink: clink, pour: pour, on: on,
             toggle: function () { var v = !on(); try { localStorage.setItem(SKEY, v ? "on" : "off"); } catch (e) {} return v; } };
  })();

  /* Tajine, the assistant: answers from the shop's catalogue, suggests products that go straight into the cart */
  var as = $("[data-as]"), asOpen = $("[data-as-open]"), asBody = $("[data-as-body]"), asForm = $("[data-as-form]");
  var turns = [];
  function asShow(open) {
    if (!as) return;
    as.hidden = !open;
    if (asOpen) asOpen.classList.toggle("on", open);
    if (open) Sound.bell();
    if (open) { var i = $("input", asForm); if (i && window.innerWidth > 700) setTimeout(function () { i.focus(); }, 60); }
  }
  function bubble(cls, html) {
    var d = document.createElement("div");
    d.className = "msg " + cls; d.innerHTML = html;
    asBody.appendChild(d); asBody.scrollTop = asBody.scrollHeight;
    return d;
  }
  function productsHtml(ids) {
    ids = (ids || []).filter(function (id) { return A.p[id]; }).slice(0, 4);
    return ids.length ? '<ul class="as-items">' + ids.map(function (id) { return miniItem(id, "data-asadd"); }).join("") + "</ul>" : "";
  }
  function wire(el) { $$("[data-asadd]", el).forEach(function (b) { b.onclick = function () { addFrom(b, "data-asadd"); }; }); }
  function ask(q) {
    q = String(q || "").trim();
    if (!q || !asBody) return;
    var chips = $(".as-chips", asBody); if (chips) chips.remove();
    bubble("me", esc(q));
    turns.push({ role: "user", content: q });
    var wait = bubble("bot wait", esc(A.s.as_thinking));
    cooking(true);
    var fallback = function () {
      wait.remove();
      cooking(false);
      var el = bubble("bot", esc(A.s.as_error) + productsHtml(find(q).slice(0, 4)));
      wire(el);
      turns.pop();
    };
    fetch(A.aapi, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lang: A.lang, messages: turns }) })
      .then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (d) {
        if (!d || !d.ok || !d.reply) return fallback();
        wait.remove();
        cooking(false, true);
        turns.push({ role: "assistant", content: d.reply });
        var el = bubble("bot", esc(d.reply).replace(/\n/g, "<br>") + productsHtml(d.products) +
          (d.whatsapp ? '<a class="as-wa-in" href="https://wa.me/' + A.wa + "?text=" + encodeURIComponent(q) + '" rel="noopener">' + esc(A.s.as_wa) + "</a>" : ""));
        wire(el);
        try { window.fbq("trackCustom", "AssistantQuestion"); } catch (e) {}
      })
      .catch(fallback);
  }
  function cooking(on, served) {
    [as, asOpen].forEach(function (el) {
      if (!el) return;
      el.classList.toggle("cooking", on);
      if (served) { el.classList.add("served"); setTimeout(function () { el.classList.remove("served"); }, 2600); }
    });
    if (served) Sound.pour();
  }
  var snd = $("[data-as-sound]");
  if (snd) {
    snd.setAttribute("aria-pressed", Sound.on() ? "true" : "false");
    snd.onclick = function () {
      var on = Sound.toggle();
      snd.setAttribute("aria-pressed", on ? "true" : "false");
      if (on) Sound.bell();
    };
  }
  if (asOpen) asOpen.onclick = function () { asShow(as.hidden); };
  $$("[data-as-close]").forEach(function (b) { b.onclick = function () { asShow(false); }; });
  $$("[data-as-chip]").forEach(function (b) { b.onclick = function () { ask(b.textContent); }; });
  if (asForm) asForm.onsubmit = function (e) { e.preventDefault(); var i = $("input", asForm); ask(i.value); i.value = ""; };
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && as && !as.hidden) asShow(false); });

  /* packs: the whole box into the cart in one tap; the seasonal ones go first, with their badge, in their season */
  var today = new Date().toISOString().slice(0, 10), row = $("[data-pk-row]");
  if (row && A.packs) {
    $$("[data-pack]", row).forEach(function (li) {
      var k = A.packs[li.getAttribute("data-pack")];
      if (k && k.when && k.when.length === 2 && today >= k.when[0] && today <= k.when[1]) {
        var bd = $("[data-pk-badge]", li); if (bd) bd.hidden = false;
        row.insertBefore(li, row.firstChild);
      }
    });
  }
  $$("[data-add-pack]").forEach(function (b) {
    var label = b.textContent;
    b.onclick = function () {
      var k = A.packs[b.getAttribute("data-add-pack")];
      if (!k) return;
      k.items.forEach(function (x) { if (A.p[x[0]]) cart[x[0]] = Math.round(((cart[x[0]] || 0) + packQty(x[0], x[1])) * 100) / 100; });
      save(); render(); Sound.clink();
      track("AddToCart", k.items.map(function (x) { return x[0]; }), packTotal(b.getAttribute("data-add-pack")));
      b.textContent = "✓"; setTimeout(function () { b.textContent = label; }, 1200);
      setTimeout(openCart, 300);
    };
  });

  /* share a product with a friend: the phone's own share menu (WhatsApp, Instagram, Messenger, SMS...) where the
     browser has one; otherwise WhatsApp, Facebook and copy link */
  $$("[data-share-box]").forEach(function (box) {
    var btn = $("[data-share]", box), alt = $("[data-share-alt]", box);
    var data = { title: box.getAttribute("data-title"), text: box.getAttribute("data-text"), url: box.getAttribute("data-url") };
    btn.onclick = function () {
      try { window.fbq("trackCustom", "Share", { content_ids: [pid], content_type: "product" }); } catch (e) {}
      if (navigator.share && (!navigator.canShare || navigator.canShare(data))) {
        navigator.share(data).catch(function () { /* closed by the visitor */ });
      } else {
        alt.hidden = !alt.hidden;
      }
    };
  });

  /* delivery: in Morocco, or ordered from Europe (collected by a relative, or shipped once the shop confirms) */
  var destBox = $("[data-dest-eu]");
  $$("input[name=dest]").forEach(function (r) {
    r.onchange = function () {
      var v = orderForm ? orderForm.dest.value : "ma";
      if (!destBox) return;
      destBox.hidden = v === "ma";
      $("[data-dest-country]", destBox).hidden = v !== "eu_ship";
      $("[data-dest-who]", destBox).hidden = v !== "eu_pickup";
      if (orderForm.country) orderForm.country.required = v === "eu_ship";
    };
  });
  applyPrices();

  /* My orders: kept on this phone only (no account), the last 30 orders of the past 12 months, with the name, phone
     and address of the last one to fill the form next time. The status comes from the shop's back office, which
     answers only when the order number AND the phone match. */
  var OKEY = "almas-orders-v1", MEKEY = "almas-me-v1", YEAR = 365 * 864e5;
  function load(k, d) { try { return JSON.parse(localStorage.getItem(k) || "null") || d; } catch (e) { return d; } }
  function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
  function pastOrders() {
    var now = Date.now();
    return load(OKEY, []).filter(function (o) { return o && o.n && now - Date.parse(o.at) < YEAR; }).slice(0, 30);
  }
  function remember(number, totalPaid, f, ids) {
    var list = pastOrders();
    list.unshift({ n: number, at: new Date().toISOString(), total: totalPaid, pay: f.get("pay"), rep: +f.get("repeat") || 0,
                   items: ids.map(function (id) { return { id: id, q: cart[id] }; }) });
    store(OKEY, list.slice(0, 30));
    store(MEKEY, { name: f.get("name"), phone: f.get("phone"), address: f.get("address"), at: new Date().toISOString() });
    showOrdersBtn();
  }
  function me() { var m = load(MEKEY, null); return m && Date.now() - Date.parse(m.at) < YEAR ? m : null; }
  var orderForm = $("[data-order-form]");
  (function prefill() {
    var m = me(), note = $("[data-saved-me]");
    if (!m || !orderForm) return;
    ["name", "phone", "address"].forEach(function (k) { if (orderForm[k] && !orderForm[k].value) orderForm[k].value = m[k] || ""; });
    if (note) note.hidden = false;
    var c = $("[data-clear-me]");
    if (c) c.onclick = function () {
      ["name", "phone", "address"].forEach(function (k) { if (orderForm[k]) orderForm[k].value = ""; });
      try { localStorage.removeItem(MEKEY); } catch (e) {}
      note.hidden = true;
    };
  })();
  function showOrdersBtn() { var b = $("[data-open-orders]"); if (b) b.hidden = !pastOrders().length; }
  showOrdersBtn();
  function dateOf(iso) {
    try { return new Date(iso).toLocaleDateString(A.lang === "ar" ? "ar-MA" : A.lang, { day: "numeric", month: "short", year: "numeric" }); }
    catch (e) { return iso.slice(0, 10); }
  }
  function renderOrders(status) {
    var list = pastOrders(), ul = $("[data-mo-list]"), none = $("[data-mo-none]");
    if (!ul) return;
    none.hidden = list.length > 0;
    ul.innerHTML = list.map(function (o, i) {
      var st = status && status[o.n], chip = st ? '<span class="st-chip st-' + esc(st.status) + '">' + esc(A.s["st_" + st.status] || st.status) + "</span>" +
        (st.paid ? '<span class="st-chip st-paid">' + esc(A.s.st_paid) + "</span>" : "") : "";
      var items = o.items.filter(function (x) { return A.p[x.id]; }).map(function (x) { return esc(amount(x.id, x.q) + " " + A.p[x.id].n); }).join(" · ");
      var rep = o.rep ? '<span class="st-chip st-rep">🔁 ' + esc(A.s["rep_" + o.rep] || "") + "</span>" : "";
      return '<li><div class="mo-top"><b dir="ltr">' + esc(o.n) + "</b><span>" + esc(dateOf(o.at)) + "</span>" + chip + rep + "</div>" +
        '<p class="mo-items">' + items + '</p><div class="mo-bot"><b>' + money(o.total) + '</b><button type="button" class="btn ghost" data-again="' + i + '">' +
        esc(A.s.mo_again) + "</button></div></li>";
    }).join("");
    $$("[data-again]", ul).forEach(function (b) {
      b.onclick = function () {
        var o = list[+b.getAttribute("data-again")];
        o.items.forEach(function (x) { if (A.p[x.id]) cart[x.id] = x.q; });
        save(); render(); showCart(); Sound.clink();
        track("AddToCart", o.items.map(function (x) { return x.id; }), total());
      };
    });
  }
  function showOrders() {
    openCart();
    var ov = $("[data-orders]"), cv = $("[data-cart-view]"), tt = $("[data-drawer-title]"), ob = $("[data-open-orders]");
    if (!ov) return;
    ov.hidden = false; cv.hidden = true; if (ob) ob.hidden = true; if (tt) tt.textContent = A.s.my_orders;
    renderOrders(null);
    var m = me(), list = pastOrders();
    if (A.cloud && m && m.phone && list.length) {
      fetch(A.cloud + "/public/my-orders", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: m.phone, ids: list.map(function (o) { return o.n; }) }) })
        .then(function (r) { return r.ok ? r.json() : null; }).then(function (d) { if (d && d.orders) renderOrders(d.orders); }).catch(function () {});
    }
  }
  function showCart() {
    var ov = $("[data-orders]"), cv = $("[data-cart-view]"), tt = $("[data-drawer-title]");
    if (ov) ov.hidden = true; if (cv) cv.hidden = false; if (tt) tt.textContent = A.s.cart;
    showOrdersBtn();
  }
  $$("[data-open-orders], [data-open-orders-foot]").forEach(function (b) { b.onclick = showOrders; });
  $$("[data-back-cart]").forEach(function (b) { b.onclick = showCart; });
  $$("[data-open-cart]").forEach(function (b) { b.addEventListener("click", showCart); });
  var fg = $("[data-forget]");
  if (fg) fg.onclick = function () {
    try { localStorage.removeItem(OKEY); localStorage.removeItem(MEKEY); } catch (e) {}
    renderOrders(null); fg.textContent = A.s.mo_forgot; fg.disabled = true;
  };
  if (/[?&]orders=1/.test(location.search)) setTimeout(showOrders, 50);

  /* the app: installable from any page (footer link, after an order); the sheet offers itself once to a returning
     customer, never to a first-time visitor who came from an ad. "Not now" is remembered for 30 days. */
  var deferred = null, AKEY = "almas-app", SNOOZE = 30 * 864e5;
  function isInstalled() {
    return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true ||
      load(AKEY, {}).installed === true;
  }
  function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); }
  var sheetEl = $("[data-app-sheet]");
  function hideInstall() { $$("[data-install]").forEach(function (b) { b.hidden = true; }); if (sheetEl) sheetEl.hidden = true; }
  function openSheet(howOnly) {
    if (!sheetEl) return;
    var how = $("[data-app-how]", sheetEl), go = $("[data-app-go]", sheetEl);
    if (howOnly) {
      how.textContent = isIOS() ? how.getAttribute("data-ios") : how.getAttribute("data-manual");
      how.hidden = false; go.hidden = true;
      $$("[data-app-no]", sheetEl)[1].textContent = A.s.app_got;
    }
    sheetEl.hidden = false;
    requestAnimationFrame(function () { sheetEl.classList.add("in"); });
  }
  function closeSheet(snooze) {
    if (!sheetEl) return;
    sheetEl.classList.remove("in"); setTimeout(function () { sheetEl.hidden = true; }, 300);
    if (snooze) store(AKEY, { snoozed: Date.now() });
  }
  function install() {
    if (deferred) {
      deferred.prompt();
      deferred.userChoice.then(function (c) { if (c && c.outcome === "accepted") { store(AKEY, { installed: true }); hideInstall(); } closeSheet(false); });
      deferred = null;
    } else openSheet(true);
  }
  if (isInstalled()) hideInstall();
  $$("[data-install]").forEach(function (b) { b.onclick = install; });
  if (sheetEl) {
    $("[data-app-go]", sheetEl).onclick = install;
    $$("[data-app-no]", sheetEl).forEach(function (b) { b.onclick = function () { closeSheet(true); }; });
  }
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault(); deferred = e;
    var st = load(AKEY, {});
    if (!isInstalled() && pastOrders().length && !(st.snoozed && Date.now() - st.snoozed < SNOOZE)) {
      setTimeout(function () { if (deferred && (!drawer || drawer.hidden)) openSheet(false); }, 8000);
    }
  });
  window.addEventListener("appinstalled", function () { store(AKEY, { installed: true }); hideInstall(); });
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () { navigator.serviceWorker.register((A.root || "") + "/sw.js").catch(function () {}); });
  }

  render();
})();
