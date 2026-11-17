"""Almas Instagram (@almas5com): story highlight covers and the stories behind each highlight.

    python docs/instagram/make_instagram.py          (needs the network: live till prices, Google Fonts)

Writes docs/instagram/highlights/NN-key.png (1080x1920: Instagram shows the centre circle of a cover),
highlights/preview.png (the highlight row as on a phone), stories/NN-key/00.png ... and stories/overview.jpg.

Shelves (8): a title card, the shelf's best sellers (live price from the till's catalogue, the same feed as the
website), then an order card. Info highlights (6): short cards. Arabic first, a French line under it.
Product pictures (the owner's choice, 2026-11-16): the till's own shop photo when it has one (field "img", uploaded
from the phone on the cloud's /app/photos page), else the website's product photo (site/static/img/photo/<id>.jpg,
the same picture the site and the Meta catalogue show), else a drawn bowl. Instagram covers the top ~220 px and the bottom
~260 px of a story with its own buttons: all text sits between.
Icons: 48x48 line drawings made for Almas.
"""
import base64, html, json, re, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(ROOT / "site"))
import build  # noqa: E402  (site/build.py: the catalogue, the shelf names, the business facts)

CFG = build.CFG
SITE = "almas5.com"
WA = CFG["whatsapp_display"]
PER_SHELF = 6
CREAM, PAPER, INK, BODY, TERRA, OLIVE, GOLD = "#f7f0e7", "#fffaf2", "#211a16", "#65584d", "#a14e33", "#5e6943", "#d39a30"
FONTS = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800&family=Cormorant+Garamond:wght@600;700&display=block">'

