"""Build the Almas website and its Meta catalogue feeds into public/ (Vercel builds and serves it).

Everything comes from the shop's live catalogue (the till's names and prices, published by the Aronium agent at
config.catalog_url), so the site, the app and the ads always show the same products at the same prices.

    python site/build.py            fetch the live catalogue, write public/
    python site/build.py --offline  use the catalogue built into the app (app/assets/catalog/products.json)
    ALMAS_BASE_URL / ALMAS_OUT      override config.base_url / the output folder

Writes, for Arabic (root), French (/fr/) and English (/en/): the home page with every shelf, one page per product
(the page a catalogue ad opens), plus feed/meta.csv (French, the main Meta catalogue feed), feed/meta-ar.csv and
feed/meta-en.csv (Meta language overrides), sitemap.xml, robots.txt and 404.html, and copies site/static/,
docs/privacy-policy.html and docs/store/ in.

Product images: the shop's real photo when one was uploaded to the cloud (catalogue field "img"), else the card
drawn by site/cards.py (site/static/img/p/<id>.jpg), else the shelf's card (site/static/img/cat/<shelf>.jpg).
Stdlib only, so Vercel's build image needs nothing installed.
"""
import csv
import hashlib
import html
import json
import os
import shutil
import subprocess
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
DOCS = ROOT / "docs"      # GitHub Pages: only the app's privacy page and the Play images now
STATIC = HERE / "static"  # copied as-is into the site: product cards, shelf cards, logos
CFG = json.loads((HERE / "config.json").read_text(encoding="utf-8"))
OUT = Path(os.environ.get("ALMAS_OUT") or ROOT / "public")
BASE = (os.environ.get("ALMAS_BASE_URL") or CFG["base_url"]).rstrip("/")
PREFIX = "/" + BASE.split("://", 1)[1].split("/", 1)[1] if BASE.count("/") > 2 else ""  # "" at a domain's root
LANGS = ("ar", "fr", "en")
LOCALE = {"ar": "ar_MA", "fr": "fr_MA", "en": "en_US"}
MONEY = {"ar": "{} درهم", "fr": "{} DH", "en": "{} MAD"}

# Shelf -> Google product category (Meta reads it to place items; text paths are accepted)
GOOGLE_CAT = {
    "spices": "Food, Beverages & Tobacco > Food Items > Seasonings & Spices > Herbs & Spices",
    "blends": "Food, Beverages & Tobacco > Food Items > Seasonings & Spices > Herbs & Spices",
    "herbs": "Food, Beverages & Tobacco > Food Items > Seasonings & Spices > Herbs & Spices",
    "seeds": "Food, Beverages & Tobacco > Food Items > Nuts & Seeds",
    "pastry": "Food, Beverages & Tobacco > Food Items > Cooking & Baking Ingredients",
    "pantry": "Food, Beverages & Tobacco > Food Items",
    "beauty": "Health & Beauty > Personal Care > Cosmetics",
    "incense": "Home & Garden > Decor > Home Fragrances > Incense",
}

