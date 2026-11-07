# Almas website: ideas for later

Saved 2026-11-07, not built. Today the site reads the catalogue that was published from the laptop on 2026-10-27
(`Aronium/laptop/almas-app.py catalog`, copied from the app's built-in list). Re-run that command after a price
change at the till, then push anything (or "Run workflow") so Vercel rebuilds.

## Connected to the till (Aronium)

Each of these needs the shop PC updated, so it waits for a moment the owner chooses.

1. **Live catalogue from the till.** The shop PC runs an older `cloud.py` without the app feed; installing
   `app_feed.py`, `app_catalog.json` and the current `cloud.py` makes the till publish its own names and prices
   every few minutes, so the laptop step above disappears.
2. **Stock.** Products at zero shown "épuisé" and set "out of stock" in the Meta feed so their ads pause. The
   till's stock is not reliable yet (ginger read -2.275 kg while selling), so the rule should be "zero stock AND
   no sale for several days", or an owner switch in the shop bot.
3. **Instant sync.** A real change (price, name, stock) asks Vercel for one rebuild, at most every few minutes.
   Each build is one Vercel build; the owner preferred no automatic builds for now.
4. **Web orders on the till.** Each website order appears as a parked bill with its AL- number, ready to weigh
   and print; the sale is then recorded against the order.
5. **Photos through the shop bot.** A photo sent to @Almasssdbot with a product name becomes that product's
   photo on the site, the app and the Meta catalogue.
6. **Margin-aware ads.** The till knows buy prices (profit.py): tag high- and low-margin items in the feed so
   ad sets push the profitable ones; never advertise below cost.
7. **Real Purchase events for Meta.** When a web order is paid or rung up, send Purchase with the true value
   (Conversions API) so catalogue ads optimise for sales.

## Orders and customers

8. **Telegram buttons on each order**: confirm, out for delivery, out of stock, with the customer's WhatsApp
   reply prepared; web orders counted in the nightly report.
9. **Reorder reminders** for restaurants, hotels and wedding organisers after their usual interval, with their
   usual basket.
10. **Own Stripe account "Almas"**, then a Stripe webhook in place of the thank-you-page check.

## Europe (diaspora)

11. Prices in euros next to dirhams on the French and English pages (Stripe already charges European cards in MAD).
12. "Collected at the shop by a relative" (name and phone of who collects) and gift orders for family in Morocco.
13. Shipping to Europe through a carrier (Amana, DHL) with weight-based rates. Dried spices generally go; henna
    and cosmetics follow EU cosmetics rules: check before selling them abroad.
14. Ads aimed at the Moroccan diaspora in French and Arabic, on the same catalogue.

## Shop

15. Ramadan and Eid collections and bundles (harira spices, ras el hanout kits) built from the best sellers.
16. Its own domain (almas.ma belongs to someone else), which also lets Meta verify the domain.

## Prices from the till (when the shop is closed — do not touch the shop PC while it is open)

17. **The till publishes its prices itself.** The website already re-reads every price in the visitor's browser
    from `aronium-shop.amrani4online.workers.dev/app/catalog.json`, and `/api/order` prices each order from the
    same file, so a price changed there changes on the site at once, with no rebuild. Today that file was
    published from the laptop on 2026-10-27; the till's `cloud.py` predates the `app_feed` push. Install the
    newer `cloud.py` on the shop PC (Aronium closed, backup first) so a price changed in Aronium reaches the
    site within minutes. New products still need a rebuild (one push) to get their own page.
