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