# Every sentence the site says. Delivery and payment are the app's own approved wording, nothing more.
T = {
    "ar": {
        "dir": "rtl", "name": CFG["brand_ar"],
        "title": "معشبة ألماس | توابل وأعشاب بالكيلو في القصر الصغير",
        "desc": "توابل وأعشاب من محلنا في القصر الصغير، للبيت والمطاعم والفنادق وقاعات الأفراح. أسعار المحل الحقيقية، والطلب عبر واتساب.",
        "kicker": "القصر الصغير، قرب طنجة",
        "h1": "توابل وأعشاب بالكيلو، من محلنا في القصر الصغير",
        "lead": "توابل وأعشاب من محلنا في القصر الصغير، للبيت والمطاعم والفنادق وقاعات الأفراح. الأثمنة هي أثمنة المحل.",
        "browse": "تصفح المنتجات", "wa": "اطلب عبر واتساب", "call": "اتصل بنا",
        "facts": "{n} منتج · {s} رفوف",
        "search": "ابحث عن منتج…", "all": "الكل", "none": "ما لقينا حتى منتج بهاد الاسم.",
        "kg": "للكيلو", "piece": "للوحدة", "add": "زيد للسلة", "added": "تزاد",
        "cart": "السلة", "cart_empty": "السلة فارغة",
        "cart_empty_sub": "زيد المنتجات من الكتالوج، ومن بعد صيفط الطلب للمحل.",
        "order_note": "طلبك كيوصل للمحل مباشرة، ونأكدو معاك الثمن والتوصيل والوقت فواتساب.",
        "pay_note": "الخلاص عند الاستلام أو فالمحل أو بتحويل بنكي. والتوصيل كنتافقو عليه معاك فواتساب.",
        "f_name": "الاسم أو اسم المؤسسة", "f_phone": "رقم الهاتف", "f_address": "العنوان", "f_notes": "ملاحظات (اختياري)",
        "send": "أكد الطلب", "subtotal": "المجموع", "remove": "حيد",
        "pay_title": "طريقة الخلاص", "pay_cod": "عند الاستلام أو فالمحل", "pay_bank": "تحويل بنكي",
        "bank_note": "حول المبلغ لهاد الحساب، وكتب رقم الطلب فسبب التحويل، ومن بعد صيفط لينا الوصل فواتساب.",
        "b_holder": "المستفيد", "b_bank": "البنك", "b_rib": "RIB", "copy": "نسخ", "copied": "تنسخ",
        "sending": "كنصيفطو الطلب…", "done_title": "توصلنا بالطلب ديالك",
        "done_body": "رقم الطلب: {n} · المجموع: {t}. غادي نتاصلو بيك باش نأكدو التوصيل.",
        "done_wa": "تابع فواتساب", "fail": "ما قدرناش نصيفطو الطلب. غادي يتحل واتساب باش تصيفطو مباشرة.",
        "o_pay": "💳 الخلاص", "o_number": "🧾 رقم الطلب",
        "pay_card": "بطاقة بنكية (أداء آمن فالإنترنت)",
        "card_fail": "الأداء بالبطاقة ما خدامش دابا لهاد الطلب. اختار طريقة أخرى للخلاص.",
        "ty_title": "شكرا ليك", "ty_wait": "كنتأكدو من الأداء…",
        "ty_paid": "توصلنا بالأداء ديال الطلب {n} ({t}). غادي نتاصلو بيك باش نأكدو التوصيل.",
        "ty_unpaid": "مازال ما توصلناش بتأكيد الأداء. إلا خلصتي، صيفط لينا رقم الطلب فواتساب.",
        "biz_title": "المطاعم والفنادق وقاعات الأفراح",
        "biz_body": "اطلب بالكيلو باسم مؤسستك وعنوانها. وللكميات الكبيرة، اطلب منا الثمن عبر واتساب.",
        "biz_cta": "اطلب ثمن الكميات الكبيرة",
        "biz_msg": "السلام عليكم ألماس، عندي مؤسسة وبغيت الثمن ديال كميات كبيرة من: ",
        "nav_pro": "للمهنيين", "t_waze": "Waze", "t_waze_sub": "سوق حتى للمحل", "t_dir": "الطريق للمحل", "t_call": "اتصل بنا", "t_wa": "واتساب", "t_review": "قيمنا على Google", "t_insta": "إنستغرام",
        "review": "قيم ألماس على Google",
        "insta": "إنستغرام",
        "directions": "الطريق للمحل",
        "pro_title": "للمطاعم والفنادق ومنظمي الأعراس",
        "pro_lead": "توابل وأعشاب وخلطات بالكيلو للمطابخ المهنية والأعراس والمناسبات، من محلنا فالقصر الصغير قرب طنجة.",
        "pro_points": ["بالكيلو، بأثمنة المحل.", "للكميات الكبيرة، اطلب منا الثمن.", "الخلاص عند الاستلام أو فالمحل أو بتحويل بنكي.", "التوصيل كنتافقو عليه معاك فواتساب."],
        "pro_top": "الأكثر طلبا فالمطابخ",
        "q_title": "اطلب ثمن",
        "q_intro": "قول لينا شنو محتاج وبشحال، ونرجعو ليك بالثمن فواتساب.",
        "q_type": "نوع النشاط",
        "q_types": ["مطعم", "فندق", "أعراس ومناسبات", "ممون حفلات", "آخر"],
        "q_business": "اسم المؤسسة",
        "q_contact": "الاسم",
        "q_phone": "الهاتف",
        "q_city": "المدينة",
        "q_date": "تاريخ المناسبة (إلا كانت)",
        "q_guests": "عدد الضيوف (إلا كانت مناسبة)",
        "q_freq": "كل شحال",
        "q_freqs": ["مرة وحدة", "كل سيمانة", "كل شهر"],
        "q_items": "المنتجات والكميات",
        "q_items_ph": "مثلا: 5 كيلو كمون، 3 كيلو خرقوم، 2 كيلو راس الحانوت",
        "q_send": "صيفط طلب الثمن",
        "q_done": "توصلنا بالطلب ديالك. غادي نتاصلو بيك بالثمن فواتساب.",
        "q_fail": "ما قدرناش نصيفطو الطلب. غادي يتحل واتساب باش تصيفطو مباشرة.",
        "visit_title": "زورونا فالمحل", "visit_body": "محلنا فالقصر الصغير، قرب طنجة.", "map": "الطريق على خرائط Google",
        "how_title": "كيفاش كتطلب",
        "how": ["اختار المنتجات بالكيلو (كل 250 غرام) أو بالقطعة.", "صيفط الطلب للمحل عبر واتساب من السلة.",
                "كنأكدو معاك الثمن والتوصيل والوقت، والخلاص عند الاستلام أو فالمحل أو بتحويل بنكي."],
        "related": "من نفس الرف", "back": "كل المنتجات", "order_one": "اطلب هاد المنتج دابا",
        "one_msg": "السلام عليكم ألماس، بغيت: ",
        "privacy": "سياسة الخصوصية", "app": "تطبيق ألماس على Google Play",
        "nf_title": "هاد الصفحة ما كايناش", "nf_body": "رجع للكتالوج ديال ألماس.",
        "order_head": "🌿 *طلب جديد من ألماس*", "o_name": "🏢 الاسم", "o_phone": "📞 الهاتف", "o_address": "📍 العنوان",
        "o_notes": "📝 ملاحظات", "o_items": "🛒 المنتجات", "o_total": "المجموع", "o_from": "من الموقع",
        "langname": "العربية", "short": "ع", "updated": "حسب أثمنة المحل",
    },
    "fr": {
        "dir": "ltr", "name": CFG["brand_fr"],
        "title": "Almas | Épices et herbes au kilo à Ksar Sghir, près de Tanger",
        "desc": "Épices et herbes de notre boutique à Ksar Sghir, pour la maison, les restaurants, les hôtels et les salles de fêtes. Les vrais prix de la boutique, commande sur WhatsApp.",
        "kicker": "Ksar Sghir, près de Tanger",
        "h1": "Épices et herbes au kilo, depuis notre boutique de Ksar Sghir",
        "lead": "Épices et herbes de notre boutique à Ksar Sghir, pour la maison, les restaurants, les hôtels et les salles de fêtes. Les prix sont ceux de la boutique.",
        "browse": "Voir les produits", "wa": "Commander sur WhatsApp", "call": "Nous appeler",
        "facts": "{n} produits · {s} rayons",
        "search": "Chercher un produit…", "all": "Tout", "none": "Aucun produit ne porte ce nom.",
        "kg": "le kilo", "piece": "l'unité", "add": "Ajouter", "added": "Ajouté",
        "cart": "Panier", "cart_empty": "Votre panier est vide",
        "cart_empty_sub": "Ajoutez des produits du catalogue, puis envoyez la commande à la boutique.",
        "order_note": "Votre commande part directement à la boutique. Nous confirmons avec vous le prix, la livraison et l'heure sur WhatsApp.",
        "pay_note": "Vous payez à la livraison, à la boutique ou par virement bancaire. La livraison se convient avec vous sur WhatsApp.",
        "f_name": "Nom ou établissement", "f_phone": "Téléphone", "f_address": "Adresse", "f_notes": "Notes (facultatif)",
        "send": "Confirmer la commande", "subtotal": "Total", "remove": "Retirer",
        "pay_title": "Paiement", "pay_cod": "À la livraison ou à la boutique", "pay_bank": "Virement bancaire",
        "bank_note": "Virez le montant sur ce compte avec le numéro de commande en motif, puis envoyez-nous le reçu sur WhatsApp.",
        "b_holder": "Bénéficiaire", "b_bank": "Banque", "b_rib": "RIB", "copy": "Copier", "copied": "Copié",
        "sending": "Envoi de la commande…", "done_title": "Commande reçue",
        "done_body": "Commande {n} · total {t}. Nous vous contactons pour confirmer la livraison.",
        "done_wa": "Continuer sur WhatsApp", "fail": "La commande n'a pas pu partir. WhatsApp va s'ouvrir pour l'envoyer directement.",
        "o_pay": "💳 Paiement", "o_number": "🧾 Commande",
        "pay_card": "Carte bancaire (paiement en ligne sécurisé)",
        "card_fail": "Le paiement par carte n'est pas disponible pour cette commande. Choisissez un autre mode de paiement.",
        "ty_title": "Merci !", "ty_wait": "Vérification du paiement…",
        "ty_paid": "Paiement reçu pour la commande {n} ({t}). Nous vous contactons pour confirmer la livraison.",
        "ty_unpaid": "Nous n'avons pas encore la confirmation du paiement. Si vous avez payé, envoyez-nous le numéro de commande sur WhatsApp.",
        "biz_title": "Restaurants, hôtels, salles de fêtes",
        "biz_body": "Commandez au kilo avec le nom et l'adresse de votre établissement. Pour les grandes quantités, demandez-nous un prix sur WhatsApp.",
        "biz_cta": "Demander un prix pour de grandes quantités",
        "biz_msg": "Bonjour Almas, j'ai un établissement et je voudrais un prix pour de grandes quantités de : ",
        "nav_pro": "Professionnels", "t_waze": "Waze", "t_waze_sub": "Y aller en voiture", "t_dir": "Itinéraire", "t_call": "Appeler", "t_wa": "WhatsApp", "t_review": "Avis Google", "t_insta": "Instagram",
        "review": "Notez Almas sur Google",
        "insta": "Instagram",
        "directions": "Itinéraire vers la boutique",
        "pro_title": "Restaurants, hôtels, organisateurs de mariages",
        "pro_lead": "Épices, herbes et mélanges au kilo pour les cuisines professionnelles, les mariages et les fêtes, depuis notre boutique de Ksar Sghir près de Tanger.",
        "pro_points": ["Au kilo, aux prix de la boutique.", "Pour les grandes quantités, demandez-nous un prix.", "Paiement à la livraison, à la boutique ou par virement bancaire.", "Livraison convenue avec vous sur WhatsApp."],
        "pro_top": "Les plus demandés en cuisine",
        "q_title": "Demander un prix",
        "q_intro": "Dites-nous ce qu'il vous faut et en quelle quantité : nous vous répondons avec un prix sur WhatsApp.",
        "q_type": "Activité",
        "q_types": ["Restaurant", "Hôtel", "Mariages et événements", "Traiteur", "Autre"],
        "q_business": "Établissement",
        "q_contact": "Votre nom",
        "q_phone": "Téléphone",
        "q_city": "Ville",
        "q_date": "Date de l'événement (s'il y en a un)",
        "q_guests": "Nombre d'invités (pour un événement)",
        "q_freq": "Fréquence",
        "q_freqs": ["Une fois", "Chaque semaine", "Chaque mois"],
        "q_items": "Produits et quantités",
        "q_items_ph": "Par exemple : 5 kg de cumin, 3 kg de curcuma, 2 kg de ras el hanout",
        "q_send": "Envoyer la demande",
        "q_done": "Demande reçue. Nous vous répondons avec un prix sur WhatsApp.",
        "q_fail": "La demande n'a pas pu partir. WhatsApp va s'ouvrir pour l'envoyer directement.",
        "visit_title": "Venez à la boutique", "visit_body": "Notre boutique est à Ksar Sghir, près de Tanger.", "map": "Itinéraire sur Google Maps",
        "how_title": "Comment commander",
        "how": ["Choisissez vos produits au kilo (par 250 g) ou à la pièce.", "Envoyez la commande à la boutique sur WhatsApp, depuis le panier.",
                "Nous confirmons le prix, la livraison et l'heure ; vous payez à la livraison, à la boutique ou par virement."],
        "related": "Du même rayon", "back": "Tous les produits", "order_one": "Commander ce produit maintenant",
        "one_msg": "Bonjour Almas, je voudrais : ",
        "privacy": "Politique de confidentialité", "app": "L'application Almas sur Google Play",
        "nf_title": "Cette page n'existe pas", "nf_body": "Retournez au catalogue Almas.",
        "order_head": "🌿 *Nouvelle commande Almas*", "o_name": "🏢 Nom", "o_phone": "📞 Téléphone", "o_address": "📍 Adresse",
        "o_notes": "📝 Notes", "o_items": "🛒 Articles", "o_total": "Total", "o_from": "depuis le site",
        "langname": "Français", "short": "FR", "updated": "aux prix de la boutique",
    },
    "en": {
        "dir": "ltr", "name": CFG["brand_en"],
        "title": "Almas | Spices and herbs by the kilo in Ksar Sghir, near Tangier",
        "desc": "Spices and herbs from our shop in Ksar Sghir, for homes, restaurants, hotels and wedding venues. The shop's real prices, order on WhatsApp.",
        "kicker": "Ksar Sghir, near Tangier",
        "h1": "Spices and herbs by the kilo, from our shop in Ksar Sghir",
        "lead": "Spices and herbs from our shop in Ksar Sghir, for homes, restaurants, hotels and wedding venues. Prices are the shop's own.",
        "browse": "See the products", "wa": "Order on WhatsApp", "call": "Call us",
        "facts": "{n} products · {s} shelves",
        "search": "Search a product…", "all": "All", "none": "No product by that name.",
        "kg": "per kilo", "piece": "each", "add": "Add", "added": "Added",
        "cart": "Cart", "cart_empty": "Your cart is empty",
        "cart_empty_sub": "Add products from the catalogue, then send the order to the shop.",
        "order_note": "Your order goes straight to the shop. We confirm the price, the delivery and the time with you on WhatsApp.",
        "pay_note": "You pay on delivery, at the shop or by bank transfer. Delivery is agreed with you on WhatsApp.",
        "f_name": "Name or business", "f_phone": "Phone", "f_address": "Address", "f_notes": "Notes (optional)",
        "send": "Confirm the order", "subtotal": "Total", "remove": "Remove",
        "pay_title": "Payment", "pay_cod": "On delivery or at the shop", "pay_bank": "Bank transfer",
        "bank_note": "Transfer the amount to this account with the order number as the reference, then send us the receipt on WhatsApp.",
        "b_holder": "Account holder", "b_bank": "Bank", "b_rib": "RIB", "copy": "Copy", "copied": "Copied",
        "sending": "Sending the order…", "done_title": "Order received",
        "done_body": "Order {n} · total {t}. We will contact you to confirm the delivery.",
        "done_wa": "Continue on WhatsApp", "fail": "The order could not be sent. WhatsApp will open so you can send it directly.",
        "o_pay": "💳 Payment", "o_number": "🧾 Order",
        "pay_card": "Bank card (secure online payment)",
        "card_fail": "Card payment is not available for this order. Please choose another way to pay.",
        "ty_title": "Thank you!", "ty_wait": "Checking the payment…",
        "ty_paid": "Payment received for order {n} ({t}). We will contact you to confirm the delivery.",
        "ty_unpaid": "We do not have the payment confirmation yet. If you paid, send us the order number on WhatsApp.",
        "biz_title": "Restaurants, hotels, wedding venues",
        "biz_body": "Order by the kilo with your business name and address. For large quantities, ask us for a price on WhatsApp.",
        "biz_cta": "Ask for a bulk price",
        "biz_msg": "Hello Almas, I run a business and would like a price for large quantities of: ",
        "nav_pro": "Businesses", "t_waze": "Waze", "t_waze_sub": "Drive there", "t_dir": "Directions", "t_call": "Call", "t_wa": "WhatsApp", "t_review": "Google review", "t_insta": "Instagram",
        "review": "Rate Almas on Google",
        "insta": "Instagram",
        "directions": "Directions to the shop",
        "pro_title": "Restaurants, hotels, wedding organisers",
        "pro_lead": "Spices, herbs and blends by the kilo for professional kitchens, weddings and events, from our shop in Ksar Sghir near Tangier.",
        "pro_points": ["By the kilo, at the shop's prices.", "For large quantities, ask us for a price.", "Pay on delivery, at the shop or by bank transfer.", "Delivery agreed with you on WhatsApp."],
        "pro_top": "Most ordered by kitchens",
        "q_title": "Ask for a price",
        "q_intro": "Tell us what you need and how much: we reply with a price on WhatsApp.",
        "q_type": "Business type",
        "q_types": ["Restaurant", "Hotel", "Weddings and events", "Caterer", "Other"],
        "q_business": "Business name",
        "q_contact": "Your name",
        "q_phone": "Phone",
        "q_city": "City",
        "q_date": "Event date (if any)",
        "q_guests": "Number of guests (for an event)",
        "q_freq": "How often",
        "q_freqs": ["Once", "Every week", "Every month"],
        "q_items": "Products and quantities",
        "q_items_ph": "For example: 5 kg cumin, 3 kg turmeric, 2 kg ras el hanout",
        "q_send": "Send the request",
        "q_done": "Request received. We will reply with a price on WhatsApp.",
        "q_fail": "The request could not be sent. WhatsApp will open so you can send it directly.",
        "visit_title": "Visit the shop", "visit_body": "Our shop is in Ksar Sghir, near Tangier.", "map": "Directions on Google Maps",
        "how_title": "How to order",
        "how": ["Pick products by the kilo (in 250 g steps) or by the piece.", "Send the order to the shop on WhatsApp from the cart.",
                "We confirm the price, the delivery and the time; you pay on delivery, at the shop or by bank transfer."],
        "related": "From the same shelf", "back": "All products", "order_one": "Order this product now",
        "one_msg": "Hello Almas, I would like: ",
        "privacy": "Privacy policy", "app": "The Almas app on Google Play",
        "nf_title": "This page does not exist", "nf_body": "Go back to the Almas catalogue.",
        "order_head": "🌿 *New Almas order*", "o_name": "🏢 Name", "o_phone": "📞 Phone", "o_address": "📍 Address",
        "o_notes": "📝 Notes", "o_items": "🛒 Items", "o_total": "Total", "o_from": "from the website",
        "langname": "English", "short": "EN", "updated": "at the shop's prices",
    },
}
UNIT_FEED = {"kg": ("au kilo", "(1 kg)"), "piece": ("à la pièce", "(l'unité)")}


