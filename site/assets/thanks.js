/* /merci/: Stripe sends the customer back here with ?session_id=; the server asks Stripe whether it is paid. */
(function () {
  "use strict";
  var el = document.querySelector("[data-ty]");
  var id = new URLSearchParams(location.search).get("session_id") || "";
  if (!el) return;
  function money(n) { var r = Math.round(n * 100) / 100; return window.TYM.replace("{}", r % 1 ? r.toFixed(2) : String(r)); }
  if (!/^cs_/.test(id)) { el.textContent = window.TY.ty_unpaid; return; }
  fetch("/api/paid/?session_id=" + encodeURIComponent(id), { cache: "no-store" })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (d && d.paid) {
        el.textContent = window.TY.ty_paid.replace("{n}", d.number).replace("{t}", money(d.total));
        try { window.fbq("track", "Purchase", { value: d.total, currency: "MAD" }); } catch (e) {}
        try { localStorage.removeItem("almas-cart-v1"); } catch (e) {}
        var wa = document.querySelector("[data-ty-wa]");
        if (wa) wa.href += "?text=" + encodeURIComponent(d.number);
      } else {
        el.textContent = window.TY.ty_unpaid;
      }
    })
    .catch(function () { el.textContent = window.TY.ty_unpaid; });
})();
