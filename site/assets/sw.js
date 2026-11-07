/* Almas service worker. It exists so the site can be installed as an app (Chrome offers "Install" only to a site
   with a worker that handles fetch) and so the installed app opens to something when the signal drops.

   Prices must never come from a cache: they live in the pages and in the till's catalog.json. So:
   - pages: network first; the last copy seen is used only when there is no network at all;
   - catalog.json, /api/ and the back office: network only, never stored;
   - pictures, styles, scripts, fonts: served from the cache at once and refreshed behind the scenes. */
var VERSION = "almas-v1";
var STATIC = VERSION + "-static", PAGES = VERSION + "-pages";

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(PAGES).then(function (c) { return c.addAll(["/"]).catch(function () {}); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf(VERSION) !== 0; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function staticAsset(url) {
  if (url.origin === self.location.origin) return /^\/(assets|img|store)\//.test(url.pathname);
  if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) return true;
  return /aronium-shop\..*workers\.dev$/.test(url.hostname) && url.pathname.indexOf("/app/img/") === 0;
}

function offlinePage() {
  var html = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Almas</title><body style="font:16px/1.6 system-ui,sans-serif;background:#f7f0e7;color:#211a16;display:grid;place-items:center;min-height:90vh;text-align:center;padding:16px">' +
    '<div><img src="/img/logo-192.png" width="96" height="96" alt=""><h1 style="font-size:1.3rem">Almas</h1>' +
    '<p dir="rtl">لا يوجد اتصال بالإنترنت الآن. حاول مرة أخرى بعد قليل.</p>' +
    '<p>Pas de connexion pour le moment. Réessayez dans un instant.</p>' +
    '<p><button onclick="location.reload()" style="font:inherit;padding:10px 22px;border-radius:999px;border:0;background:#211a16;color:#fff">↻</button></p></div>';
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin === self.location.origin && url.pathname.indexOf("/api/") === 0) return;
  if (/catalog\.json$/.test(url.pathname)) return; // live prices: straight to the network

  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then(function (res) {
      if (res.ok) { var copy = res.clone(); caches.open(PAGES).then(function (c) { c.put(req, copy); }); }
      return res;
    }).catch(function () {
      return caches.match(req).then(function (hit) { return hit || caches.match("/") ; }).then(function (hit) { return hit || offlinePage(); });
    }));
    return;
  }

  if (staticAsset(url)) {
    e.respondWith(caches.open(STATIC).then(function (c) {
      return c.match(req).then(function (hit) {
        var net = fetch(req).then(function (res) {
          if (res && (res.ok || res.type === "opaque")) c.put(req, res.clone());
          return res;
        }).catch(function () { return hit; });
        return hit || net;
      });
    }));
  }
});