def esc(s):
    return html.escape(str(s), quote=True)


def fetch_catalog(offline):
    if not offline:
        try:  # curl first: Cloudflare challenges Python's default client on some networks
            r = subprocess.run(["curl", "-s", "--max-time", "40", "--retry", "3", CFG["catalog_url"]],
                               capture_output=True, timeout=150)
            data = json.loads(r.stdout.decode("utf-8"))
            if data.get("products"):
                return data, "live"
        except Exception as e:
            print("live catalogue unavailable:", e)
        try:
            req = urllib.request.Request(CFG["catalog_url"], headers={"User-Agent": "almas-site-build"})
            data = json.loads(urllib.request.urlopen(req, timeout=40).read().decode("utf-8"))
            if data.get("products"):
                return data, "live"
        except Exception as e:
            print("live catalogue unavailable (urllib):", e)
    data = json.loads((ROOT / "app" / "assets" / "catalog" / "products.json").read_text(encoding="utf-8"))
    return data, "built-in"


def num(x):
    x = float(x)
    return str(int(x)) if x == int(x) else f"{x:.2f}".rstrip("0").rstrip(".")


def money(lang, x):
    return MONEY[lang].format(num(x))


def url(lang, path=""):
    """Site path for a language: Arabic at the root, French and English under /fr and /en."""
    head = PREFIX + ("" if lang == "ar" else "/" + lang)
    return head + "/" + path


