"""The owner's one-tap WhatsApp messages carry the loyalty points (back office, in the browser, nothing sent).

    python site/build.py ; node site/tests/e2e-server.mjs 8792   (the e2e server also serves /admin)
    python site/tests/admin_points_e2e.py [shots_dir]

An order is placed through the real /api/order/, the owner opens it: the confirmation names the points it will earn.
He sets it delivered: a second button appears whose message names the points earned, the balance and its MAD value.
The reorder reminder is checked with sample data through the page's own message builder.
"""
import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8792"
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


def wa_text(page, label):
    href = page.get_attribute(f"a.wa:has-text('{label}')", "href")
    return urllib.parse.unquote(href.split("?text=", 1)[1]) if href and "?text=" in href else ""


o = post("/api/order/", {"name": "Fatima", "phone": "0611229001", "items": [{"id": "p73", "q": 8}]})
check(o.get("ok"), f"order placed: {o.get('number')} = {o.get('total')} MAD")
due = int(o["total"] // 10)

with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_context(viewport={"width": 1100, "height": 900}).new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.goto(BASE + "/admin", wait_until="networkidle")
    page.fill("input", "e2e-admin")
    page.keyboard.press("Enter")
    page.wait_for_timeout(1200)

    page.goto(BASE + "/admin#order/" + o["number"], wait_until="networkidle")
    page.wait_for_selector("a.wa:has-text('WhatsApp confirmation')", timeout=15000)
    msg = wa_text(page, "WhatsApp confirmation")
    check(f"نضيف إلى رصيدكم {due} نقطة" in msg, f"confirmation names the {due} points to come")
    check(page.locator("a.wa:has-text('delivered + points')").count() == 0, "no 'delivered' message before delivery")

    page.select_option("select", "delivered")
    page.click("button:has-text('Save status')")
    page.wait_for_selector("a.wa:has-text('delivered + points')", timeout=15000)
    msg = wa_text(page, "delivered + points")
    check(f"أضفنا إلى رصيدكم {due} نقطة" in msg and f"فأصبح رصيدكم {due} نقطة" in msg, "delivered message: points earned and the new balance")
    worth = (due // 100) * 10
    check((f"خصم {worth} درهم" in msg) if worth else ("عند 100 نقطة" in msg), f"delivered message: worth {worth} MAD")
    check("نضيف إلى رصيدكم" not in wa_text(page, "WhatsApp confirmation"), "the confirmation stops promising points once delivered")
    if SHOTS:
        SHOTS.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(SHOTS / "admin-order-delivered.png"))
    print("  delivered message:", msg)

    sample = {"name": "Restaurant Nour", "business": "Restaurant Nour", "days": 21, "items": [{"qty": 2, "unit": "kg", "name": "كمون"}],
              "points": 230, "points_mad": 20}
    rem = page.evaluate("r => window.almasMessages.reorderMessage(r)", sample)
    check("230 نقطة وفاء تساوي خصم 20 درهم" in rem, "reorder reminder names the points and their value")
    rem0 = page.evaluate("r => window.almasMessages.reorderMessage(r)", {**sample, "points": 40, "points_mad": 0})
    check("نقطة" not in rem0, "reorder reminder says nothing under 100 points")
    check(not errors, f"no errors in the back office page {errors}")
    b.close()
print("FAILED: " + "; ".join(fails) if fails else "ALL OK")
sys.exit(1 if fails else 0)