# key -> (Arabic label, French label, icon). The labels are the highlight names to type in Instagram (max 15 letters).
ICONS = {
    "spices": ("التوابل", "Épices", """
      <path d="M15 17h18v21a4 4 0 0 1-4 4H19a4 4 0 0 1-4-4z"/><path d="M17 17v-4.5h14V17"/><path d="M16 11.5h16"/>
      <path d="M15 25h18M15 33h18"/><circle cx="21" cy="14.7" r=".6"/><circle cx="24" cy="14.7" r=".6"/><circle cx="27" cy="14.7" r=".6"/>"""),
    "blends": ("الخلطات", "Mélanges", """
      <path d="M7 24h34c0 8-7.6 14-17 14S7 32 7 24z"/><path d="M16 38.5l-1.5 3.5h19L32 38.5"/>
      <path d="M27 22 38.5 8.5a2.4 2.4 0 0 1 3.6 3.1L31 23.5"/><path d="M13 22c2-2 4.5-2.6 7-1.6M31 21.5c-1.5-.8-3-.9-4.5-.4"/>"""),
    "herbs": ("الأعشاب", "Herbes", """
      <path d="M24 42V12"/><path d="M24 20c-6-1-9.5-5-10-10 6 .3 9.5 4 10 10z"/><path d="M24 20c6-1 9.5-5 10-10-6 .3-9.5 4-10 10z"/>
      <path d="M24 31c-6.5-1-10-5.5-10.5-11 6.5.4 10 4.5 10.5 11z"/><path d="M24 31c6.5-1 10-5.5 10.5-11-6.5.4-10 4.5-10.5 11z"/>"""),
    "seeds": ("الفواكه الجافة", "Fruits secs", """
      <path d="M17 8c5 3 7 9 5.5 15S15 31 11 28 8 18 11 13s4-6 6-5z"/><path d="M15 12c1.5 4 1.5 9-1 14"/>
      <ellipse cx="32" cy="31" rx="8" ry="10" transform="rotate(25 32 31)"/><path d="M29 24c3 3 4.5 8 3.5 13.5"/>
      <circle cx="22" cy="38" r="2.6"/><circle cx="38" cy="14" r="2.6"/>"""),
    "pastry": ("الحلويات", "Pâtisserie", """
      <path d="M11 25h26l-3.5 15.5a2 2 0 0 1-2 1.5h-15a2 2 0 0 1-2-1.5z"/><path d="M16.5 25l1.5 17M24 25v17M31.5 25 30 42"/>
      <path d="M10 25c-1.2-4 1.5-7.5 5-7.5 0-4.5 4-7.5 9-7.5s9 3 9 7.5c3.5 0 6.2 3.5 5 7.5"/><path d="M24 10V6.5"/>"""),
    "pantry": ("البقالة", "Épicerie", """
      <path d="M13 19h22v19a4 4 0 0 1-4 4H17a4 4 0 0 1-4-4z"/><path d="M15 19v-5h18v5"/><path d="M14 14h20"/>
      <path d="M13 27h22"/><path d="M19 33c2.5 2 7.5 2 10 0"/><path d="M35 9 40 4M37.5 11.5 42 7"/>"""),
    "beauty": ("الحناء والجمال", "Henné & beauté", """
      <path d="M12 26h24a12 11 0 0 1-24 0z"/><path d="M16 26c0-4 3-5.5 6-4.5"/>
      <path d="M30 22c-1-6 2-11 9-13 .8 7-2.5 11.5-9 13z"/><path d="M30 22c2.5-3.5 5-6 8-8"/><path d="M15 41h18"/>"""),
    "incense": ("البخور والمسك", "Encens & musc", """
      <path d="M13 28h22l-3 8H16z"/><path d="M16 36l-1 5h18l-1-5"/><path d="M11 28h26"/>
      <path d="M20 23c-3-3 3-5 0-8s3-5 0-8"/><path d="M28 23c-3-3 3-5 0-8s3-5 0-8"/>"""),
    "order": ("كيف تطلب", "Commander", """
      <path d="M10 17h28l-2.5 23a2 2 0 0 1-2 1.8H14.5a2 2 0 0 1-2-1.8z"/><path d="M18 21v-6a6 6 0 0 1 12 0v6"/>
      <path d="M18.5 30.5l4 4 7.5-8"/>"""),
    "delivery": ("التوصيل والدفع", "Livraison", """
      <rect x="4.5" y="14" width="23" height="16" rx="2"/><path d="M27.5 19h7.5l6.5 6.5V30h-14"/>
      <circle cx="12.5" cy="33.5" r="3.5"/><circle cx="34.5" cy="33.5" r="3.5"/><path d="M16 33.5h15M38 33.5h3.5"/>
      <path d="M10 22h10M10 26h6"/>"""),
    "pro": ("للمهنيين", "Restaurants", """
      <path d="M14 26c-4.5 0-7-3-7-6.5S9.8 13 14 13.5C15 9.5 19 7 24 7s9 2.5 10 6.5c4.2-.5 7 2.5 7 6s-2.5 6.5-7 6.5"/>
      <path d="M14 26v13a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V26"/><path d="M14 34h20"/>"""),
    "points": ("نقاط الوفاء", "Points fidélité", """
      <rect x="8" y="19" width="32" height="8" rx="1.5"/><path d="M10.5 27v13a2 2 0 0 0 2 2h23a2 2 0 0 0 2-2V27"/>
      <path d="M24 19v23"/><path d="M24 19c-3-6-11-7.5-11-2.5 0 2.5 4 2.5 11 2.5zM24 19c3-6 11-7.5 11-2.5 0 2.5-4 2.5-11 2.5z"/>"""),
    "reviews": ("آراء الزبائن", "Avis clients", """
      <path d="M9 8.5h30a3.5 3.5 0 0 1 3.5 3.5v18a3.5 3.5 0 0 1-3.5 3.5H20l-8 7v-7H9A3.5 3.5 0 0 1 5.5 30V12A3.5 3.5 0 0 1 9 8.5z"/>
      <path d="M24 13.5l2.4 5 5.4.7-4 3.7 1 5.4-4.8-2.6-4.8 2.6 1-5.4-4-3.7 5.4-.7z"/>"""),
    "visit": ("زورونا", "Le magasin", """
      <path d="M24 43s-13-12.5-13-23a13 13 0 0 1 26 0c0 10.5-13 23-13 23z"/><circle cx="24" cy="20" r="5"/>"""),
}
ORDER = ["spices", "blends", "herbs", "seeds", "pastry", "pantry", "beauty", "incense",
         "order", "delivery", "pro", "points", "reviews", "visit"]
SHELVES = ORDER[:8]

# the colour of a product's bowl: its own when its name says what it is, else its shelf's
SHELF_COLOUR = {"spices": "#c97a1f", "blends": "#c23a22", "herbs": "#6f7d3c", "seeds": "#a87a4c",
                "pastry": "#c45a7b", "pantry": "#d9971f", "beauty": "#6f7d3c", "incense": "#6d5a8e"}