def image_of(p):
    """(absolute URL, is_real_photo) of the product's picture."""
    if p.get("img"):
        return f"{CFG['image_base']}/{p['id'][1:]}.jpg?v={p['img']}", True
    if (STATIC / "img" / "photo" / f"{p['id']}.jpg").exists():  # a photo of the product found on the web
        return f"{BASE}/img/photo/{p['id']}.jpg", True
    if (STATIC / "img" / "p" / f"{p['id']}.jpg").exists():
        return f"{BASE}/img/p/{p['id']}.jpg", False
    return f"{BASE}/img/cat/{p['cat']}.jpg", False


def src(p):
    """The picture as a page uses it: our own images by site path (they work before publishing too)."""
    img, real = image_of(p)
    return PREFIX + img[len(BASE):] if img.startswith(BASE) else img


def name(p, lang):
    return p[lang] or p["fr"] or p["ar"]


def pixel_head():
    pid = CFG.get("meta_pixel_id", "").strip()
    if not pid:
        return "<script>window.fbq=window.fbq||function(){};</script>"
    return ("<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?"
            "n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;"
            "n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];"
            "s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');"
            f"fbq('init','{esc(pid)}');fbq('track','PageView');</script>"
            f'<noscript><img height="1" width="1" style="display:none" alt="" '
            f'src="https://www.facebook.com/tr?id={esc(pid)}&ev=PageView&noscript=1"></noscript>')


def head(lang, title, desc, path, image, extra=""):
    t = T[lang]
    alts = "".join(f'<link rel="alternate" hreflang="{l}" href="{BASE}{url(l, path)[len(PREFIX):]}">' for l in LANGS)
    alts += f'<link rel="alternate" hreflang="x-default" href="{BASE}{url("ar", path)[len(PREFIX):]}">'
    verify = ""
    if CFG.get("meta_domain_verification"):
        verify += f'<meta name="facebook-domain-verification" content="{esc(CFG["meta_domain_verification"])}">'
    if CFG.get("google_site_verification"):
        verify += f'<meta name="google-site-verification" content="{esc(CFG["google_site_verification"])}">'
    canonical = BASE + url(lang, path)[len(PREFIX):]
    return f"""<!doctype html>
<html lang="{lang}" dir="{t['dir']}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">{verify}
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<link rel="canonical" href="{canonical}">{alts}
<meta property="og:site_name" content="{esc(t['name'])}">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:url" content="{canonical}">
<meta property="og:image" content="{esc(image)}">
<meta property="og:locale" content="{LOCALE[lang]}">
<meta name="twitter:card" content="summary_large_image">{extra}
<meta name="theme-color" content="#211a16">
<link rel="icon" href="{PREFIX}/img/favicon.png">
<link rel="apple-touch-icon" href="{PREFIX}/img/logo-192.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Cormorant+Garamond:wght@500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="{PREFIX}/assets/site.css?v={STAMP}">
{pixel_head()}
</head>"""


def header(lang, path):
    t = T[lang]
    current = ' aria-current="true"'
    switch = "".join(f'<a href="{url(l, path)}" hreflang="{l}" lang="{l}"{current if l == lang else ""}>'
                     f'<span class="long">{esc(T[l]["langname"])}</span><span class="short">{esc(T[l]["short"])}</span></a>' for l in LANGS)
    return f"""<header class="top">
<div class="wrap top-in">
<a class="brand" href="{url(lang)}"><img src="{PREFIX}/img/logo-192.png" alt="" width="40" height="40"><span><b>{esc(t['name'])}</b><small>{esc(t['kicker'])}</small></span></a>
<a class="nav-pro" href="{url(lang, 'pro/')}">{esc(t['nav_pro'])}</a>
<nav class="langs" aria-label="Language">{switch}</nav>
<button class="cart-btn" type="button" data-open-cart aria-label="{esc(t['cart'])}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6.2"/><circle cx="10" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/></svg><span class="count" data-cart-count>0</span></button>
</div>
</header>"""


def bank_box(lang):
    """The account a bank transfer goes to, with a copy button on the RIB and the IBAN."""
    t, b = T[lang], CFG.get("bank") or {}
    if not b.get("rib"):
        return ""
    row = lambda label, value, copy=False: (
        f'<div class="b-row"><dt>{esc(label)}</dt><dd dir="ltr"><span>{esc(value)}</span>'
        + (f'<button type="button" class="copy" data-copy="{esc(value.replace(" ", ""))}">{esc(t["copy"])}</button>' if copy else "")
        + "</dd></div>")
    return (f'<div class="bank"><p>{esc(t["bank_note"])}</p><dl>'
            + row(t["b_holder"], b["holder"]) + row(t["b_bank"], b["name"]) + row(t["b_rib"], b["rib"], True)
            + (row("IBAN", b["iban"], True) if b.get("iban") else "") + (row("SWIFT", b["swift"]) if b.get("swift") else "")
            + "</dl></div>")


