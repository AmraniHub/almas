# Almas website and Meta catalogue

Live at **https://almas-epices.vercel.app/** (Vercel project `almas-epices`, built from this repo by `vercel.json`): Arabic at the
root, French at `/fr/`, English at `/en/`, one page per product at `/p/<id>/`. GitHub Pages (`docs/`) keeps only the app's
privacy page (Play links to it) and a redirect to Vercel.

Everything comes from the shop's live catalogue, the same feed the Almas app reads
(`https://aronium-shop.amrani4online.workers.dev/app/catalog.json`, published by the Aronium agent on the till).
So the till, the app, the website and the ads show the same 128 products at the same prices.

| File | What |
|---|---|
| `site/config.json` | Every business fact the site uses. A blank value hides its line. |
| `site/build.py` | Writes `public/`: pages, feeds, sitemap. Vercel runs it on every push. Stdlib only. `--offline` uses the app's built-in catalogue. |
| `site/cards.py` | Draws the 800x800 product cards in `site/static/img/` (needs Playwright; run on the laptop). |
| `site/assets/` | `site.css`, `site.js` (cart, live prices, WhatsApp order, pixel events). |
| `.github/workflows/site.yml` | Asks Vercel for a fresh build daily (deploy hook secret). "Run workflow" rebuilds now. |

## What the site says, and where it came from

Only facts the app already states: shop in Ksar Sghir near Tangier, phone and WhatsApp +212 619 434 035, the
shop's Google Maps place, order on WhatsApp, "you pay on delivery or at the shop, delivery is agreed with you on
WhatsApp", restaurants/hotels/wedding venues by the kilo, bulk prices on WhatsApp. No opening hours, delivery
price, delivery zone or health claim: none of those has been confirmed. The order message is the app's layout
and carries the till's Arabic name on every line, so the shop reads website orders like app orders.

## Meta catalogue ads

The feed is ready; three things are the owner's, in Meta Business Suite:

1. **Commerce Manager > Catalogues > Add catalogue > E-commerce > Upload product info > Data feed > Scheduled feed**
   with `https://almas-epices.vercel.app/feed/meta.csv`, daily. Then add the two language overrides
   (Data sources > the feed > Settings > Add language and country version):
   `https://almas-epices.vercel.app/feed/meta-ar.csv` (Arabic) and `.../feed/meta-en.csv` (English).
2. **Pixel**: create one (Events Manager) or reuse one, put its id in `site/config.json` `meta_pixel_id`, push.
   The site then sends PageView, ViewContent (product pages), AddToCart, InitiateCheckout and Lead (WhatsApp order
   sent) with `content_ids` equal to the feed ids (`p13`...), which is what matches visitors to catalogue items.
   Connect the pixel to the catalogue (Catalogue > Settings > Event data sources). Every product page also carries
   `og:` and `product:retailer_item_id` tags and schema.org Product data, which Meta reads for matching.
   Before turning the pixel on, add a website section to `docs/privacy-policy.html` (it covers the app only).
3. **Ads**: Advantage+ catalogue ads (Sales objective, catalogue on), optimise for InitiateCheckout or Lead,
   since the sale itself happens on WhatsApp. A real Purchase event would need the shop to confirm orders
   (Conversions API), not built.

Prices in the feed are per kilo (title "(1 kg)") or per piece ("(l'unité)"), as the till sells them.
Every item is "in stock": the catalogue feed carries no stock level yet.

## Product images

Meta refuses items without an image and none of the products had a photo, so each has a drawn card (Arabic and
French name on its shelf colour). A real photo always wins: upload it from a phone on the cloud's `/app/photos`
page, and the next build uses it on the site and in the feed (`custom_label_1` says `photo` or `carte`, so ads can
favour photographed items). New products get the shelf card until `python site/cards.py` draws theirs; commit
`site/static/img` afterwards.

## A domain of its own

`almas.ma` belongs to someone else. With a domain: set `base_url`, point the DNS at Vercel,
add it to the Vercel project, and change the feed URL in Commerce Manager. A domain also lets Meta verify it
(`meta_domain_verification`), which a `vercel.app` address cannot.

## Loyalty points (built 2026-11-13)

Plain points, no token or crypto: they have no cash value, are never sold, and stay with the phone number the customer
orders with. The numbers are in `site/config.json` `points` and in `POINTS` at the top of the points section of
`cloud/worker.js` (a test fails if the two differ):

| Rule | Value | Why |
|---|---|---|
| Earn | 1 point per 10 MAD paid | 100 points = 10 MAD, so 1% back. The till's gross margin is ~46% (ginger 44%, saffron 14%, the thinnest), so a redeemed point costs ~2% of the profit on the sale that earned it |
| When | when the owner sets the order **delivered** in the back office (a card order must also be paid) | nothing is earned on orders that never happen; cancelled or deleted = gone |
| On what | the amount actually paid | the part paid with points earns nothing |
| Spend | steps of 100 points = 10 MAD, from 100 points | 100 points = 1,000 MAD of orders: about 10 average till baskets (94 MAD) or 3 website baskets |
| Cap | at most 10% of an order | even a saffron-only basket (14% margin) stays above cost |
| Expiry | 12 months after the last order that earned points | old balances do not pile up as a debt |
| Proof | the phone plus one of its own earlier order numbers (kept by the browser, as for My orders) | knowing someone's phone is not enough to see or spend their points |

