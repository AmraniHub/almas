"""No page may be wider than a phone screen, and the cart drawer must cover the whole screen.

Why: a 360 px phone with a large system font or display size lays the site out at 260-300 CSS px. On 2026-11-13 the
header (logo, search, "pro", languages, cart) needed ~300 px there, the page scrolled sideways, and Chrome sized the
fixed cart drawer to the wider page: the drawer stopped ~30 px short of the screen edge (owner's WhatsApp
screenshot of /p/p73/). Checked here at every width from 240 to 430 px, and with the text at 130% and 160%.

    python site/build.py
    node site/tests/e2e-server.mjs 8792          (serves public/ like Vercel)
    python site/tests/overflow.py [shots_dir]
"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8792"
PAGES = ["/p/p73/", "/", "/fr/", "/en/p/p13/", "/es/", "/pro/", "/fr/pro/"]
WIDTHS = [240, 260, 280, 300, 320, 340, 360, 375, 393, 412, 430]
ZOOMS = [1.0, 1.3, 1.6]
SHOTS = Path(sys.argv[1]) if len(sys.argv) > 1 else None
bad = 0
with sync_playwright() as p:
    b = p.chromium.launch()
    for zoom in ZOOMS:
        for w in (WIDTHS if zoom == 1 else [360, 412]):
            ctx = b.new_context(viewport={"width": w, "height": 760}, device_scale_factor=2, is_mobile=True, has_touch=True)
            ctx.add_init_script("try{localStorage.setItem('almas-cart-v1', JSON.stringify({p73: 1, p13: 0.5}))}catch(e){}")
            page = ctx.new_page()
            for path in PAGES:
                page.goto(BASE + path, wait_until="load", timeout=90000)
                page.wait_for_timeout(600)
                if zoom != 1:
                    page.evaluate("z => { document.documentElement.style.zoom = z; }", str(zoom))
                # every element that pushes out of its box without being a scroller of its own
                wide = page.evaluate("""() => { const o = [], W = document.documentElement.clientWidth;
                  document.querySelectorAll('body *').forEach(e => { const s = getComputedStyle(e);
                    if (s.display === 'none' || s.position === 'fixed' || s.overflowX !== 'visible' || !e.clientWidth) return;
                    if (e.parentElement && getComputedStyle(e.parentElement).overflowX !== 'visible') return;
                    if (e.scrollWidth > e.clientWidth + 4 && e.clientWidth >= W - 40) o.push(e.tagName + '.' + e.className + ' ' + e.scrollWidth + '>' + e.clientWidth); });
                  return o.slice(0, 4); }""")
                page.evaluate("document.querySelector('[data-open-cart]').click()")
                page.wait_for_timeout(200)
                d = page.evaluate("""() => { const q = document.querySelector(".drawer-in").getBoundingClientRect();
                  return [Math.round(q.left), Math.round(q.right)]; }""")
                covers = w > 480 or (d[0] <= 0 and d[1] >= w - 1)
                ok = not wide and covers
                bad += not ok
                if not ok:
                    print(f"BAD  {w:4d} x{zoom} {path:12s} wide={wide} drawer={d}")
                if SHOTS and path == PAGES[0]:
                    SHOTS.mkdir(parents=True, exist_ok=True)
                    page.screenshot(path=str(SHOTS / f"drawer-{w}-x{zoom}.png"))
            ctx.close()
    b.close()
print(f"{bad} problems" if bad else "ALL OK: no page wider than the screen, the cart drawer covers it, 240-430 px, text 100/130/160%")
sys.exit(1 if bad else 0)