def card_option(lang):
    if not os.environ.get("STRIPE_SECRET_KEY"):
        return ""
    return f'<label class="opt"><input type="radio" name="pay" value="card"> {esc(T[lang]["pay_card"])}</label>'


def thanks(lang):
    """/merci/: where Stripe sends the customer back; asks /api/paid/ whether the card payment went through."""
    t = T[lang]
    return f"""{head(lang, t['ty_title'] + ' | ' + t['name'], t['desc'], 'merci/', f'{BASE}/store/feature-graphic.png',
                     chr(10) + '<meta name="robots" content="noindex">')}
<body>
{header(lang, 'merci/')}
<main class="wrap nf thanks">
<h1>{esc(t['ty_title'])}</h1>
<p data-ty>{esc(t['ty_wait'])}</p>
<div class="cta"><a class="btn wa-btn" data-ty-wa href="https://wa.me/{esc(CFG['whatsapp'])}" rel="noopener">{esc(t['done_wa'])}</a>
<a class="btn ghost" href="{url(lang)}">{esc(t['back'])}</a></div>
</main>
{footer(lang)}
<script>window.TY={json.dumps({k: t[k] for k in ('ty_paid', 'ty_unpaid')}, ensure_ascii=False)};window.TYM={json.dumps(MONEY[lang], ensure_ascii=False)};</script>
<script src="{PREFIX}/assets/thanks.js?v={STAMP}" defer></script>
</body>
</html>
"""


ICON = {
    "pin": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="10" r="2.6" fill="currentColor"/></svg>',
    "phone": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 3h3l1.5 4.2-2 1.3a12 12 0 0 0 6.4 6.4l1.3-2 4.2 1.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4.6 5.2 2 2 0 0 1 6.6 3z" fill="currentColor"/></svg>',
    "wa": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5a9.5 9.5 0 0 0-8.2 14.3L2.5 21.5l4.8-1.3A9.5 9.5 0 1 0 12 2.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8.6 7.6c.3-.6.6-.6.9-.6h.6c.2 0 .5 0 .7.5l.9 2.1c.1.3 0 .5-.1.7l-.6.7c-.2.2-.2.4 0 .7a7 7 0 0 0 3.2 2.8c.3.1.5.1.7-.1l.8-.9c.2-.3.5-.3.8-.2l2 .9c.4.2.4.4.4.6 0 .9-.6 1.8-1.4 2.1-.8.3-1.9.3-4-.6a11 11 0 0 1-4.6-4.2c-.9-1.4-1-2.8-.3-4.5z" fill="currentColor"/></svg>',
    "google": '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>',
    "waze": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5c-4.7 0-8.3 3.4-8.3 7.8 0 1.6.5 3 1.4 4.2-.4 1-1.1 1.6-2 1.9.9.9 2.4 1.2 3.7.7a9.6 9.6 0 0 0 5.2 1.5c4.7 0 8.3-3.4 8.3-7.9S16.7 3.5 12 3.5z" fill="#fff" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="9.4" cy="10" r="1.1" fill="currentColor"/><circle cx="14.6" cy="10" r="1.1" fill="currentColor"/><path d="M9.1 13.1c.8 1 1.8 1.5 2.9 1.5s2.1-.5 2.9-1.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="8.2" cy="20.2" r="1.7" fill="currentColor"/><circle cx="15.8" cy="20.2" r="1.7" fill="currentColor"/></svg>',
    "insta": '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.4" cy="6.6" r="1.3" fill="currentColor"/></svg>',
}


def tile(kind, href, label, sub, sub_ltr=False):
    d = ' dir="ltr"' if sub_ltr else ""
    return (f'<a class="tile tile-{kind}" href="{esc(href)}" rel="noopener"><span class="tile-ic">{ICON[kind]}</span>'
            f'<span class="tile-tx"><b>{esc(label)}</b><small{d}>{sub}</small></span></a>')


def visit(lang):
    """Where the shop is: the map with its pin, directions from where the visitor stands, Google review, Instagram."""
    t = T[lang]
    lat, lng = CFG["geo"]
    # the shop's own Google listing (its cid): the pin carries its name, address and an "open in Maps" card,
    # where bare coordinates show an anonymous pin
    cid = CFG["maps_url"].split("cid=", 1)[1].split("&", 1)[0]
    embed = f"https://maps.google.com/maps?cid={cid}&z=16&hl={lang}&output=embed"
    # built outside the template: quotes nested inside an f-string need Python 3.12, Vercel's may be older
    tiles = [
        tile("pin", f"https://www.google.com/maps/dir/?api=1&destination={lat},{lng}", t["t_dir"], "Google Maps"),
        tile("waze", f"https://waze.com/ul?ll={lat},{lng}&navigate=yes", t["t_waze"], esc(t["t_waze_sub"])),
        tile("phone", "tel:" + CFG["phone"], t["t_call"], esc(CFG["phone_display"]), True),
        tile("wa", "https://wa.me/" + CFG["whatsapp"], t["t_wa"], esc(CFG.get("whatsapp_display", "")), True),
        tile("google", CFG.get("review_url") or CFG["maps_url"], t["t_review"], '<span class="stars">★★★★★</span>'),
    ]
    if CFG.get("instagram"):
        tiles.append(tile("insta", "https://www.instagram.com/" + CFG["instagram"] + "/", t["t_insta"],
                          "@" + esc(CFG["instagram"]), True))
    tiles_html = chr(10).join(tiles)
    return f"""<section class="visit" id="visit">
<div class="wrap visit-grid">
<div>
<h2>{esc(t['visit_title'])}</h2><p>{esc(t['visit_body'])}</p>
<div class="tiles">
{tiles_html}
</div>
</div>
<iframe class="map" title="{esc(t['visit_title'])}" src="{esc(embed)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
</div>
</section>"""


def pro_page(lang, products, cats):
    """Restaurants, hotels, wedding organisers: what Almas offers them, its kitchen best sellers, a quote form."""
    t = T[lang]
    tops = sorted([p for p in products if p["cat"] in ("spices", "blends", "herbs")], key=lambda p: -(p.get("rank") or 0))[:8]
    grid = "".join(card(lang, p, cats) for p in tops)
    art = "".join(f'<a href="{url(lang, "p/" + p["id"] + "/")}" tabindex="-1"><img src="{esc(src(p))}" alt="" width="260" height="260"></a>'
                  for p in tops[:4])
    points = "".join(f"<li>{esc(x)}</li>" for x in t["pro_points"])
    opts = lambda xs: "".join(f'<option>{esc(x)}</option>' for x in xs)
    return f"""{head(lang, t['pro_title'] + ' | ' + t['name'], t['pro_lead'], 'pro/', f'{BASE}/store/feature-graphic.png')}
<body>
{header(lang, 'pro/')}
<main>
<section class="hero"><div class="wrap hero-grid">
<div class="hero-in">
<p class="kicker">{esc(t['nav_pro'])}</p>
<h1>{esc(t['pro_title'])}</h1>
<p class="lead">{esc(t['pro_lead'])}</p>
<ul class="ticks">{points}</ul>
<div class="cta"><a class="btn" href="#quote">{esc(t['q_title'])}</a></div>
</div>
<div class="hero-art" aria-hidden="true">{art}</div>
</div></section>
<section class="wrap related"><h2>{esc(t['pro_top'])}</h2><ul class="grid">{grid}</ul></section>
<section class="band" id="quote"><div class="wrap quote">
<h2>{esc(t['q_title'])}</h2><p>{esc(t['q_intro'])}</p>
<form data-quote-form>
<div class="q-grid">
<label>{esc(t['q_type'])}<select name="type">{opts(t['q_types'])}</select></label>
<label>{esc(t['q_business'])}<input name="business" required></label>
<label>{esc(t['q_contact'])}<input name="contact" autocomplete="name"></label>
<label>{esc(t['q_phone'])}<input name="phone" type="tel" inputmode="tel" autocomplete="tel" required></label>
<label>{esc(t['q_city'])}<input name="city" autocomplete="address-level2"></label>
<label>{esc(t['q_freq'])}<select name="freq">{opts(t['q_freqs'])}</select></label>
<label>{esc(t['q_date'])}<input name="date" type="date"></label>
<label>{esc(t['q_guests'])}<input name="guests" type="number" min="0" inputmode="numeric"></label>
</div>
<label>{esc(t['q_items'])}<textarea name="items" rows="4" required placeholder="{esc(t['q_items_ph'])}"></textarea></label>
<input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
<button class="btn" type="submit" data-q-send>{esc(t['q_send'])}</button>
<p class="note" data-q-done hidden>{esc(t['q_done'])}</p>
</form>
</div></section>
{visit(lang)}
</main>
{footer(lang)}
{cart_drawer(lang)}
{data_tag(lang)}
<script src="{PREFIX}/assets/site.js?v={STAMP}" defer></script>
</body>
</html>
"""