Where it shows: the cart ("this order earns N points"; "use 100 of your 160 points: -10 MAD" with the amount to pay),
the confirmation, the WhatsApp text, My orders (balance, points on the way, expiry, the rules, and a "show my points" form: phone + one order number, for an order placed in the app, in another browser or on another phone). The Android app is the
website in a WebView, so it has all of it with no app release. The shop's Telegram message names the points and the
amount to collect; the back office shows them on the order, on the customer file (with a form to add or remove points,
a note required) and on the overview (points outstanding, with their MAD value).

How a points order flows: `/api/order` asks the back office (`/ingest/points-redeem`) how many points this order may
spend, which holds them under the new order number in one SQL statement (two orders at once cannot spend the same
points); it takes the discount off the total (and off the Stripe page, through a one-off coupon), then tells the shop.
If the shop cannot be told, the hold is released; a hold whose order never reached the back office goes back after a
day. To switch points off, set `"mad_per_point": 0` in `site/config.json` (the site hides them; balances stay).

Deploy order: back office first (`python cloud/deploy.py`, it adds the `points` table), then the site (push).
Tests: `node --test cloud/tests/points.test.mjs` (10), `node cloud/tests/sabotage.mjs` (28 deliberate breakages, all
caught), and in the browser, the whole chain with nothing sent anywhere: `python site/build.py`, then
`node site/tests/e2e-server.mjs 8792` and `python site/tests/points_e2e.py` (39 checks, Arabic 360 px, French 412 px,
Arabic with text at 130%).

### Two programmes, and the owner's control (2026-11-14)

A customer file marked **Pro** (a business quote request does this, or the owner sets it on the file) uses the
**business programme**: 1 point per 20 MAD, 100 points = 10 MAD (0.5% back, because business prices are lower and
baskets bigger), from 200 points, at most 5% of an order, 12 months. Everyone else uses the home programme above.
Standing orders are mostly businesses, and each run is a normal order, so it earns when delivered.

The **Points** tab of the back office holds both rule sets (with an on/off switch each, the defaults, and a live
reading of what they cost against the till's 46% margin; a rate that gives back more than 6% of the profit, or a cap
above half the margin, is flagged) and lists every customer with points, largest first, with search and a filter per
programme. The rules are stored in D1 (`settings` key `points_rules`) and served at `/public/points-rules`; the
website reads them live (kept 10 minutes per tab), so a change shows on the site and in the app within minutes,
with no rebuild. Off = nothing new earned or spent in that programme; balances stay. `site/config.json` `points`
is only the fallback the pages are built with.

The owner's one-tap WhatsApp messages carry the points: the order confirmation names the points the order will
earn, a **"delivered + points"** button appears once the order is delivered (points earned, new balance, what it is
worth), and the reorder reminder names the customer's points and their value. Nothing is sent on its own. A
returning customer sees a banner under the header of the home and product pages ("You have N loyalty points =
X MAD off", hidden at 0), and the business page names the business programme.

Tests added: `node --test cloud/tests/points.test.mjs` (now 15), 3 more sabotages (31 in all),
`python site/tests/admin_points_e2e.py` (the WhatsApp texts, 9 checks) and `python site/tests/rules_e2e.py` (the
Points tab drives the site; a restaurant on the business rate; 11 checks), with the same e2e server.

## Phones with a large font (fixed 2026-11-13)

A 360 px phone with a large system font or display size lays pages out at 260-300 CSS px. The header needed ~300 px,
the page scrolled sideways, and Chrome then sized the fixed cart drawer to the wider page, so it stopped ~30 px short
of the screen edge (owner's screenshot of `/p/p73/`). The narrow-screen block at the end of `site.css` shrinks the
header (the "pro" link hides below 300 px; it stays in the footer), clips any sideways overflow, and anchors the drawer
to both edges. `python site/tests/overflow.py` checks 7 pages at 240-430 px and with the text at 130% and 160%.

## Back office (cloud/)

Orders, customers (CRM), B2B quotes, reviews and product sales live in a free Cloudflare Worker + D1,
`almas-shop`: https://almas-shop.amrani4online.workers.dev/admin (login key in `%USERPROFILE%\keys\almas-admin.txt`).
The Vercel functions copy every order, quote, card payment and review there (env `ALMAS_CLOUD_URL`,
`ALMAS_CLOUD_SECRET`); Telegram stays the instant alert. A review shows on the site only once published in the
admin. Redeploy with `python cloud/deploy.py` (keeps secrets; `--rotate` logs everyone out and needs the Vercel
secret updated). Tests: `node --test cloud/tests/worker.test.mjs`, live: `python cloud/live-test.py`.

## Google Sheet copy of orders (connected 2026-11-08)

Every new order, business request, standing order and review is also appended to the Google Sheet
**"Almas – orders"** in the contact@morasset.com Drive
(https://docs.google.com/spreadsheets/d/1egc2DBPbbxvki7PBgSPefxedjYPOSdBkGkAYecLe-5g/edit), one tab per kind.
The sheet's bound Apps Script ("Untitled project", web app "Anyone", runs as contact@morasset.com) checks a shop
secret that the back office generates. The Worker posts after replying (waitUntil), so a slow or missing sheet never
blocks an order; D1 stays the record. Reconnect, test, backfill or disconnect in the back office: tab **Google Sheet**.
If the script is redeployed as a NEW deployment its URL changes: paste the new one there.
