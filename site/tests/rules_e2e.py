"""The owner's control over points: the Points tab changes the rules, the website follows; businesses get their own.

    python site/build.py ; node site/tests/e2e-server.mjs 8792
    python site/tests/rules_e2e.py [shots_dir]

1. The Points tab shows both programmes; the owner sets home cooks to 1 point per 5 MAD and saves.
2. A visitor's cart then promises points at the new rate; switched off, the cart says nothing about points.
3. A restaurant (customer file set to Pro) gets the business rules: its cart counts 1 point per 20 MAD.
4. The business page names the business programme. The list shows the restaurant under Businesses.
Ends with the defaults restored.
"""
import json
import random
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


def post(path, body):
    req = urllib.request.Request(BASE + path, data=json.dumps(body).encode(), headers={"content-type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def shot(page, name, full=False):
    if SHOTS:
        SHOTS.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(SHOTS / f"{name}.png"), full_page=full)


with sync_playwright() as p:
    b = p.chromium.launch()
    adm = b.new_context(viewport={"width": 1200, "height": 900}).new_page()
    errors = []
    adm.on("pageerror", lambda e: errors.append(str(e)))
    adm.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    adm.goto(BASE + "/admin", wait_until="networkidle")
    adm.fill("input", "e2e-admin")
    adm.keyboard.press("Enter")
    adm.wait_for_timeout(1200)

    def set_rules(kind, values):
        adm.goto(BASE + "/admin#points", wait_until="networkidle")
        adm.wait_for_selector(f"#pts-{kind}-mad_per_point", timeout=15000)
        for k, v in values.items():
            if k == "enabled":
                adm.set_checked(f"#pts-on-{kind}", v)
            else:
                adm.fill(f"#pts-{kind}-{k}", str(v))
        adm.click("button:has-text('Save both programmes')")
        adm.wait_for_timeout(1500)

    def site(phone=None, ids=None, path="/p/p73/", kg=2):
        ctx = b.new_context(viewport={"width": 360, "height": 860}, device_scale_factor=2, is_mobile=True, has_touch=True)
        ctx.route(CLOUD + "/**", lambda route: route.fulfill(response=route.fetch(url=BASE + "/cloud" + route.request.url[len(CLOUD):])))
        init = "localStorage.setItem('almas-cart-v1', JSON.stringify({p73: %d}));" % kg
        if phone:
            init += "localStorage.setItem('almas-me-v1', JSON.stringify({name: 'Test', phone: '%s', address: '', at: new Date().toISOString()}));" % phone
            init += "localStorage.setItem('almas-orders-v1', JSON.stringify(%s.map(n => ({n, at: new Date().toISOString(), total: 0, items: []}))));" % json.dumps(ids)
        ctx.add_init_script("try{ if (!sessionStorage.getItem('seeded')) { %s sessionStorage.setItem('seeded', '1'); } }catch(e){}" % init)
        pg = ctx.new_page()
        pg.goto(BASE + path, wait_until="load", timeout=60000)
        pg.wait_for_timeout(2500)
        return ctx, pg

    def cart_earn(pg):
        pg.evaluate("document.querySelector('[data-open-cart]').click()")
        pg.wait_for_timeout(1000)
        return pg.inner_text("[data-pts-earn]") if pg.is_visible("[data-pts]") else ""

    # 1. the Points tab, and a new home-cook rate
    adm.goto(BASE + "/admin#points", wait_until="networkidle")
    adm.wait_for_selector("#pts-home-mad_per_point", timeout=15000)
    check(adm.input_value("#pts-pro-mad_per_point") == "20", "the Points tab shows the business programme (1 point per 20 MAD)")
    adm.fill("#pts-home-mad_per_point", "1")
    adm.wait_for_timeout(200)
    check("High for the shop" in adm.inner_text("body"), "a too generous rate (10% back) is flagged against the margins")
    set_rules("home", {"mad_per_point": 5})
    rules = json.loads(urllib.request.urlopen(BASE + "/cloud/public/points-rules").read().decode())
    check(rules["home"]["mad_per_point"] == 5, "saved: the website's rules now say 1 point per 5 MAD")

    # 2. the website follows (a 400 MAD cart: 80 points at 5 MAD, 40 at 10)
    ctx, pg = site()
    earn = cart_earn(pg)
    check("80" in earn, f"the cart promises points at the new rate ({earn.strip()})")
    shot(pg, "rules-cart-new-rate")
    ctx.close()
    set_rules("home", {"enabled": False})
    ctx, pg = site()
    check(cart_earn(pg) == "", "switched off: the cart says nothing about points")
    ctx.close()
    set_rules("home", {"enabled": True, "mad_per_point": 10})

    # 3. a restaurant on the business programme
    tel = "06%08d" % random.randint(10000000, 99999999)  # a new restaurant each run
    pn = "212" + tel[1:]
    o = post("/api/order/", {"name": "Restaurant Nour", "phone": tel, "items": [{"id": "p73", "q": 10}]})
    adm.goto(BASE + "/admin#customer/" + pn, wait_until="networkidle")
    adm.wait_for_selector("select", timeout=15000)
    adm.select_option("select", "pro")
    adm.locator(".card:has(h2:text-is('Customer file')) button:text-is('Save')").click()
    adm.wait_for_timeout(800)
    post("/test/status", {"id": o["number"], "status": "delivered"})
    pts = json.loads(urllib.request.urlopen(BASE + "/test/points?phone=" + pn).read().decode())["points"]
    check(pts["kind"] == "pro" and pts["balance"] == int(o["total"] // 20), f"the restaurant earned on the business rate: {pts['balance']} points for {o['total']} MAD")
    ctx, pg = site(tel, [o["number"]])
    earn = cart_earn(pg)
    check("20" in earn and "40" not in earn, f"the restaurant's cart counts 1 point per 20 MAD ({earn.strip()})")
    pg.click("[data-pts] [data-pts-how] summary")
    how = pg.inner_text("[data-pts] [data-pts-how]")
    check("20" in how and "5%" in how, "its 'How do points work?' shows the business rules")
    pg.eval_on_selector("[data-pts]", "e => e.scrollIntoView({block: 'center'})")
    shot(pg, "rules-cart-business")
    ctx.close()

    # 4. the business page and the list
    ctx, pg = site(path="/pro/")
    pg.wait_for_selector("[data-pts-pro]:not([hidden])", timeout=15000)
    line = pg.inner_text("[data-pts-pro]")
    check("20" in line, f"the business page names the business programme ({line.strip()})")
    pg.eval_on_selector("[data-pts-pro]", "e => e.scrollIntoView({block: 'center'})")
    shot(pg, "rules-pro-page")
    ctx.close()
    adm.goto(BASE + "/admin#points?kind=pro", wait_until="networkidle")
    adm.wait_for_selector("text=Customers with points", timeout=15000)
    adm.wait_for_timeout(500)
    check("Restaurant Nour" in adm.inner_text("body"), "the Points tab lists the restaurant under Businesses")
    adm.goto(BASE + "/admin#points", wait_until="networkidle")
    adm.wait_for_timeout(1200)
    shot(adm, "rules-points-tab", full=True)
    check(not errors, f"no errors in the back office {errors}")
    b.close()
print("FAILED: " + "; ".join(fails) if fails else "ALL OK")
sys.exit(1 if fails else 0)