WORD_COLOUR = [
    (r"كمون|cumin|كروية|carvi", "#8f6234"), (r"خرقوم|كركم|curcuma", "#e09a1c"), (r"فلفل|سودانية|paprika|piment", "#c23a22"),
    (r"قرفة|cannelle", "#9a5530"), (r"سكنجبير|زنجبيل|gingembre", "#c9a46a"), (r"إبزار|ابزار|poivre", "#4a3d33"),
    (r"ثوم|ail", "#e8dcc0"), (r"بصل|oignon", "#e4cfa0"), (r"راس الحانوت|ras el", "#c97a1f"), (r"زعفران|safran", "#a92716"),
    (r"حناء|henn", "#6f7d3c"), (r"نعناع|فلايو|menthe", "#5e7a3c"), (r"ورد|rose", "#c45a7b"), (r"عسل|miel", "#d9971f"),
    (r"لوز|amande", "#c49a6c"), (r"زنجلان|sésame|sesame", "#e2cd9a"), (r"كوكو|coco", "#efe7d6"), (r"كركاع|noix", "#8a6440"),
    (r"زبيب|raisin", "#5a2e2e"), (r"حبة حلوة|anis", "#a7a06a"), (r"سحتر|زعتر|thym", "#7d8a4a"), (r"رند|laurier", "#6f7d3c"),
    (r"بخور|encens", "#6d5a8e"), (r"مسك|musc", "#7a5a8a"), (r"شكلاط|chocolat|قهوة|café", "#5a3a22"), (r"صانوج|nigelle", "#2e2a28"),
    (r"قعقلة|cardamome", "#8a9a52"), (r"قرنفل|عود النوار|clou", "#5a3322"), (r"بابونج|camomille", "#e0c060"),
]

INFO = {
    "order": [
        ("اختر منتجاتك من الموقع", "Choisissez vos produits sur le site", f"{SITE} · بالكيلو أو بالقطعة، بأسعار المتجر"),
        ("أرسل الطلب في دقيقة", "Envoyez la commande en une minute", "الاسم والهاتف والعنوان، ويصلنا الطلب فورًا"),
        ("نتصل بك للتأكيد", "Nous vous appelons pour confirmer", f"الثمن والتوصيل والموعد، على واتساب {WA}"),
    ],
    "delivery": [
        ("التوصيل 35 درهمًا", "Livraison au Maroc : 35 MAD", "داخل المغرب، يصلك الطلب خلال يوم إلى يومين"),
        ("الدفع عند الاستلام", "Paiement à la livraison", "أو في المتجر، أو بتحويل بنكي"),
        ("إلى أوروبا 350 درهمًا", "Europe : 350 MAD", "يصل خلال 2 إلى 5 أيام، أو اطلب لعائلتك في المغرب"),
    ],
    "pro": [
        ("للمطاعم والفنادق وقاعات الأفراح", "Restaurants, hôtels, salles des fêtes", "توابل وأعشاب بالكيلو وأسعار خاصة للكميات الكبيرة"),
        ("طلب دوري", "Commande régulière", "نفس الطلب كل أسبوع أو أسبوعين أو شهر، ونؤكد معك كل مرة"),
        ("اطلب عرض سعر", "Demandez un devis", f"{SITE}/pro"),
    ],
    "points": [
        ("نقاط مع كل طلب", "Des points à chaque commande", "نقطة عن كل 10 دراهم، تضاف عند التسليم"),
        ("كل 100 نقطة تساوي خصم 10 دراهم", "100 points = 10 MAD de remise", "على طلبك القادم من الموقع أو التطبيق"),
        ("ادعُ صديقًا", "Invitez un ami", "رابط الدعوة في «طلباتي» يمنحك 100 نقطة، ويمنح صديقك 100 نقطة عند تسليم أول طلب له"),
    ],
    "reviews": [
        ("رأيك يهمنا", "Votre avis compte", "اكتب رأيك على صفحة المنتج في الموقع، أو على Google"),
        ("شاركنا وصفتك", "Partagez votre recette", "انشر صورة طبقك وأشر إلى @almas5com، ونعيد نشرها هنا"),
    ],
    "visit": [
        ("معشبة ألماس، القصر الصغير", "Ksar Sghir, près de Tanger", "زورونا في المتجر، قرب طنجة"),
        ("مفتوح كل يوم", "Ouvert tous les jours", f"من {CFG['hours']['open']} إلى {CFG['hours']['close']}"),
    ],
}

e = html.escape