def cart_drawer(lang):
    t = T[lang]
    return f"""<div class="drawer" data-drawer hidden>
<div class="drawer-bg" data-close-cart></div>
<aside class="drawer-in" role="dialog" aria-modal="true" aria-label="{esc(t['cart'])}">
<div class="drawer-head"><h2>{esc(t['cart'])}</h2><button type="button" class="x" data-close-cart aria-label="×">×</button></div>
<div class="drawer-body">
<div data-cart-empty class="empty"><p><b>{esc(t['cart_empty'])}</b></p><p>{esc(t['cart_empty_sub'])}</p></div>
<ul class="lines" data-cart-lines></ul>
<div data-cart-form hidden>
<p class="total"><span>{esc(t['subtotal'])}</span><b data-cart-total></b></p>
<form data-order-form>
<label>{esc(t['f_name'])}<input name="name" autocomplete="name" required></label>
<label>{esc(t['f_phone'])}<input name="phone" type="tel" autocomplete="tel" inputmode="tel" required></label>
<label>{esc(t['f_address'])}<input name="address" autocomplete="street-address"></label>
<label>{esc(t['f_notes'])}<textarea name="notes" rows="2"></textarea></label>
<fieldset class="pay"><legend>{esc(t['pay_title'])}</legend>
<label class="opt"><input type="radio" name="pay" value="cod" checked> {esc(t['pay_cod'])}</label>
<label class="opt"><input type="radio" name="pay" value="bank"> {esc(t['pay_bank'])}</label>
{card_option(lang)}
</fieldset>
<div data-bank hidden>{bank_box(lang)}</div>
<input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
<p class="note">{esc(t['order_note'])}<br>{esc(t['pay_note'])}</p>
<button class="btn" type="submit" data-send>{esc(t['send'])}</button>
</form>
</div>
<div class="done" data-done hidden>
<h3>{esc(t['done_title'])}</h3>
<p data-done-body></p>
<div data-done-bank hidden>{bank_box(lang)}</div>
<a class="btn wa-btn" data-done-wa href="https://wa.me/{esc(CFG['whatsapp'])}" rel="noopener">{esc(t['done_wa'])}</a>
</div>
</div>
</aside>
</div>"""


def footer(lang):
    t = T[lang]
    play = f'<a href="{esc(CFG["play_url"])}" rel="noopener">{esc(t["app"])}</a>' if CFG.get("play_url") else ""
    return f"""<footer class="foot">
<div class="wrap foot-in">
<div><b>{esc(t['name'])}</b><p>{esc(t['visit_body'])}</p></div>
<div class="foot-links">
<a href="tel:{esc(CFG['phone'])}" dir="ltr">{esc(CFG['phone_display'])}</a>
<a href="https://wa.me/{esc(CFG['whatsapp'])}" rel="noopener">WhatsApp <span dir="ltr">{esc(CFG.get('whatsapp_display', ''))}</span></a>
<a href="{esc(CFG['maps_url'])}" rel="noopener">{esc(t['map'])}</a>
<a href="{esc(CFG.get('review_url') or CFG['maps_url'])}" rel="noopener">★ {esc(t['review'])}</a>
{f'<a href="https://www.instagram.com/{esc(CFG["instagram"])}/" rel="noopener">Instagram @{esc(CFG["instagram"])}</a>' if CFG.get("instagram") else ""}
{play}
<a href="{PREFIX}/privacy-policy.html">{esc(t['privacy'])}</a>
</div>
</div>
<p class="wrap copy">© {datetime.now().year} {esc(t['name'])}</p>
</footer>"""


def page_data(lang, products, cats):
    """What site.js needs: the products in this language, the WhatsApp number, the strings for the order."""
    t = T[lang]
    data = {
        "lang": lang, "wa": CFG["whatsapp"], "feed": CFG["catalog_url"], "api": CFG.get("order_api", ""),
        "qapi": CFG.get("quote_api", ""),
        "money": MONEY[lang],
        "s": {k: t[k] for k in ("order_head", "o_name", "o_phone", "o_address", "o_notes", "o_items", "o_total",
                                "o_from", "add", "added", "remove", "kg", "piece", "one_msg", "o_pay", "o_number",
                                "pay_cod", "pay_bank", "pay_card", "card_fail", "sending", "send", "done_body", "fail",
                                "copied", "copy", "q_send", "q_fail", "sending")},
        "p": {p["id"]: {"n": name(p, lang), "ar": p["ar"], "price": p["price"], "u": p["unit"]} for p in products},
    }
    return data


def data_tag(lang):
    """One shared file per language instead of the product list inlined in all 129 pages of that language."""
    return f'<script src="{PREFIX}/assets/data-{lang}.js?v={STAMP}" defer></script>'


def card(lang, p, cats):
    t = T[lang]
    img, _ = image_of(p)
    cat = cats[p["cat"]]
    unit = t["kg"] if p["unit"] == "kg" else t["piece"]
    other = p["ar"] if lang != "ar" else p["fr"]
    return f"""<li class="card" data-cat="{p['cat']}" data-search="{esc(' '.join([p['ar'], p['fr'], p['en']]).lower())}" style="--c:{cat['color']}">
<a class="card-link" href="{url(lang, 'p/' + p['id'] + '/')}">
<img src="{esc(src(p))}" alt="{esc(name(p, lang))}" loading="lazy" width="400" height="400">
<span class="card-name">{esc(name(p, lang))}</span>
<span class="card-other" lang="{'fr' if lang == 'ar' else 'ar'}">{esc(other)}</span>
</a>
<div class="card-buy"><span class="price"><b data-price="{p['id']}">{esc(money(lang, p['price']))}</b> <small>{esc(unit)}</small></span>
<button type="button" class="add" data-add="{p['id']}" aria-label="{esc(t['add'])} {esc(name(p, lang))}">+</button></div>
</li>"""


