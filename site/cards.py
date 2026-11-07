"""Draw the product cards the site and the Meta catalogue use until the shop uploads a real photo.

Each card is 800x800 (Meta wants square images of at least 500 px) with the product's Arabic and French names on
its shelf colour. It is drawn by Chromium through Playwright, because Pillow on this laptop has no Arabic shaping
(no libraqm) and would print the letters unjoined and backwards. Also writes the shelf cards and the logo sizes.

    python site/cards.py          draw the cards that are missing
    python site/cards.py --all    redraw every card (after a design change)

Run on the laptop after the shop adds products; commit site/static/img. The daily build uses the shelf card for any
product drawn here later, and a real photo (uploaded on the cloud's /app/photos page) always wins over a card.
"""
import base64
import html
import io
import sys
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build  # noqa: E402

OUT = build.STATIC / "img"
LOGO = build.ROOT / "app" / "assets" / "branding" / "almas_logo.png"

PAGE = """<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@600;800&family=Cormorant+Garamond:ital,wght@0,600;1,600&display=block" rel="stylesheet">
<style>
html,body{margin:0;width:800px;height:800px;overflow:hidden}
body{background:#f7f0e7;font-family:Cairo,sans-serif;color:#211a16;position:relative}
.tint{position:absolute;inset:0;background:radial-gradient(90% 70% at 50% 34%, var(--c) 0, transparent 70%);opacity:.22}
.grain{position:absolute;inset:0;background-image:radial-gradient(rgba(33,26,22,.06) 1px, transparent 1.3px);background-size:14px 14px}
.disc{position:absolute;left:50%;top:150px;width:260px;height:260px;margin-left:-130px;border-radius:50%;
 background:radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--c) 55%, #fff) 0, var(--c) 58%, color-mix(in srgb, var(--c) 70%, #000) 100%);
 box-shadow:0 30px 60px -20px color-mix(in srgb, var(--c) 60%, #000)}
.disc::after{content:"";position:absolute;inset:26px;border-radius:50%;border:2px dashed rgba(255,255,255,.35)}
.names{position:absolute;left:40px;right:40px;top:440px;text-align:center}
.ar{font-weight:800;font-size:var(--ars);line-height:1.25;direction:rtl}
.fr{font-family:"Cormorant Garamond",serif;font-style:italic;font-weight:600;font-size:var(--frs);color:#65584d;margin-top:6px}
.foot{position:absolute;left:40px;right:40px;bottom:34px;display:flex;align-items:center;justify-content:space-between;
 font-size:20px;color:#65584d;border-top:1.5px solid rgba(33,26,22,.14);padding-top:18px}
.foot b{color:#211a16;font-weight:800}
.foot img{width:44px;height:44px;border-radius:10px;background:#fff;vertical-align:middle;margin-inline-end:10px}
.shelf{display:flex;align-items:center;gap:8px}
.dot{width:12px;height:12px;border-radius:50%;background:var(--c)}
</style></head><body style="--c:{color};--ars:{ars}px;--frs:{frs}px">
<div class="tint"></div><div class="grain"></div><div class="disc"></div>
<div class="names"><div class="ar">{ar}</div><div class="fr">{fr}</div></div>
<div class="foot"><span><img src="{logo}" alt=""><b>Almas</b> · Ksar Sghir</span><span class="shelf"><span class="dot"></span>{shelf}</span></div>
</body></html>"""


def fit(text, big, small, limit):
    """Font size that keeps a name on two lines at most: shorter names get the bigger size."""
    n = len(text)
    return big if n <= limit else max(small, int(big * limit / n))


def draw(page, out, color, ar, fr, shelf, logo_uri):
    doc = (PAGE.replace("{color}", color).replace("{ars}", str(fit(ar, 92, 54, 12))).replace("{frs}", str(fit(fr, 50, 34, 22)))
           .replace("{ar}", html.escape(ar)).replace("{fr}", html.escape(fr)).replace("{shelf}", html.escape(shelf))
           .replace("{logo}", logo_uri))
    page.set_content(doc, wait_until="networkidle")
    page.evaluate("document.fonts.ready")
    png = page.screenshot(type="png")
    Image.open(io.BytesIO(png)).convert("RGB").save(out, "JPEG", quality=84, optimize=True, progressive=True)


def logos():
    OUT.mkdir(parents=True, exist_ok=True)
    src = Image.open(LOGO).convert("RGBA")
    for size, name in ((512, "logo-512.png"), (192, "logo-192.png"), (64, "favicon.png")):
        bg = Image.new("RGBA", src.size, (255, 255, 255, 255))
        bg.alpha_composite(src)
        bg.convert("RGB").resize((size, size), Image.LANCZOS).save(OUT / name, optimize=True)
    # a data URI: a page set with set_content() may not load file:// images
    return "data:image/png;base64," + base64.b64encode((OUT / "logo-192.png").read_bytes()).decode()


def main():
    redo = "--all" in sys.argv
    data, source = build.fetch_catalog("--offline" in sys.argv)
    cats = {c["id"]: c for c in data["categories"]}
    logo_uri = logos()
    (OUT / "p").mkdir(parents=True, exist_ok=True)
    (OUT / "cat").mkdir(parents=True, exist_ok=True)
    done = 0
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        page = browser.new_page(viewport={"width": 800, "height": 800}, device_scale_factor=1)
        for c in cats.values():
            out = OUT / "cat" / f"{c['id']}.jpg"
            if redo or not out.exists():
                draw(page, out, c["color"], c["ar"], c["fr"], c["fr"], logo_uri)
                done += 1
        for p in data["products"]:
            if p.get("cat") not in cats:
                continue
            out = OUT / "p" / f"{p['id']}.jpg"
            if redo or not out.exists():
                c = cats[p["cat"]]
                draw(page, out, c["color"], p["ar"], p["fr"], f"{c['ar']} · {c['fr']}", logo_uri)
                done += 1
        browser.close()
    print(f"{done} cards drawn from the {source} catalogue into {OUT}")


if __name__ == "__main__":
    main()