def ltr(text):
    """Escape, then keep the phone number, the site and the Instagram name left-to-right inside Arabic lines."""
    runs = sorted({WA, SITE + "/pro", SITE, "@almas5com"}, key=len, reverse=True)
    pat = re.compile("|".join(re.escape(r) for r in runs))
    out, last = [], 0
    for m in pat.finditer(text):
        out.append(e(text[last:m.start()]))
        out.append('<span dir="ltr" style="unicode-bidi:isolate;white-space:nowrap">' + e(m.group()) + "</span>")
        last = m.end()
    out.append(e(text[last:]))
    return "".join(out)


def svg(key, size, stroke=TERRA, width=2.1):
    return (f'<svg viewBox="0 0 48 48" width="{size}" height="{size}" fill="none" stroke="{stroke}" stroke-width="{width}" '
            f'stroke-linecap="round" stroke-linejoin="round">{ICONS[key][2]}</svg>')


BASE_CSS = f"""
html,body{{margin:0;width:1080px;height:1920px;overflow:hidden}}
body{{background:radial-gradient(ellipse at 50% 40%, {PAPER} 0, #f9eedd 50%, #ecd6b5 100%);font-family:Cairo,sans-serif;color:{INK};position:relative}}
.cair{{font-family:Cairo,sans-serif}} .lat{{font-family:"Cormorant Garamond",serif}}
.brand{{position:absolute;top:250px;left:0;right:0;text-align:center;font-weight:700;font-size:30px;letter-spacing:.06em;color:{BODY}}}
.brand b{{color:{TERRA}}}
.foot{{position:absolute;bottom:290px;left:60px;right:60px;text-align:center;font-weight:700;font-size:32px;color:{BODY}}}
.foot b{{color:{INK}}}
.disc{{width:430px;height:430px;border-radius:50%;background:#fff;display:grid;place-items:center;
  box-shadow:0 30px 60px -30px rgba(80,40,10,.45), 0 0 0 10px rgba(211,154,48,.18)}}
"""


def page(body, extra=""):
    return f'<!doctype html><html><head><meta charset="utf-8">{FONTS}<style>{BASE_CSS}{extra}</style></head><body>{body}</body></html>'


def cover(key):
    return page(f'<div style="position:absolute;inset:0;display:grid;place-items:center"><div class="disc" style="width:780px;height:780px">{svg(key, 520)}</div></div>')


def bowl(colour, size):
    return (f'<div class="bowl" style="--c:{colour};width:{size}px;height:{size}px"></div>')


BOWL_CSS = """
.bowl{position:relative;border-radius:50%;background:radial-gradient(circle at 42% 36%, #c47a4b 0, #9a5530 45%, #5f3119 100%);
  box-shadow:0 40px 70px -30px rgba(70,35,10,.6)}
.bowl::after{content:"";position:absolute;inset:12%;border-radius:50%;
  background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='1.1' numOctaves='3' seed='7'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .5 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>"),
    radial-gradient(circle at 40% 34%, color-mix(in srgb, var(--c), #fff 30%), var(--c) 62%, color-mix(in srgb, var(--c), #000 30%) 100%);
  box-shadow:inset 0 14px 24px rgba(0,0,0,.28), inset 0 -4px 10px rgba(255,255,255,.18)}
"""


def title_slide(key, sub_ar, sub_fr):
    ar, fr, _ = ICONS[key]
    return page(f"""<div class="brand">ALMAS · <b>معشبة ألماس</b></div>
<div style="position:absolute;top:520px;left:0;right:0;display:flex;flex-direction:column;align-items:center;text-align:center;gap:10px">
  <div class="disc">{svg(key, 240)}</div>
  <div style="font-weight:800;font-size:104px;margin-top:44px;line-height:1.1" dir="rtl">{e(ar)}</div>
  <div class="lat" style="font-weight:700;font-size:64px;color:#3a2a20">{e(fr)}</div>
  <div style="font-weight:700;font-size:38px;color:{TERRA};margin-top:18px;padding:0 70px" dir="rtl">{e(sub_ar)}</div>
  <div class="lat" style="font-weight:600;font-size:36px;color:{BODY}">{e(sub_fr)}</div>
</div>""")


def colour_of(p):
    text = " ".join([p.get("ar", ""), p.get("fr", ""), p.get("t", "")]).lower()
    for pat, col in WORD_COLOUR:
        if re.search(pat, text):
            return col
    return SHELF_COLOUR.get(p["cat"], TERRA)


PHOTOS = ROOT / "site" / "static" / "img" / "photo"