def home(lang, products, cats, stamp_day):
    t = T[lang]
    order = list(cats)
    shelves = "".join(f'<button type="button" data-filter="{c}" style="--c:{cats[c]["color"]}">{esc(cats[c][lang])}</button>'
                      for c in order)
    grid = "".join(card(lang, p, cats) for p in products)
    how = "".join(f"<li>{esc(x)}</li>" for x in t["how"])
    facts = t["facts"].format(n=len(products), s=len(cats), d=stamp_day)
    biz_link = f"https://wa.me/{CFG['whatsapp']}?text=" + urllib.parse.quote(t["biz_msg"])
    # the best seller of four shelves, by the till's own sales ranking
    tops = [max((p for p in products if p["cat"] == c), key=lambda p: p.get("rank") or 0)
            for c in ("spices", "herbs", "blends", "seeds") if any(p["cat"] == c for p in products)]
    art = "".join(f'<a href="{url(lang, "p/" + p["id"] + "/")}" tabindex="-1"><img src="{esc(src(p))}" alt="" width="260" height="260"></a>'
                  for p in tops)
    ld = {
        "@context": "https://schema.org", "@type": "Store", "name": t["name"], "alternateName": [CFG["brand_ar"], CFG["brand_fr"]],
        "url": BASE + url(lang)[len(PREFIX):], "telephone": CFG["phone"], "image": f"{BASE}/store/feature-graphic.png",
        "logo": f"{BASE}/img/logo-512.png", "hasMap": CFG["maps_url"], "priceRange": "DH",
        "address": {"@type": "PostalAddress", "addressLocality": "Ksar Sghir", "addressRegion": "Tanger-Tétouan-Al Hoceïma",
                    "addressCountry": "MA"},
        "paymentAccepted": "Cash, Bank transfer",
        "geo": {"@type": "GeoCoordinates", "latitude": CFG["geo"][0], "longitude": CFG["geo"][1]},
        "sameAs": [f"https://www.instagram.com/{CFG['instagram']}/"] if CFG.get("instagram") else [],
    }
    return f"""{head(lang, t['title'], t['desc'], '', f'{BASE}/store/feature-graphic.png')}
<body>
{header(lang, '')}
<main>
<section class="hero">
<div class="wrap hero-grid">
<div class="hero-in">
<p class="kicker">{esc(t['kicker'])}</p>
<h1>{esc(t['h1'])}</h1>
<p class="lead">{esc(t['lead'])}</p>
<div class="cta"><a class="btn" href="#products">{esc(t['browse'])}</a>
<a class="btn ghost wa-link" href="https://wa.me/{CFG['whatsapp']}" rel="noopener">{esc(t['wa'])}</a></div>
<p class="facts">{esc(facts)}</p>
</div>
<div class="hero-art" aria-hidden="true">{art}</div>
</div>
</section>
<section id="products" class="shop">
<div class="wrap">
<div class="tools">
<input type="search" data-search-box placeholder="{esc(t['search'])}" aria-label="{esc(t['search'])}">
<div class="chips" role="toolbar"><button type="button" data-filter="" aria-pressed="true">{esc(t['all'])}</button>{shelves}</div>
</div>
<ul class="grid" data-grid>{grid}</ul>
<p class="none" data-none hidden>{esc(t['none'])}</p>
</div>
</section>
<section class="band">
<div class="wrap two">
<div><h2>{esc(t['how_title'])}</h2><ol class="how">{how}</ol></div>
<div class="biz"><h2>{esc(t['biz_title'])}</h2><p>{esc(t['biz_body'])}</p><div class="cta"><a class="btn" href="{url(lang, 'pro/')}">{esc(t['q_title'])}</a> <a class="btn ghost wa-link" href="{esc(biz_link)}" rel="noopener">WhatsApp</a></div></div>
</div>
</section>
{visit(lang)}
</main>
{footer(lang)}
{cart_drawer(lang)}
{data_tag(lang)}
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
<script src="{PREFIX}/assets/site.js?v={STAMP}" defer></script>
</body>
</html>
"""


def product_page(lang, p, products, cats):
    t = T[lang]
    cat = cats[p["cat"]]
    img, real = image_of(p)
    n = name(p, lang)
    unit = t["kg"] if p["unit"] == "kg" else t["piece"]
    path = "p/" + p["id"] + "/"
    title = f"{n} – {money(lang, p['price'])} {unit} | {t['name']}"
    desc = f"{n} ({p['ar'] if lang != 'ar' else p['fr']}), {money(lang, p['price'])} {unit}. {t['order_note']}"
    names = "".join(f'<li lang="{l}"><span>{esc(T[l]["langname"])}</span> {esc(p[l])}</li>' for l in LANGS if p.get(l))
    same = [q for q in products if q["cat"] == p["cat"] and q["id"] != p["id"]][:8]
    related = "".join(card(lang, q, cats) for q in same)
    one = f"https://wa.me/{CFG['whatsapp']}?text=" + urllib.parse.quote(t["one_msg"] + p["ar"] + ("" if lang == "ar" else f" ({n})"))
    extra = (f'\n<meta property="og:type" content="product">'
             f'\n<meta property="product:retailer_item_id" content="{p["id"]}">'
             f'\n<meta property="product:price:amount" content="{num(p["price"])}">'
             f'\n<meta property="product:price:currency" content="MAD">'
             f'\n<meta property="product:availability" content="in stock">'
             f'\n<meta property="product:condition" content="new">'
             f'\n<meta property="product:brand" content="Almas">')
    ld = {
        "@context": "https://schema.org", "@type": "Product", "productID": p["id"], "sku": p["id"], "name": n,
        "alternateName": [p[l] for l in LANGS if p.get(l) and p[l] != n], "image": img, "brand": {"@type": "Brand", "name": "Almas"},
        "category": cat[lang], "description": desc,
        "offers": {"@type": "Offer", "price": num(p["price"]), "priceCurrency": "MAD", "availability": "https://schema.org/InStock",
                   "itemCondition": "https://schema.org/NewCondition", "url": BASE + url(lang, path)[len(PREFIX):],
                   "seller": {"@type": "Organization", "name": t["name"]}},
    }
    crumbs = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": t["name"], "item": BASE + url(lang)[len(PREFIX):]},
        {"@type": "ListItem", "position": 2, "name": cat[lang], "item": BASE + url(lang)[len(PREFIX):] + "#products"},
        {"@type": "ListItem", "position": 3, "name": n}]}
    return f"""{head(lang, title, desc, path, img, extra)}
<body data-product="{p['id']}">
{header(lang, path)}
<main>
<div class="wrap crumbs"><a href="{url(lang)}#products">← {esc(t['back'])}</a> · <span style="color:{cat['color']}">{esc(cat[lang])}</span></div>
<section class="wrap product" style="--c:{cat['color']}">
<div class="product-img"><img src="{esc(src(p))}" alt="{esc(n)}" width="800" height="800"></div>
<div class="product-info">
<p class="kicker">{esc(cat[lang])}</p>
<h1>{esc(n)}</h1>
<ul class="names">{names}</ul>
<p class="big-price"><b data-price="{p['id']}">{esc(money(lang, p['price']))}</b> <small>{esc(unit)}</small></p>
<div class="qty" data-qty-for="{p['id']}"><button type="button" data-step="-1" aria-label="-">−</button><output data-qty-label></output><button type="button" data-step="1" aria-label="+">+</button></div>
<div class="cta"><button type="button" class="btn" data-add-qty="{p['id']}">{esc(t['add'])}</button>
<a class="btn ghost wa-link" data-order-one="{p['id']}" href="{esc(one)}" rel="noopener">{esc(t['order_one'])}</a></div>
<p class="note">{esc(t['order_note'])}<br>{esc(t['pay_note'])}</p>
</div>
</section>
<section class="wrap related"><h2>{esc(t['related'])}</h2><ul class="grid">{related}</ul></section>
</main>
{footer(lang)}
{cart_drawer(lang)}
{data_tag(lang)}
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
<script type="application/ld+json">{json.dumps(crumbs, ensure_ascii=False)}</script>
<script src="{PREFIX}/assets/site.js?v={STAMP}" defer></script>
</body>
</html>
"""


