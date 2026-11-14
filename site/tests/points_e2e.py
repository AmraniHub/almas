"""Browser test of loyalty points, start to finish, on the laptop (nothing reaches the shop, Telegram or Stripe).

    python site/build.py
    node site/tests/e2e-server.mjs 8792          (in another terminal)
    python site/tests/points_e2e.py [shots_dir]

A phone places a first order (it shows "this order earns N points"), the owner marks it delivered, then a second
order spends the points (the cart offers them, the total drops, the shop's message names the discount), and
My orders shows the balance. Repeated in French on a large phone and in Arabic with the text at 130%.
"""
import json
import sys
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8792"
CLOUD = "https://almas-shop.amrani4online.workers.dev"
SHOTS = Path(sys.argv[1]) if len(sys.argv) > 1 else None
fails = []


def check(ok, what):
    print(("ok   " if ok else "FAIL ") + what)
    if not ok:
        fails.append(what)


def get(path, body=None):
    req = urllib.request.Request(BASE + path, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"content-type": "application/json"}, method="POST" if body is not None else "GET")
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def shot(page, name):
    if SHOTS:
        SHOTS.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(SHOTS / f"{name}.png"))


def run(p, lang, width, phone, zoom=1.0):
    prefix = "" if lang == "ar" else "/" + lang
    tag = f"{lang}-{width}" + (f"-z{zoom}" if zoom != 1 else "")
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": width, "height": 860}, device_scale_factor=2, is_mobile=True, has_touch=True, locale=lang)
    ctx.route(CLOUD + "/**", lambda route: route.fulfill(response=route.fetch(url=BASE + "/cloud" + route.request.url[len(CLOUD):])))
    page = ctx.new_page()

    def fill_cart(target):
        page.goto(BASE + prefix + "/", wait_until="networkidle")
        page.evaluate("""t => { const id = 'p73', pr = window.ALMAS.p[id].price, q = Math.ceil(t / pr);
            localStorage.setItem('almas-cart-v1', JSON.stringify({[id]: q})); }""", target)
        page.goto(BASE + prefix + "/p/p73/", wait_until="networkidle")
        if zoom != 1:
            page.evaluate("z => { document.documentElement.style.zoom = z; }", str(zoom))
        page.click("[data-open-cart]")
        page.wait_for_timeout(700)

    def send(name):
        page.fill("[data-order-form] input[name=name]", name)
        page.fill("[data-order-form] input[name=phone]", phone)
        page.click("[data-send]")
        page.wait_for_selector("[data-done]:not([hidden])", timeout=30000)
        page.wait_for_timeout(300)
        return page.inner_text("[data-done-body]")

    # 1. first order: nothing to spend yet, it earns points
    fill_cart(1500)
    earn = page.inner_text("[data-pts-earn]")
    check(page.is_hidden("[data-pts-use]"), f"{tag}: a new customer is not offered points to spend")
    check(page.is_hidden("[data-pts-banner]"), f"{tag}: a new customer sees no points banner")
    check(any(ch.isdigit() for ch in earn), f"{tag}: the cart says what this order earns ({earn.strip()})")
    page.eval_on_selector("[data-order-form] input[name=name]", "e => e.scrollIntoView({block: 'start'})")
    shot(page, f"{tag}-1-cart-first-order")
    done = send("Test points " + tag)
    first = page.evaluate("JSON.parse(localStorage.getItem('almas-orders-v1'))[0]")
    check(first["total"] >= 1500, f"{tag}: first order placed, {first['n']} = {first['total']} MAD")
    shot(page, f"{tag}-2-first-order-sent")

    # 2. the owner marks it delivered: the points arrive
    pn = "212" + phone[1:]
    bal0 = get("/test/points?phone=" + pn)["points"]["balance"]  # 0 on a fresh server; a rerun keeps the last run's
    get("/test/status", {"id": first["n"], "status": "delivered"})
    bal = get("/test/points?phone=" + pn)["points"]["balance"]
    check(bal - bal0 == int(first["total"] // 10), f"{tag}: delivered = +{bal - bal0} points in the back office (balance {bal})")

    # 2b. back on the site, the home page greets the returning customer with the balance
    page.goto(BASE + prefix + "/", wait_until="networkidle")
    if zoom != 1:
        page.evaluate("z => { document.documentElement.style.zoom = z; }", str(zoom))
    page.wait_for_selector("[data-pts-banner]:not([hidden])", timeout=15000)
    banner = page.inner_text("[data-pts-banner]")
    check(str(bal) in banner, f"{tag}: the home page banner shows the balance ({banner.strip()})")
    shot(page, f"{tag}-2b-home-banner")

    # 3. second order: the cart offers the points, the total drops, the shop is told
    fill_cart(400)
    page.wait_for_selector("[data-pts-use]:not([hidden])", timeout=15000)
    use = page.inner_text("[data-pts-use]")
    due = page.inner_text("[data-pts-due-v]")
    check(bool(use.strip()) and bool(due.strip()), f"{tag}: the cart offers points ({use.strip()}) and shows what is left to pay ({due.strip()})")
    page.eval_on_selector("[data-pts]", "e => e.scrollIntoView({block: 'center'})")
    shot(page, f"{tag}-3-cart-spend-points")
    done = send("Test points " + tag)
    second = page.evaluate("JSON.parse(localStorage.getItem('almas-orders-v1'))[0]")
    tg = get("/test/telegram")[-1]
    check("نقاط الوفاء" in tg and "المبلغ المطلوب" in tg, f"{tag}: the shop's message names the points and the amount to collect")
    after = get("/test/points?phone=" + pn)
    spent = [h for h in after["points"]["history"] if h["kind"] == "redeem" and h["order_id"] == second["n"]]
    check(len(spent) == 1 and after["points"]["balance"] == bal + spent[0]["points"],
          f"{tag}: {-spent[0]['points'] if spent else 0} points held for {second['n']}, balance {after['points']['balance']}")
    check(abs(second["total"] - (400 - (spent[0]["mad"] if spent else 0))) < 101, f"{tag}: the order total is after the discount ({second['total']} MAD)")
    shot(page, f"{tag}-4-points-spent")

    # 4. My orders shows the balance
    page.click("[data-open-orders]")
    page.wait_for_selector("[data-pts-card]:not([hidden])", timeout=15000)
    check(str(after["points"]["balance"]) in page.inner_text("[data-pts-bal]"), f"{tag}: My orders shows the balance")
    page.click(".pts-card .pts-how summary")
    shot(page, f"{tag}-5-my-orders-points")

    # nothing on the page is wider than the screen
    sw = page.evaluate("document.documentElement.scrollWidth")
    check(sw <= width, f"{tag}: page width {sw} <= {width}")

    # 5. another device (the app and the browser keep separate lists): a wrong number shows nothing, the right one the points
    ctx2 = b.new_context(viewport={"width": width, "height": 860}, device_scale_factor=2, is_mobile=True, has_touch=True, locale=lang)
    ctx2.route(CLOUD + "/**", lambda route: route.fulfill(response=route.fetch(url=BASE + "/cloud" + route.request.url[len(CLOUD):])))
    other = ctx2.new_page()
    other.goto(BASE + prefix + "/?orders=1", wait_until="networkidle")
    other.wait_for_selector("[data-pts-find]:not([hidden])", timeout=15000)
    other.fill("[data-pts-find] input[name=phone]", phone)
    other.fill("[data-pts-find] input[name=order]", "AL-000000-0000")
    other.click("[data-pts-find] button")
    other.wait_for_selector("[data-pts-find-msg]:not([hidden])", timeout=15000)
    check(other.is_hidden("[data-pts-card]"), f"{tag}: another device with a wrong order number sees no points")
    other.fill("[data-pts-find] input[name=order]", first["n"].lower())
    other.click("[data-pts-find] button")
    other.wait_for_selector("[data-pts-card]:not([hidden])", timeout=15000)
    check(str(after["points"]["balance"]) in other.inner_text("[data-pts-bal]"), f"{tag}: another device sees the points after phone + order number")
    check(other.evaluate("document.querySelectorAll('[data-mo-list] li').length") == 0, f"{tag}: the found number is not listed as an order on that device")
    shot(other, f"{tag}-6-other-device")
    b.close()


with sync_playwright() as p:
    run(p, "ar", 360, "0611220001")
    run(p, "fr", 412, "0611220002")
    run(p, "ar", 360, "0611220003", zoom=1.3)
print("FAILED: " + "; ".join(fails) if fails else "ALL OK")
sys.exit(1 if fails else 0)