def photo_of(p):
    """The product's real picture: the till's shop photo, else the website's photo (embedded), else None."""
    if p.get("img"):
        return p["img"]
    f = PHOTOS / f"{p['id']}.jpg"
    if f.exists():
        return "data:image/jpeg;base64," + base64.b64encode(f.read_bytes()).decode()
    return None


def product_slide(key, p, cat):
    unit_ar, unit_fr = ("درهم للكيلو", "MAD / kg") if p["unit"] == "kg" else ("درهم للقطعة", "MAD / pièce")
    price = build.num(p["price"]) if hasattr(build, "num") else p["price"]
    src = photo_of(p)
    pic = (f'<img src="{e(src)}" style="width:640px;height:640px;object-fit:cover;border-radius:40px;box-shadow:0 40px 70px -30px rgba(70,35,10,.6)">'
           if src else bowl(colour_of(p), 600))
    return page(f"""<div class="brand">{svg(key, 34, TERRA, 2.4)} &nbsp;<b dir="rtl">{e(cat['ar'])}</b> · {e(cat['fr'])}</div>
<div style="position:absolute;top:360px;left:0;right:0;display:flex;flex-direction:column;align-items:center;text-align:center">
  {pic}
  <div style="font-weight:800;font-size:96px;line-height:1.15;margin-top:50px;padding:0 60px" dir="rtl">{e(p['ar'])}</div>
  <div class="lat" style="font-weight:700;font-size:58px;color:#3a2a20;padding:0 60px">{e(p['fr'])}</div>
  <div style="margin-top:30px;display:inline-flex;align-items:baseline;gap:16px;padding:14px 38px;border-radius:999px;background:{INK};color:#fff" dir="rtl">
    <span style="font-weight:800;font-size:64px">{e(str(price))}</span><span style="font-weight:700;font-size:34px">{unit_ar}</span>
    <span class="lat" style="font-weight:600;font-size:30px;opacity:.8" dir="ltr">· {unit_fr}</span></div>
</div>
<div class="foot" dir="rtl">اطلب على <b dir="ltr">{SITE}</b><br>أو واتساب <b dir="ltr">{WA}</b></div>""", BOWL_CSS)


def info_slide(key, title_ar, title_fr, text):
    return page(f"""<div class="brand">ALMAS · <b>معشبة ألماس</b></div>
<div style="position:absolute;top:560px;left:0;right:0;display:flex;flex-direction:column;align-items:center;text-align:center;padding:0 70px">
  <div class="disc" style="width:300px;height:300px">{svg(key, 170)}</div>
  <div style="font-weight:800;font-size:84px;line-height:1.2;margin-top:56px" dir="rtl">{e(title_ar)}</div>
  <div class="lat" style="font-weight:700;font-size:54px;color:#3a2a20;margin-top:6px">{e(title_fr)}</div>
  <div style="font-weight:700;font-size:42px;line-height:1.5;color:{TERRA};margin-top:34px" dir="rtl">{ltr(text)}</div>
</div>""")


def closing_slide():
    return page(f"""<div class="brand">ALMAS · <b>معشبة ألماس</b></div>
<div style="position:absolute;top:470px;left:0;right:0;display:flex;flex-direction:column;align-items:center;text-align:center;padding:0 70px">
  <img src="LOGO" style="height:420px">
  <div style="font-weight:800;font-size:96px;line-height:1.15;margin-top:30px" dir="rtl">اطلب في دقيقتين</div>
  <div class="lat" style="font-weight:700;font-size:58px;color:#3a2a20">Commandez en 2 minutes</div>
  <div style="margin-top:46px;padding:22px 46px;border-radius:999px;background:{INK};color:#fff;font-weight:800;font-size:46px" dir="ltr">{SITE}</div>
  <div style="margin-top:22px;padding:20px 46px;border-radius:999px;border:3px solid #1f7a4d;color:#1f7a4d;font-weight:800;font-size:42px" dir="rtl">واتساب <span dir="ltr">{WA}</span></div>
  <div style="font-weight:700;font-size:36px;color:{BODY};margin-top:34px" dir="rtl">الدفع عند الاستلام أو في المتجر</div>
</div>""")


