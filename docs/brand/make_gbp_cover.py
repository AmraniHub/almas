"""Google Business Profile images for Almas: cover (1920x1080, a grid of real product photos with the logo card in the
middle) and the profile logo (the WhatsApp profile image, 1080x1080). Output: C:/Users/Elamr/AppData/Local/Temp/alm/gbp/."""
import base64
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(r"C:/Users/Elamr/Music/APPS/Android Apps/Almas")
OUT = Path(r"C:/Users/Elamr/AppData/Local/Temp/alm/gbp")
OUT.mkdir(parents=True, exist_ok=True)
PH = ROOT / "site" / "static" / "img" / "photo"
IDS = ["p13", "p2", "p6", "p3", "p9", "p1"]  # paprika, turmeric, cumin, black pepper, cinnamon, ginger
uri = lambda f: "data:image/jpeg;base64," + base64.b64encode(f.read_bytes()).decode()
logo = "data:image/png;base64," + base64.b64encode((ROOT / "app/assets/branding/almas_logo.png").read_bytes()).decode()
tiles = "".join(f'<div class="t" style="background-image:url({uri(PH / (i + ".jpg"))})"></div>' for i in IDS)
html = f"""<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@700;800&family=Cormorant+Garamond:wght@600;700&display=block" rel="stylesheet">
<style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{width:1920px;height:1080px;background:#f7f0e7;overflow:hidden;font-family:Cairo,sans-serif}}
.g{{position:absolute;inset:0;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(2,1fr);gap:10px;background:#f7f0e7}}
.t{{background-size:cover;background-position:center}}
.shade{{position:absolute;inset:0;background:radial-gradient(ellipse at center, rgba(247,240,231,.55) 0, rgba(247,240,231,0) 60%)}}
.card{{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:760px;padding:40px 50px 44px;border-radius:44px;
  background:rgba(255,250,242,.96);box-shadow:0 40px 90px -30px rgba(60,30,10,.55);text-align:center}}
.card img{{height:230px}}
.ar{{font-weight:800;font-size:96px;color:#211a16;line-height:1.1;margin-top:6px}}
.fr{{font-family:'Cormorant Garamond',serif;font-weight:700;font-size:50px;color:#3a2a20;margin-top:4px}}
.sub{{font-weight:700;font-size:34px;color:#a14e33;margin-top:14px}}
</style></head><body>
<div class="g">{tiles}</div><div class="shade"></div>
<div class="card"><img src="{logo}"><div class="ar">معشبة ألماس</div><div class="fr">Almas · Épices &amp; Herbes</div>
<div class="sub" dir="rtl">توابل وأعشاب بالكيلوغرام · القصر الصغير</div></div>
</body></html>"""
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1920, "height": 1080})
    pg.set_content(html, wait_until="networkidle", timeout=90000)
    pg.wait_for_timeout(1500)
    pg.screenshot(path=str(OUT / "almas-gbp-cover.jpg"), type="jpeg", quality=92)
    b.close()
(OUT / "almas-gbp-logo.jpg").write_bytes((ROOT / "docs/whatsapp/almas-whatsapp-profile.jpg").read_bytes())
print("ok", [f.name for f in OUT.iterdir()])