def not_found():
    t = T["ar"]
    links = " · ".join(f'<a href="{url(l)}" lang="{l}">{esc(T[l]["nf_body"])}</a>' for l in LANGS)
    return f"""{head('ar', t['nf_title'], t['desc'], '', f'{BASE}/store/feature-graphic.png')}
<body>
{header('ar', '')}
<main class="wrap nf"><h1>{esc(t['nf_title'])}</h1><p>{links}</p></main>
{footer('ar')}
</body>
</html>
"""


def feeds(products, cats):
    """The Meta catalogue: feed/meta.csv (French, the main feed) and the Arabic and English language overrides."""
    out = OUT / "feed"
    out.mkdir(exist_ok=True)
    cols = ["id", "title", "description", "availability", "condition", "price", "link", "image_link", "brand",
            "google_product_category", "product_type", "custom_label_0", "custom_label_1"]
    with open(out / "meta.csv", "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, lineterminator=chr(10))  # LF on every OS, so the daily Linux build does not rewrite it
        w.writerow(cols)
        for p in products:
            how, size = UNIT_FEED.get(p["unit"], UNIT_FEED["piece"])
            img, real = image_of(p)
            w.writerow([
                p["id"], f"{p['fr']} {size}"[:150],
                f"{p['fr']} ({p['ar']}), vendu {how} par Almas, herboristerie à Ksar Sghir près de Tanger. "
                f"Commande en ligne ou sur WhatsApp ; paiement à la livraison, à la boutique ou par virement.",
                "in stock", "new", f"{float(p['price']):.2f} MAD", BASE + url("fr", "p/" + p["id"] + "/")[len(PREFIX):],
                img, "Almas", GOOGLE_CAT.get(p["cat"], GOOGLE_CAT["pantry"]), cats[p["cat"]]["fr"],
                cats[p["cat"]]["fr"], "photo" if real else "carte"])
    over = {"ar": ("ar_AR", "{ar} {size}", "{ar}، كيتباع {how} عند معشبة ألماس فالقصر الصغير قرب طنجة. الطلب فالموقع أو عبر واتساب، والخلاص عند الاستلام أو فالمحل أو بتحويل بنكي.",
                   {"kg": ("بالكيلو", "(1 كيلو)"), "piece": ("بالوحدة", "(للوحدة)")}),
            "en": ("en_XX", "{en} {size}", "{en} ({ar}), sold {how} by Almas, a spice and herb shop in Ksar Sghir near Tangier. Order online or on WhatsApp; pay on delivery, at the shop or by bank transfer.",
                   {"kg": ("by the kilo", "(1 kg)"), "piece": ("by the piece", "(each)")})}
    for lang, (code, title, desc, units) in over.items():
        with open(out / f"meta-{lang}.csv", "w", encoding="utf-8", newline="") as f:
            w = csv.writer(f, lineterminator=chr(10))  # LF on every OS, so the daily Linux build does not rewrite it
            w.writerow(["id", "override", "title", "description", "link"])
            for p in products:
                how, size = units.get(p["unit"], units["piece"])
                w.writerow([p["id"], code, title.format(size=size, **p)[:150], desc.format(how=how, **p),
                            BASE + url(lang, "p/" + p["id"] + "/")[len(PREFIX):]])


def sitemap(products):
    paths = ["", "pro/"] + ["p/" + p["id"] + "/" for p in products]
    rows = []
    for path in paths:
        for lang in LANGS:
            alts = "".join(f'<xhtml:link rel="alternate" hreflang="{l}" href="{BASE}{url(l, path)[len(PREFIX):]}"/>' for l in LANGS)
            rows.append(f"<url><loc>{BASE}{url(lang, path)[len(PREFIX):]}</loc>{alts}</url>")
    return ('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
            'xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' + "\n".join(rows) + "\n</urlset>\n")


def write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(text.encode("utf-8"))


# asset version: changes only when the design does, so a daily rebuild does not rewrite every page
STAMP = hashlib.sha256(b"".join((HERE / "assets" / n).read_bytes() for n in ("site.css", "site.js", "thanks.js"))).hexdigest()[:10]


def main():
    data, source = fetch_catalog("--offline" in sys.argv)
    cats = {c["id"]: c for c in data["categories"]}
    products = [p for p in data["products"] if p.get("cat") in cats and p.get("price")]
    order = {c: i for i, c in enumerate(cats)}
    products.sort(key=lambda p: (order[p["cat"]], -(p.get("rank") or 0), p["fr"]))
    # every build reads the till's prices afresh (Vercel builds on each push and once a day), so the day shown
    # is the day they were last read
    now = datetime.now(timezone.utc)
    day = {"ar": now.strftime("%d/%m/%Y"), "fr": now.strftime("%d/%m/%Y"), "en": now.strftime("%Y-%m-%d")}

    # a fresh folder each time: a product the shop removed leaves no page behind for an ad to land on
    shutil.rmtree(OUT, ignore_errors=True)
    shutil.copytree(STATIC, OUT)
    shutil.copyfile(DOCS / "privacy-policy.html", OUT / "privacy-policy.html")
    shutil.copytree(DOCS / "store", OUT / "store")
    (OUT / "assets").mkdir(parents=True, exist_ok=True)
    for name_ in ("site.css", "site.js", "thanks.js"):
        shutil.copyfile(HERE / "assets" / name_, OUT / "assets" / name_)

    for lang in LANGS:
        base = OUT if lang == "ar" else OUT / lang
        write(OUT / "assets" / f"data-{lang}.js",
              "window.ALMAS=" + json.dumps(page_data(lang, products, cats), ensure_ascii=False) + ";" + chr(10))
        write(base / "index.html", home(lang, products, cats, day[lang]))
        write(base / "merci" / "index.html", thanks(lang))
        write(base / "pro" / "index.html", pro_page(lang, products, cats))
        for p in products:
            write(base / "p" / p["id"] / "index.html", product_page(lang, p, products, cats))
    write(OUT / "404.html", not_found())
    feeds(products, cats)
    write(OUT / "sitemap.xml", sitemap(products))
    write(OUT / "robots.txt", f"User-agent: *\nAllow: /\nSitemap: {BASE}/sitemap.xml\n")
    missing = [p["id"] for p in products if not image_of(p)[0].startswith(CFG["image_base"])
               and not (STATIC / "img" / "p" / f"{p['id']}.jpg").exists()]
    print(f"built {len(products)} products x {len(LANGS)} languages from the {source} catalogue; "
          f"{sum(1 for p in products if image_of(p)[1])} with a photo; {len(missing)} without a card "
          f"(shelf card used){': ' + ', '.join(missing) if missing else ''}")


if __name__ == "__main__":
    main()