def overview(st):
    """stories/overview.jpg: one row per highlight, every story small."""
    from PIL import Image
    rows = sorted(d for d in st.iterdir() if d.is_dir())
    w, h, gap = 180, 320, 8
    cols = max(len(list(d.glob("*.png"))) for d in rows)
    sheet = Image.new("RGB", (cols * (w + gap), len(rows) * (h + gap)), "#111111")
    for r, d in enumerate(rows):
        for c, f in enumerate(sorted(d.glob("*.png"))):
            sheet.paste(Image.open(f).convert("RGB").resize((w, h)), (c * (w + gap), r * (h + gap)))
    sheet.save(st / "overview.jpg", quality=85)


def catalogue():
    data, source = build.fetch_catalog(False)
    cats = {c["id"]: c for c in data["categories"]}
    for c, names in build.NAMES["_shelves"].items():
        if c in cats:
            cats[c].update(names)
    products = [p for p in data["products"] if p.get("cat") in cats and p.get("price")]
    for p in products:
        p["t"] = p["ar"]
        p.update({k: v for k, v in build.NAMES.get(p["id"], {}).items() if v})
    return source, cats, products


def main():
    source, cats, products = catalogue()
    print("catalogue:", source, len(products), "products")
    logo = "data:image/png;base64," + base64.b64encode((ROOT / "app" / "assets" / "branding" / "almas_logo.png").read_bytes()).decode()
    hl, st = HERE / "highlights", HERE / "stories"
    hl.mkdir(exist_ok=True)
    st.mkdir(exist_ok=True)
    summary = {}
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        pg = b.new_page(viewport={"width": 1080, "height": 1920})

        def shoot(doc, path):
            pg.set_content(doc.replace("LOGO", logo), wait_until="networkidle", timeout=60000)
            pg.evaluate("document.fonts.ready")
            pg.wait_for_timeout(150)
            path.parent.mkdir(parents=True, exist_ok=True)
            pg.screenshot(path=str(path))

        for i, key in enumerate(ORDER, 1):
            name = f"{i:02d}-{key}"
            shoot(cover(key), hl / f"{name}.png")
            folder = st / name
            for old in folder.glob("*.png"):
                old.unlink()
            slides = []
            if key in SHELVES:
                cat = {"ar": cats[key].get("ar", ICONS[key][0]), "fr": cats[key].get("fr", ICONS[key][1])}
                tops = sorted([p for p in products if p["cat"] == key], key=lambda p: -(p.get("rank") or 0))[:PER_SHELF]
                slides.append(title_slide(key, "بالكيلو وبأسعار المتجر", "Au kilo, aux prix du magasin"))
                slides += [product_slide(key, p, cat) for p in tops]
                summary[name] = [f"{p['ar']} / {p['fr']}: {p['price']}" for p in tops]
            else:
                slides.append(title_slide(key, "كل ما تحتاج معرفته", "Tout ce qu'il faut savoir"))
                slides += [info_slide(key, *x) for x in INFO[key]]
                summary[name] = [x[0] for x in INFO[key]]
            slides.append(closing_slide())
            for j, doc in enumerate(slides):
                shoot(doc, folder / f"{j:02d}.png")
            print(name, len(slides), "stories")

        # the highlight row as Instagram shows it on a phone
        uri = lambda f: "data:image/png;base64," + base64.b64encode(f.read_bytes()).decode()
        row = "".join(f'<div class="h"><img src="{uri(hl / f"{i:02d}-{k}.png")}"><span dir="rtl">{e(ICONS[k][0])}</span></div>'
                      for i, k in enumerate(ORDER, 1))
        pg.set_viewport_size({"width": 1180, "height": 760})
        pg.set_content(f"""<!doctype html><html><head><meta charset="utf-8">{FONTS}<style>
body{{margin:0;background:#000;color:#fff;font-family:Cairo,sans-serif;padding:36px}}
h1{{margin:0 0 6px;font-size:30px}} p{{margin:0 0 26px;color:#aaa;font-size:20px}}
.row{{display:grid;grid-template-columns:repeat(7,1fr);gap:26px 18px}}
.h{{display:flex;flex-direction:column;align-items:center;gap:8px;font-size:19px}}
.h img{{width:128px;height:128px;border-radius:50%;object-fit:cover;object-position:center;outline:2px solid #333;outline-offset:4px}}
</style></head><body><h1>@almas5com</h1><p>Highlights preview</p><div class="row">{row}</div></body></html>""", wait_until="networkidle")
        pg.evaluate("document.fonts.ready")
        pg.wait_for_timeout(200)
        pg.screenshot(path=str(hl / "preview.png"), full_page=True)
        b.close()
    overview(st)
    (HERE / "contents.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
