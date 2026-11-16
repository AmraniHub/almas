"""Invite a friend, start to finish in the browser (local e2e server: nothing reaches the shop, Telegram or Stripe).

    python site/build.py ; node site/tests/e2e-server.mjs 8792
    python site/tests/referral_e2e.py [shots_dir]

1. A customer orders, the owner delivers: My orders now shows their invite link (Share, Copy).
2. A friend opens the link on another phone: the cart says "invited by a friend"; the order carries the code.
3. The owner delivers the friend's order: both get their points; the order page names the inviter and offers the
   WhatsApp thank-you; the Points tab lists the invitation as rewarded.
4. The inviter opening their own link on their own phone sends no code.
"""
import json
import random
import sys
import urllib.parse
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
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def shot(page, name, full=False):
    if SHOTS:
        SHOTS.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(SHOTS / f"{name}.png"), full_page=full)


def phone():
    return "06%08d" % random.randint(10000000, 99999999)


with sync_playwright() as p:
    b = p.chromium.launch()

    def device(width=360):
        ctx = b.new_context(viewport={"width": width, "height": 860}, device_scale_factor=2, is_mobile=True, has_touch=True)
        ctx.route(CLOUD + "/**", lambda route: route.fulfill(response=route.fetch(url=BASE + "/cloud" + route.request.url[len(CLOUD):])))
        return ctx, ctx.new_page()

    def buy(page, path, kg, name, tel):
        page.goto(BASE + path, wait_until="load", timeout=60000)
        page.wait_for_timeout(1500)
        page.evaluate("kg => { localStorage.setItem('almas-cart-v1', JSON.stringify({p73: kg})); }", kg)
        page.goto(BASE + "/p/p73/", wait_until="load", timeout=60000)
        page.wait_for_timeout(2500)
        page.click("[data-open-cart]")
        page.wait_for_timeout(1200)

    def send(page, name, tel):
        page.fill("[data-order-form] input[name=name]", name)
        page.fill("[data-order-form] input[name=phone]", tel)
        page.click("[data-send]")
        page.wait_for_selector("[data-done]:not([hidden])", timeout=60000)
        return page.evaluate("JSON.parse(localStorage.getItem('almas-orders-v1'))[0]")

    # 1. the inviter
    a_tel, f_tel = phone(), phone()
    a_ctx, a = device()
    buy(a, "/", 2, "Samira", a_tel)
    a_order = send(a, "Samira", a_tel)
    get("/test/status", {"id": a_order["n"], "status": "delivered"})
    a.goto(BASE + "/?orders=1", wait_until="load", timeout=60000)
    a.wait_for_selector("[data-ref-box]:not([hidden])", timeout=20000)
    link = a.inner_text("[data-ref-link]").strip()
    code = urllib.parse.parse_qs(urllib.parse.urlparse(link).query).get("ref", [""])[0]
    check(len(code) == 6 and link.startswith("https://almas5.com/"), f"My orders shows the invite link ({link})")
    check("100" in a.inner_text("[data-ref-sub]"), "it says what both get")
    a.eval_on_selector("[data-ref-box]", "e => e.scrollIntoView({block: 'center'})")
    shot(a, "ref-1-invite-box")

    # 1b. a mistyped link promises nothing, and the made-up code is dropped
    x_ctx, x = device()
    buy(x, "/?ref=ZZZZZZ", 3, "Nadia", phone())
    x.wait_for_timeout(1500)
    check(x.is_hidden("[data-ref-welcome]"), "a mistyped invite code shows no welcome line")
    check(x.evaluate("localStorage.getItem('almas-ref-v1')") is None, "and is dropped from the phone")
    x_ctx.close()

    # 2. the friend, on another phone, from the link
    f_ctx, f = device()
    buy(f, "/?ref=" + code, 3, "Karim", f_tel)
    f.wait_for_selector("[data-ref-welcome]:not([hidden])", timeout=15000)
    welcome = f.inner_text("[data-ref-welcome]")
    check("100" in welcome and "200" in welcome, f"the friend's cart says invited by a friend ({welcome.strip()})")
    f.eval_on_selector("[data-pts]", "e => e.scrollIntoView({block: 'center'})")
    shot(f, "ref-2-friend-cart")
    f_order = send(f, "Karim", f_tel)
    tg = get("/test/telegram")[-1]
    check("بدعوة من زبون" in tg and code in tg, "the shop's message says the order came from an invite")
    check(f.evaluate("localStorage.getItem('almas-ref-v1')") is None, "the invite is spent after the first order")

    # 3. the owner delivers; both get points
    get("/test/status", {"id": f_order["n"], "status": "delivered"})
    a_pts = get("/test/points?phone=212" + a_tel[1:])["points"]
    f_pts = get("/test/points?phone=212" + f_tel[1:])["points"]
    check(any(h["kind"] == "refer" and h["points"] == 100 for h in a_pts["history"]), f"the inviter got 100 points (balance {a_pts['balance']})")
    check(any(h["kind"] == "welcome" and h["points"] == 100 for h in f_pts["history"]), f"the friend got 100 welcome points (balance {f_pts['balance']})")

    adm = b.new_context(viewport={"width": 1200, "height": 900}).new_page()
    errors = []
    adm.on("pageerror", lambda e: errors.append(str(e)))
    adm.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    adm.goto(BASE + "/admin", wait_until="networkidle")
    adm.fill("input", "e2e-admin")
    adm.keyboard.press("Enter")
    adm.wait_for_timeout(1200)
    adm.goto(BASE + "/admin#order/" + f_order["n"], wait_until="networkidle")
    adm.wait_for_selector("text=Invited by a customer", timeout=15000)
    href = adm.get_attribute("a.wa:has-text('thank the inviter')", "href") or ""
    thank = urllib.parse.unquote(href.split("?text=", 1)[1]) if "?text=" in href else ""
    check("100 نقطة" in thank and a_tel[1:] in href, "the order page offers the WhatsApp thank-you to the inviter")
    dmsg = adm.get_attribute("a.wa:has-text('delivered + points')", "href") or ""
    check("هدية" in urllib.parse.unquote(dmsg), "the friend's delivered message names the welcome gift")
    shot(adm, "ref-3-admin-order")
    adm.goto(BASE + "/admin#points", wait_until="networkidle")
    adm.wait_for_selector("text=Invitations", timeout=15000)
    adm.wait_for_timeout(800)
    check("Samira" in adm.inner_text("body") and "Karim" in adm.inner_text("body"), "the Points tab lists the invitation")
    shot(adm, "ref-4-points-tab", full=True)
    check(not errors, f"no errors in the back office {errors}")

    # 4. the inviter's own link on the inviter's own phone sends nothing
    a.goto(BASE + "/?ref=" + code, wait_until="load", timeout=60000)
    a.wait_for_timeout(1500)
    a.click("[data-open-cart]")
    a.wait_for_timeout(800)
    check(a.is_hidden("[data-ref-welcome]"), "no welcome line for a customer who already ordered")
    b.close()
print("FAILED: " + "; ".join(fails) if fails else "ALL OK")
sys.exit(1 if fails else 0)
