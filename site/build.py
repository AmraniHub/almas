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
LANGS = ("ar", "fr", "en", "es")
LOCALE = {"ar": "ar_MA", "fr": "fr_MA", "en": "en_US", "es": "es_ES"}
MONEY = {"ar": "{} درهم", "fr": "{} DH", "en": "{} MAD", "es": "{} DH"}
# Customer-facing names: Modern Standard Arabic and Spanish (the till's own Arabic name stays in orders, as "t")
NAMES = json.loads((HERE / "names.json").read_text(encoding="utf-8"))
PACKS = json.loads((HERE / "packs.json").read_text(encoding="utf-8"))
# a short description of every product in the 4 languages (natural product, aroma, use; no health claims)
DESC = json.loads((HERE / "descriptions.json").read_text(encoding="utf-8")) if (HERE / "descriptions.json").exists() else {}


def about(p, lang):
    return (DESC.get(p["id"]) or {}).get(lang, "")
MAD_PER_EUR = 10.9  # replaced at build time by the day's rate (open.er-api.com); this is only the fallback


def fetch_rate():
    global MAD_PER_EUR
    try:
        r = subprocess.run(["curl", "-s", "--max-time", "20", "https://open.er-api.com/v6/latest/EUR"], capture_output=True, timeout=40)
        rate = float(json.loads(r.stdout.decode("utf-8"))["rates"]["MAD"])
        if 8 < rate < 15:
            MAD_PER_EUR = rate
    except Exception as e:
        print("euro rate unavailable, using", MAD_PER_EUR, e)

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
        "title": "معشبة ألماس | توابل وأعشاب بالكيلوغرام في القصر الصغير",
        "desc": "توابل وأعشاب من متجرنا في القصر الصغير، للمنازل والمطاعم والفنادق وقاعات الأفراح، بأسعار المتجر. اطلب عبر الموقع أو واتساب.",
        "kicker": "القصر الصغير، قرب طنجة",
        "h1": "توابل وأعشاب بالكيلوغرام من متجرنا في القصر الصغير",
        "lead": "توابل وأعشاب من متجرنا في القصر الصغير، للمنازل والمطاعم والفنادق وقاعات الأفراح، بأسعار المتجر.",
        "browse": "تصفح المنتجات",
        "wa": "اطلب عبر واتساب",
        "call": "اتصل بنا",
        "facts": "{n} منتجًا · {s} أقسام",
        "search": "ابحث عن منتج…",
        "all": "الكل",
        "none": "لم نجد أي منتج بهذا الاسم.",
        "kg": "للكيلوغرام",
        "piece": "للقطعة",
        "add": "أضف إلى السلة",
        "added": "تمت الإضافة",
        "cart": "السلة",
        "cart_empty": "سلتك فارغة",
        "cart_empty_sub": "أضف منتجات من الكتالوج، ثم أرسل الطلب إلى المتجر.",
        "order_note": "يصل طلبك إلى المتجر مباشرة، ونؤكد معك السعر والتوصيل والموعد عبر واتساب.",
        "pay_note": "الدفع عند الاستلام أو في المتجر أو بالتحويل البنكي، ويُتفق معك على التوصيل عبر واتساب.",
        "f_name": "الاسم أو اسم المؤسسة",
        "f_phone": "رقم الهاتف",
        "f_address": "العنوان",
        "f_notes": "ملاحظات (اختياري)",
        "send": "تأكيد الطلب",
        "subtotal": "المجموع",
        "remove": "حذف",
        "pay_title": "طريقة الدفع",
        "pay_cod": "عند الاستلام أو في المتجر",
        "pay_bank": "تحويل بنكي",
        "bank_note": "حوّل المبلغ إلى هذا الحساب مع ذكر رقم الطلب في سبب التحويل، ثم أرسل إلينا الإيصال عبر واتساب.",
        "b_holder": "المستفيد",
        "b_bank": "البنك",
        "b_rib": "RIB",
        "copy": "نسخ",
        "copied": "تم النسخ",
        "sending": "جارٍ إرسال الطلب…",
        "done_title": "تم استلام طلبك",
        "done_body": "رقم الطلب: {n} · المجموع: {t}. سنتواصل معك لتأكيد التوصيل.",
        "done_wa": "المتابعة عبر واتساب",
        "fail": "تعذّر إرسال الطلب. سيُفتح واتساب لإرساله مباشرة.",
        "o_pay": "💳 الدفع",
        "o_number": "🧾 رقم الطلب",
        "pay_card": "بطاقة بنكية (دفع آمن عبر الإنترنت)",
        "card_fail": "الدفع بالبطاقة غير متاح لهذا الطلب. يُرجى اختيار طريقة دفع أخرى.",
        "ty_title": "شكرًا لك",
        "ty_wait": "جارٍ التحقق من الدفع…",
        "ty_paid": "تم استلام دفعة الطلب {n} ({t}). سنتواصل معك لتأكيد التوصيل.",
        "ty_unpaid": "لم يصلنا تأكيد الدفع بعد. إن كنت قد دفعت، فأرسل إلينا رقم الطلب عبر واتساب.",
        "biz_title": "المطاعم والفنادق وقاعات الأفراح",
        "biz_body": "اطلب بالكيلوغرام باسم مؤسستك وعنوانها. وللكميات الكبيرة، اطلب منا عرض سعر عبر واتساب.",
        "biz_cta": "اطلب سعر الكميات الكبيرة",
        "biz_msg": "السلام عليكم، لديّ مؤسسة وأرغب في معرفة سعر كميات كبيرة من: ",
        "nav_pro": "للمشاريع",
        "search_ph": "ابحث بالعربية أو الفرنسية أو الإنجليزية أو الإسبانية…",
        "search_none": "لا توجد نتائج. جرّب اسمًا آخر.",
        "search_pop": "الأكثر طلبًا",
        "search_btn": "بحث",
        "upsell": "أكمل طلبك",
        "photo": "صورة",
        "t_waze": "Waze",
        "t_waze_sub": "القيادة إلى المتجر",
        "t_dir": "الطريق إلى المتجر",
        "t_call": "اتصل بنا",
        "t_wa": "واتساب",
        "t_review": "قيّمنا على Google",
        "t_insta": "إنستغرام",
        "review": "قيّم ألماس على Google",
        "insta": "إنستغرام",
        "directions": "الطريق إلى المتجر",
        "pro_title": "للمطاعم والفنادق ومنظمي الأعراس",
        "pro_lead": "توابل وأعشاب وخلطات بالكيلوغرام للمطابخ المهنية والأعراس والمناسبات، من متجرنا في القصر الصغير قرب طنجة.",
        "pro_points": ["بالكيلوغرام، وبأسعار المتجر.", "للكميات الكبيرة، اطلب منا عرض سعر.", "الدفع عند الاستلام أو في المتجر أو بالتحويل البنكي.", "يُتفق معك على التوصيل عبر واتساب."],
        "pro_top": "الأكثر طلبًا في المطابخ",
        "q_title": "اطلب عرض سعر",
        "q_intro": "أخبرنا بما تحتاجه وبالكميات، وسنرد عليك بالسعر عبر واتساب.",
        "q_type": "نوع النشاط",
        "q_types": ["مطعم", "فندق", "أعراس ومناسبات", "متعهد حفلات", "آخر"],
        "q_business": "اسم المؤسسة",
        "q_contact": "الاسم",
        "q_phone": "الهاتف",
        "q_city": "المدينة",
        "q_date": "تاريخ المناسبة (إن وُجدت)",
        "q_guests": "عدد الضيوف (للمناسبات)",
        "q_freq": "وتيرة الطلب",
        "q_freqs": ["مرة واحدة", "أسبوعيًا", "شهريًا"],
        "q_items": "المنتجات والكميات",
        "q_items_ph": "مثال: 5 كلغ كمون، 3 كلغ كركم، 2 كلغ رأس الحانوت",
        "q_send": "إرسال الطلب",
        "q_done": "تم استلام طلبك، وسنرد عليك بالسعر عبر واتساب.",
        "q_fail": "تعذّر إرسال الطلب. سيُفتح واتساب لإرساله مباشرة.",
        "visit_title": "زورونا في المتجر",
        "visit_body": "متجرنا في القصر الصغير، قرب طنجة.",
        "map": "الطريق على خرائط Google",
        "how_title": "كيف تطلب",
        "how": ["اختر المنتجات بالكيلوغرام (بمقدار 250 غرامًا) أو بالقطعة.", "أرسل الطلب إلى المتجر من السلة.", "نؤكد معك السعر والتوصيل والموعد، والدفع عند الاستلام أو في المتجر أو بالتحويل البنكي."],
        "related": "من القسم نفسه",
        "back": "كل المنتجات",
        "order_one": "اطلب هذا المنتج الآن",
        "one_msg": "السلام عليكم، أرغب في: ",
        "privacy": "سياسة الخصوصية",
        "app": "تطبيق ألماس على Google Play",
        "nf_title": "هذه الصفحة غير موجودة",
        "nf_body": "العودة إلى كتالوج ألماس.",
        "order_head": "🌿 *طلب جديد من ألماس*",
        "o_name": "🏢 الاسم",
        "o_phone": "📞 الهاتف",
        "o_address": "📍 العنوان",
        "o_notes": "📝 ملاحظات",
        "o_items": "🛒 المنتجات",
        "o_total": "المجموع",
        "o_from": "من الموقع",
        "langname": "العربية",
        "short": "ع",
        "updated": "بأسعار المتجر",
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
        "nav_pro": "Professionnels", "search_ph": "Chercher en arabe, français, anglais ou espagnol…", "search_none": "Aucun résultat. Essayez un autre nom.", "search_pop": "Les plus demandés", "search_btn": "Rechercher", "upsell": "Complétez votre commande", "photo": "Photo", "t_waze": "Waze", "t_waze_sub": "Y aller en voiture", "t_dir": "Itinéraire", "t_call": "Appeler", "t_wa": "WhatsApp", "t_review": "Avis Google", "t_insta": "Instagram",
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
        "nav_pro": "Businesses", "search_ph": "Search in Arabic, French, English or Spanish…", "search_none": "No result. Try another name.", "search_pop": "Most ordered", "search_btn": "Search", "upsell": "Complete your order", "photo": "Photo", "t_waze": "Waze", "t_waze_sub": "Drive there", "t_dir": "Directions", "t_call": "Call", "t_wa": "WhatsApp", "t_review": "Google review", "t_insta": "Instagram",
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
    "es": {
        "dir": "ltr", "name": CFG["brand_es"],
        "title": "Almas | Especias y hierbas al kilo en Ksar Sghir, cerca de Tánger",
        "desc": "Especias y hierbas de nuestra tienda en Ksar Sghir, para casa, restaurantes, hoteles y salones de bodas. Los precios de la tienda; pide en la web o por WhatsApp.",
        "kicker": "Ksar Sghir, cerca de Tánger",
        "h1": "Especias y hierbas al kilo, desde nuestra tienda de Ksar Sghir",
        "lead": "Especias y hierbas de nuestra tienda en Ksar Sghir, para casa, restaurantes, hoteles y salones de bodas. Los precios son los de la tienda.",
        "browse": "Ver los productos",
        "wa": "Pedir por WhatsApp",
        "call": "Llamarnos",
        "facts": "{n} productos · {s} secciones",
        "search": "Buscar un producto…",
        "all": "Todo",
        "none": "Ningún producto con ese nombre.",
        "kg": "el kilo",
        "piece": "la unidad",
        "add": "Añadir",
        "added": "Añadido",
        "cart": "Cesta",
        "cart_empty": "Tu cesta está vacía",
        "cart_empty_sub": "Añade productos del catálogo y envía el pedido a la tienda.",
        "order_note": "Tu pedido llega directamente a la tienda. Confirmamos contigo el precio, la entrega y la hora por WhatsApp.",
        "pay_note": "Pagas a la entrega, en la tienda o por transferencia bancaria. La entrega se acuerda contigo por WhatsApp.",
        "f_name": "Nombre o establecimiento",
        "f_phone": "Teléfono",
        "f_address": "Dirección",
        "f_notes": "Notas (opcional)",
        "send": "Confirmar el pedido",
        "subtotal": "Total",
        "remove": "Quitar",
        "pay_title": "Pago",
        "pay_cod": "A la entrega o en la tienda",
        "pay_bank": "Transferencia bancaria",
        "bank_note": "Transfiere el importe a esta cuenta con el número de pedido como concepto y envíanos el justificante por WhatsApp.",
        "b_holder": "Beneficiario",
        "b_bank": "Banco",
        "b_rib": "RIB",
        "copy": "Copiar",
        "copied": "Copiado",
        "sending": "Enviando el pedido…",
        "done_title": "Pedido recibido",
        "done_body": "Pedido {n} · total {t}. Te contactamos para confirmar la entrega.",
        "done_wa": "Seguir por WhatsApp",
        "fail": "No se pudo enviar el pedido. Se abrirá WhatsApp para enviarlo directamente.",
        "o_pay": "💳 Pago",
        "o_number": "🧾 Pedido",
        "pay_card": "Tarjeta bancaria (pago seguro en línea)",
        "card_fail": "El pago con tarjeta no está disponible para este pedido. Elige otra forma de pago.",
        "ty_title": "¡Gracias!",
        "ty_wait": "Comprobando el pago…",
        "ty_paid": "Pago recibido para el pedido {n} ({t}). Te contactamos para confirmar la entrega.",
        "ty_unpaid": "Aún no tenemos la confirmación del pago. Si ya pagaste, envíanos el número de pedido por WhatsApp.",
        "biz_title": "Restaurantes, hoteles, salones de bodas",
        "biz_body": "Pide al kilo con el nombre y la dirección de tu establecimiento. Para grandes cantidades, pídenos un precio por WhatsApp.",
        "biz_cta": "Pedir precio para grandes cantidades",
        "biz_msg": "Hola Almas, tengo un establecimiento y quisiera un precio para grandes cantidades de: ",
        "nav_pro": "Profesionales",
        "search_ph": "Busca en árabe, francés, inglés o español…",
        "search_none": "Sin resultados. Prueba otro nombre.",
        "search_pop": "Los más pedidos",
        "search_btn": "Buscar",
        "upsell": "Completa tu pedido",
        "photo": "Foto",
        "t_waze": "Waze",
        "t_waze_sub": "Ir en coche",
        "t_dir": "Cómo llegar",
        "t_call": "Llamar",
        "t_wa": "WhatsApp",
        "t_review": "Reseña en Google",
        "t_insta": "Instagram",
        "review": "Valora Almas en Google",
        "insta": "Instagram",
        "directions": "Cómo llegar a la tienda",
        "pro_title": "Restaurantes, hoteles, organizadores de bodas",
        "pro_lead": "Especias, hierbas y mezclas al kilo para cocinas profesionales, bodas y fiestas, desde nuestra tienda de Ksar Sghir, cerca de Tánger.",
        "pro_points": ["Al kilo, a los precios de la tienda.", "Para grandes cantidades, pídenos un precio.", "Pago a la entrega, en la tienda o por transferencia bancaria.", "Entrega acordada contigo por WhatsApp."],
        "pro_top": "Lo más pedido en cocina",
        "q_title": "Pedir un precio",
        "q_intro": "Dinos qué necesitas y en qué cantidad: te respondemos con un precio por WhatsApp.",
        "q_type": "Actividad",
        "q_types": ["Restaurante", "Hotel", "Bodas y eventos", "Catering", "Otro"],
        "q_business": "Establecimiento",
        "q_contact": "Tu nombre",
        "q_phone": "Teléfono",
        "q_city": "Ciudad",
        "q_date": "Fecha del evento (si lo hay)",
        "q_guests": "Número de invitados (para un evento)",
        "q_freq": "Frecuencia",
        "q_freqs": ["Una vez", "Cada semana", "Cada mes"],
        "q_items": "Productos y cantidades",
        "q_items_ph": "Por ejemplo: 5 kg de comino, 3 kg de cúrcuma, 2 kg de ras el hanout",
        "q_send": "Enviar la solicitud",
        "q_done": "Solicitud recibida. Te respondemos con un precio por WhatsApp.",
        "q_fail": "No se pudo enviar la solicitud. Se abrirá WhatsApp para enviarla directamente.",
        "visit_title": "Visita la tienda",
        "visit_body": "Nuestra tienda está en Ksar Sghir, cerca de Tánger.",
        "map": "Cómo llegar en Google Maps",
        "how_title": "Cómo pedir",
        "how": ["Elige los productos al kilo (de 250 g en 250 g) o por unidad.", "Envía el pedido a la tienda desde la cesta.", "Confirmamos el precio, la entrega y la hora; pagas a la entrega, en la tienda o por transferencia."],
        "related": "De la misma sección",
        "back": "Todos los productos",
        "order_one": "Pedir este producto ahora",
        "one_msg": "Hola Almas, quisiera: ",
        "privacy": "Política de privacidad",
        "app": "La aplicación Almas en Google Play",
        "nf_title": "Esta página no existe",
        "nf_body": "Vuelve al catálogo de Almas.",
        "order_head": "🌿 *Nuevo pedido Almas*",
        "o_name": "🏢 Nombre",
        "o_phone": "📞 Teléfono",
        "o_address": "📍 Dirección",
        "o_notes": "📝 Notas",
        "o_items": "🛒 Artículos",
        "o_total": "Total",
        "o_from": "desde la web",
        "langname": "Español",
        "short": "ES",
        "updated": "a los precios de la tienda",
    },
}
# reviews, quantity price, back-to-top and the assistant: one file, four languages
for _l, _s in json.loads((HERE / "strings-extra.json").read_text(encoding="utf-8")).items():
    T[_l].update(_s)

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


def images_of(p):
    """Up to 3 pictures: the shop's own cloud photo, then web photos <id>.jpg, <id>-2.jpg, <id>-3.jpg, else the card."""
    out = []
    if p.get("img"):
        out.append(f"{CFG['image_base']}/{p['id'][1:]}.jpg?v={p['img']}")
    for suffix in ("", "-2", "-3"):
        if (STATIC / "img" / "photo" / f"{p['id']}{suffix}.jpg").exists():
            out.append(f"{BASE}/img/photo/{p['id']}{suffix}.jpg")
    return out[:3] or [image_of(p)[0]]


def local(u):
    """Our own images by site path (works before publishing too); outside URLs unchanged."""
    return PREFIX + u[len(BASE):] if u.startswith(BASE) else u


def src(p):
    """The picture as a page uses it: our own images by site path (they work before publishing too). Where a
    400 px copy exists (thumb/), the small places use it: a card does not need the 800 px photo."""
    if not p.get("img") and (STATIC / "img" / "thumb" / f"{p['id']}.jpg").exists():
        return f"{PREFIX}/img/thumb/{p['id']}.jpg"
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
<meta name="viewport" content="width=device-width, initial-scale=1, interactive-widget=resizes-content">{verify}
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
<link rel="apple-touch-icon" href="{PREFIX}/img/icon-maskable-192.png">
<link rel="manifest" href="{PREFIX}/manifest-{lang}.webmanifest">
<meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Almas"><meta name="apple-mobile-web-app-status-bar-style" content="default">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Cormorant+Garamond:wght@500;600;700&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
<noscript><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Cormorant+Garamond:wght@500;600;700&display=swap" rel="stylesheet"></noscript>
<script type="speculationrules">{{"prefetch":[{{"source":"document","where":{{"and":[{{"href_matches":"/*"}},{{"not":{{"href_matches":"/api/*"}}}}]}},"eagerness":"moderate"}}]}}</script>
<link rel="stylesheet" href="{PREFIX}/assets/site.css?v={STAMP}">
{pixel_head()}
</head>"""


# Flags drawn as SVG: emoji flags show as two letters on Windows and on some Android phones.
# Arabic carries Morocco's flag, since the shop and its customers are Moroccan.
FLAGS = {
    "ar": '<rect width="30" height="20" fill="#c1272d"/><path d="M15 4.8L18.06 14.21L10.06 8.39H19.94L11.94 14.21Z" fill="none" stroke="#006233" stroke-width=".9"/>',
    "fr": '<rect width="10" height="20" fill="#002395"/><rect x="10" width="10" height="20" fill="#fff"/><rect x="20" width="10" height="20" fill="#ed2939"/>',
    "en": '<rect width="30" height="20" fill="#012169"/><path d="M0 0L30 20M30 0L0 20" stroke="#fff" stroke-width="4"/>'
          '<path d="M0 0L30 20M30 0L0 20" stroke="#c8102e" stroke-width="1.6"/><path d="M15 0v20M0 10h30" stroke="#fff" stroke-width="6.5"/>'
          '<path d="M15 0v20M0 10h30" stroke="#c8102e" stroke-width="3.6"/>',
    "es": '<rect width="30" height="20" fill="#aa151b"/><rect y="5" width="30" height="10" fill="#f1bf00"/>',
}


def flag(l):
    return f'<svg class="flag" viewBox="0 0 30 20" aria-hidden="true">{FLAGS[l]}</svg>'


def header(lang, path):
    t = T[lang]
    current = ' aria-current="true"'
    items = "".join(f'<a href="{url(l, path)}" hreflang="{l}" lang="{l}"{current if l == lang else ""}>'
                    f'{flag(l)}<span>{esc(T[l]["langname"])}</span></a>' for l in LANGS)
    switch = (f'<details class="langs" data-langs><summary aria-label="{esc(t["langname"])}">{flag(lang)}'
              f'<span class="long">{esc(t["langname"])}</span><span class="short">{esc(t["short"])}</span>'
              f'<svg class="caret" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></summary>'
              f'<div class="langs-menu">{items}</div></details>')
    return f"""<header class="top">
<div class="wrap top-in">
<a class="brand" href="{url(lang)}"><img src="{PREFIX}/img/logo-192.png" alt="" width="40" height="40"><span><b>{esc(t['name'])}</b><small>{esc(t['kicker'])}</small></span></a>
<button class="search-btn" type="button" data-open-search aria-label="{esc(t['search_btn'])}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/></svg></button>
<a class="nav-pro" href="{url(lang, 'pro/')}">{esc(t['nav_pro'])}</a>
<nav class="langs-nav" aria-label="Language">{switch}</nav>
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
    return f"""{head(lang, t['ty_title'] + ' | ' + t['name'], t['desc'], 'merci/', f'{BASE}/img/og-{lang}.jpg',
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


def hours_html(lang):
    """Every day's hours, and a badge the page turns into "open now" or "closed, opens at..." in Morocco's time."""
    h = CFG.get("hours")
    if not h:
        return ""
    t = T[lang]
    return (f'<p class="hours"><span class="open-badge" data-open-badge data-open="{h["open"]}" data-close="{h["close"]}" '
            f'data-on="{esc(t["open_now"])}" data-off="{esc(t["closed_now"].format(o=h["open"]))}" hidden></span> '
            f'<span>{esc(t["hours_line"].format(o=h["open"], c=h["close"]))}</span></p>')


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
        # Waze knows the shop by its Google listing: the place id opens it by name, phone and hours, not a dropped pin
        tile("waze", (f"https://ul.waze.com/ul?place={CFG['google_place_id']}&ll={lat}%2C{lng}&navigate=yes" if CFG.get("google_place_id")
                      else f"https://waze.com/ul?ll={lat},{lng}&navigate=yes"), t["t_waze"], esc(t["t_waze_sub"])),
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
{hours_html(lang)}
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
    return f"""{head(lang, t['pro_title'] + ' | ' + t['name'], t['pro_lead'], 'pro/', f'{BASE}/img/og-{lang}.jpg')}
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
<section class="wrap standing-info" id="standing"><h2>{esc(t['st_title'])}</h2>
<ol class="how">{"".join(f"<li>{esc(x)}</li>" for x in t["st_body"])}</ol>
<div class="cta"><a class="btn" href="{url(lang)}#products">{esc(t['st_cta'])}</a></div></section>
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
    return widgets(lang) + f"""<div class="search" data-search-panel hidden role="dialog" aria-modal="true" aria-label="{esc(t['search_btn'])}">
<div class="search-in wrap"><input type="search" data-search-input placeholder="{esc(t['search_ph'])}" aria-label="{esc(t['search_ph'])}" autocomplete="off">
<button type="button" class="mic" data-mic="[data-search-input]" aria-label="{esc(t['mic'])}" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/></svg></button>
<button type="button" class="x" data-close-search aria-label="×">×</button></div>
<div class="wrap"><p class="search-head" data-search-head></p><ul class="results" data-search-results></ul></div>
</div>
<div class="drawer" data-drawer hidden>
<div class="drawer-bg" data-close-cart></div>
<aside class="drawer-in" role="dialog" aria-modal="true" aria-label="{esc(t['cart'])}">
<div class="drawer-head"><h2 data-drawer-title>{esc(t['cart'])}</h2>
<button type="button" class="mo-btn" data-open-orders hidden>{esc(t['my_orders'])}</button>
<button type="button" class="x" data-close-cart aria-label="×">×</button></div>
<div class="drawer-body">
<div class="orders" data-orders hidden>
<button type="button" class="back" data-back-cart>← {esc(t['back_cart'])}</button>
<ul class="mo-list" data-mo-list></ul>
<p class="mo-none" data-mo-none>{esc(t['mo_none'])}</p>
<p class="note">{esc(t['mo_note'])}</p>
<button type="button" class="link-btn" data-forget>{esc(t['mo_forget'])}</button>
</div>
<div data-cart-view>
<div data-cart-empty class="empty"><p><b>{esc(t['cart_empty'])}</b></p><p>{esc(t['cart_empty_sub'])}</p></div>
<ul class="lines" data-cart-lines></ul>
<div class="upsell" data-upsell hidden><h3>{esc(t['upsell'])}</h3><ul data-upsell-list></ul></div>
<div data-cart-form hidden>
<p class="total"><span>{esc(t['subtotal'])}</span><span class="tot-r"><b data-cart-total></b><small class="eur" data-eur-total title="{esc(t['eur_note'])}"></small></span></p>
<form data-order-form>
<p class="saved-me" data-saved-me hidden>{esc(t['saved_me'])} <button type="button" class="link-btn" data-clear-me>{esc(t['clear_me'])}</button></p>
<label>{esc(t['f_name'])}<input name="name" autocomplete="name" required></label>
<label>{esc(t['f_phone'])}<input name="phone" type="tel" autocomplete="tel" inputmode="tel" required></label>
<label>{esc(t['f_address'])}<input name="address" autocomplete="street-address"></label>
<label>{esc(t['f_notes'])}<textarea name="notes" rows="2"></textarea></label>
<fieldset class="pay dest"><legend>{esc(t['dest_title'])}</legend>
<label class="opt"><input type="radio" name="dest" value="ma" checked> {esc(t['dest_ma'])}</label>
<label class="opt"><input type="radio" name="dest" value="eu_pickup"> {esc(t['dest_pickup'])}</label>
<label class="opt"><input type="radio" name="dest" value="eu_ship"> {esc(t['dest_ship'])}</label>
<div class="dest-eu" data-dest-eu hidden>
<label data-dest-country>{esc(t['dest_country'])}<input name="country" autocomplete="country-name" maxlength="40"></label>
<label data-dest-who>{esc(t['dest_who'])}<input name="collector" maxlength="80"></label>
<p class="note">{esc(t['dest_note'])}</p></div>
</fieldset>
<fieldset class="pay rep"><legend>{esc(t['rep_title'])}</legend>
<p class="note">{esc(t['rep_sub'])}</p>
<div class="rep-opts">{"".join(f'<label class="chip-opt"><input type="radio" name="repeat" value="{v}"{" checked" if v == "0" else ""}><span>{esc(t["rep_" + v])}</span></label>' for v in ("0", "7", "14", "30"))}</div>
</fieldset>
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
<button type="button" class="btn share-buy" data-share-order><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="19" r="2.6"/><path d="M8.3 10.8l7.4-4.4M8.3 13.2l7.4 4.4"/></svg><span>{esc(t['sh_btn'])}</span></button>
<div class="app-box" data-app-box hidden><b>{esc(t['app_title'])}</b><p>{esc(t['app_sub'])}</p>
<button type="button" class="btn ghost" data-install>{esc(t['app_go'])}</button></div>
</div>
</div>
</div>
</aside>
</div>"""


def footer(lang):
    """The footer as buttons, grouped: talk to us, find us, follow, your orders and the app; privacy as a small line."""
    t = T[lang]
    extra = {
        "orders": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10l3 4v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7z M4 7h16 M9 11h6 M9 15h6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/></svg>',
        "app": '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="2.5" width="12" height="19" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 7v7m-3-3 3 3 3-3M10 18.5h4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        "star": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-2.9-5.4 2.9 1.1-6-4.5-4.2 6.1-.8z" fill="#f4b400"/></svg>',
    }
    ic = lambda k: extra.get(k) or ICON[k]
    def a(kind, href, label, ltr=False):
        d = ' dir="ltr"' if ltr else ""
        return f'<a class="fb fb-{kind}" href="{esc(href)}" rel="noopener"><span class="fb-ic">{ic(kind)}</span><span{d}>{label}</span></a>'
    insta = CFG.get("instagram")
    play = f'<a class="fb" href="{esc(CFG["play_url"])}" rel="noopener"><span class="fb-ic">{ic("app")}</span><span>{esc(t["app"])}</span></a>' if CFG.get("play_url") else ""
    groups = [
        a("phone", "tel:" + CFG["phone"], esc(CFG["phone_display"]), True)
        + a("wa", "https://wa.me/" + CFG["whatsapp"], "WhatsApp " + f'<bdi dir="ltr">{esc(CFG.get("whatsapp_display", ""))}</bdi>'),
        a("pin", CFG["maps_url"], esc(t["map"])) + a("star", CFG.get("review_url") or CFG["maps_url"], esc(t["review"])),
        (a("insta", f"https://www.instagram.com/{insta}/", "@" + esc(insta), True) if insta else "") + play
        + f'<button type="button" class="fb" data-open-orders-foot><span class="fb-ic">{ic("orders")}</span><span>{esc(t["my_orders"])}</span></button>'
        + f'<button type="button" class="fb fb-app" data-install><span class="fb-ic">{ic("app")}</span><span>{esc(t["app_link"])}</span></button>',
    ]
    return f"""<footer class="foot">
<div class="wrap foot-in">
<div class="foot-brand"><img src="{PREFIX}/img/logo-192.png" alt="" width="44" height="44" loading="lazy"><div><b>{esc(t['name'])}</b><p>{esc(t['visit_body'])}</p>{hours_html(lang)}</div></div>
<div class="foot-groups">{"".join(f'<div class="fg">{g}</div>' for g in groups if g)}</div>
</div>
<p class="wrap copyright">© {datetime.now().year} {esc(t['name'])} · <a href="{PREFIX}/privacy-policy.html">{esc(t['privacy'])}</a></p>
</footer>"""


def page_data(lang, products, cats):
    """What site.js needs: the products in this language, the WhatsApp number, the strings for the order."""
    t = T[lang]
    data = {
        "lang": lang, "wa": CFG["whatsapp"], "feed": CFG["catalog_url"], "api": CFG.get("order_api", ""),
        "qapi": CFG.get("quote_api", ""), "rapi": CFG.get("review_api", ""), "aapi": CFG.get("assistant_api", ""),
        "cloud": CFG.get("cloud_url", ""), "eur": round(1 / MAD_PER_EUR, 5),
        "packs": {k["id"]: {"items": k["items"], "when": k["when"], "badge": k["badge"]} for k in PACKS["packs"]},
        "money": MONEY[lang],
        "s": {k: t[k] for k in ("order_head", "o_name", "o_phone", "o_address", "o_notes", "o_items", "o_total",
                                "o_from", "add", "added", "remove", "kg", "piece", "one_msg", "o_pay", "o_number",
                                "pay_cod", "pay_bank", "pay_card", "card_fail", "sending", "send", "done_body", "fail",
                                "search_none", "search_pop", "upsell",
                                "copied", "copy", "q_send", "q_fail", "sending", "rv_count", "rv_verified", "rv_none",
                                "rv_fail", "rv_need", "as_error", "as_thinking", "as_wa", "my_orders", "cart", "mo_again",
                                "mo_forgot", "st_new", "st_confirmed", "st_preparing", "st_delivered", "st_cancelled", "st_paid",
                                "app_go", "app_got", "rep_done", "rep_7", "rep_14", "rep_30", "mic_on", "mic_no",
                                "sh_btn", "sh_title", "sh_more", "sh_text", "sh_saved", "name", "kicker",
                                "as_addall", "as_added", "as_checkout", "as_maps", "as_pro", "t_waze", "as_listen")},
        "maps": CFG["maps_url"], "pro": url(lang, "pro/"),
        "waze": (f"https://ul.waze.com/ul?place={CFG['google_place_id']}&ll={CFG['geo'][0]}%2C{CFG['geo'][1]}&navigate=yes" if CFG.get("google_place_id")
                 else f"https://waze.com/ul?ll={CFG['geo'][0]},{CFG['geo'][1]}&navigate=yes"),
        "boxes": {k["id"]: k[lang] for k in PACKS["packs"]},
        "site": BASE + url(lang)[len(PREFIX):], "insta": CFG.get("instagram", ""), "logo": f"{PREFIX}/img/logo-512.png",
        "p": {p["id"]: {"n": name(p, lang), "ar": p["ar"], "t": p["t"], "fr": p["fr"], "en": p["en"], "es": p["es"],
                        "price": p["price"], "u": p["unit"],
                        "c": p["cat"], "r": p.get("rank") or 0, "i": src(p), "l": url(lang, "p/" + p["id"] + "/")} for p in products},
        "cats": {c: cats[c][lang] for c in cats},
    }
    return data


DATA_V = {}  # lang -> hash of that language's product file, set in main() before any page is written


def data_tag(lang):
    """One shared file per language instead of the product list inlined in all 129 pages of that language."""
    return f'<script src="{PREFIX}/assets/data-{lang}.js?v={DATA_V.get(lang, STAMP)}" defer></script>'


def card(lang, p, cats):
    t = T[lang]
    img, _ = image_of(p)
    cat = cats[p["cat"]]
    unit = t["kg"] if p["unit"] == "kg" else t["piece"]
    other = p["ar"] if lang != "ar" else p["fr"]
    return f"""<li class="card" data-cat="{p['cat']}" data-search="{esc(' '.join([p['ar'], p['t'], p['fr'], p['en'], p['es']]).lower())}" style="--c:{cat['color']}">
<a class="card-link" href="{url(lang, 'p/' + p['id'] + '/')}">
<span class="ph"><img src="{esc(src(p))}" alt="{esc(name(p, lang))}" loading="lazy" width="400" height="400"></span>
<span class="card-name">{esc(name(p, lang))}</span>
<span class="card-other" lang="{'fr' if lang == 'ar' else 'ar'}">{esc(other)}</span>
<span class="stars-mini" data-stars="{p['id']}" hidden></span>
</a>
<div class="card-buy"><span class="price"><b data-price="{p['id']}">{esc(money(lang, p['price']))}</b> <small>{esc(unit)}</small></span>
<button type="button" class="add" data-add="{p['id']}" aria-label="{esc(t['add'])} {esc(name(p, lang))}">+</button></div>
</li>"""


def packs_section(lang, products):
    """Ready-made boxes: the shop's own products that go together, priced as the sum of their items."""
    st = PACKS["strings"][lang]
    by = {p["id"]: p for p in products}
    cards = []
    for k in PACKS["packs"]:
        items = [(by[i], q) for i, q in k["items"] if i in by]
        if len(items) < 3:
            continue
        items = [(p, q if p["unit"] == "kg" else max(1, int(q))) for p, q in items]
        total = sum(p["price"] * q for p, q in items)
        art = "".join(f'<img src="{esc(src(p))}" alt="" width="120" height="120" loading="lazy">' for p, _ in items[:3])
        lines = "".join(f'<li><span>{esc(name(p, lang))}</span> <small dir="ltr">{"%g g" % (q * 1000) if p["unit"] == "kg" and q < 1 else ("%g kg" % q if p["unit"] == "kg" else "× %d" % q)}</small></li>' for p, q in items)
        badge = f'<span class="pk-badge" data-pk-badge hidden>{esc(st[k["badge"]])}</span>' if k["badge"] else ""
        cards.append(f'<li class="pack" data-pack="{k["id"]}"><div class="pk-art">{art}{badge}</div><div class="pk-body"><h3>{esc(k[lang])}</h3>'
                     f'<ul class="pk-items">{lines}</ul><div class="pk-buy"><span><b data-pack-total="{k["id"]}">{esc(money(lang, total))}</b>'
                     f'<small class="eur" data-eur-pack="{k["id"]}"></small></span>'
                     f'<button type="button" class="btn" data-add-pack="{k["id"]}">{esc(st["add"])}</button></div></div></li>')
    if not cards:
        return ""
    return (f'<section class="packs" id="packs"><div class="wrap"><h2>{esc(st["title"])}</h2><p class="lead">{esc(st["sub"])}</p>'
            f'<div class="pk-wrap slider" data-slider><button type="button" class="chips-nav prev" data-slide="-1" aria-label="‹" tabindex="-1">‹</button>'
            f'<ul class="pk-row" data-pk-row data-slide-row>{"".join(cards)}</ul>'
            f'<button type="button" class="chips-nav next" data-slide="1" aria-label="›" tabindex="-1">›</button></div></div></section>')


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
        "url": BASE + url(lang)[len(PREFIX):], "telephone": CFG["phone"], "image": f"{BASE}/img/og-{lang}.jpg",
        "logo": f"{BASE}/img/logo-512.png", "hasMap": CFG["maps_url"], "priceRange": "DH",
        "address": {"@type": "PostalAddress", "addressLocality": "Ksar Sghir", "addressRegion": "Tanger-Tétouan-Al Hoceïma",
                    "addressCountry": "MA"},
        "paymentAccepted": "Cash, Bank transfer",
        "openingHoursSpecification": [{"@type": "OpeningHoursSpecification", "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
                                       "opens": CFG["hours"]["open"], "closes": CFG["hours"]["close"]}] if CFG.get("hours") else [],
        "geo": {"@type": "GeoCoordinates", "latitude": CFG["geo"][0], "longitude": CFG["geo"][1]},
        "sameAs": [f"https://www.instagram.com/{CFG['instagram']}/"] if CFG.get("instagram") else [],
    }
    return f"""{head(lang, t['title'], t['desc'], '', f'{BASE}/img/og-{lang}.jpg')}
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
{packs_section(lang, products)}
<section id="products" class="shop">
<div class="wrap">
<div class="tools" data-tools>
<div class="tools-search"><div class="with-mic"><input type="search" data-search-box placeholder="{esc(t['search'])}" aria-label="{esc(t['search'])}">
<button type="button" class="mic" data-mic="[data-search-box]" aria-label="{esc(t['mic'])}" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/></svg></button></div></div>
<div class="chips-wrap" data-chips-wrap>
<button type="button" class="chips-nav prev" data-chips-nav="-1" aria-label="‹" tabindex="-1">‹</button>
<div class="chips" role="toolbar" data-chips><button type="button" data-filter="" aria-pressed="true">{esc(t['all'])}</button>{shelves}</div>
<button type="button" class="chips-nav next" data-chips-nav="1" aria-label="›" tabindex="-1">›</button>
</div>
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


def gallery(p, n, t):
    """Swipe between the pictures on a phone, thumbnails to pick one; a single picture shows alone."""
    imgs = images_of(p)
    track = "".join(f'<img src="{esc(local(u))}" alt="{esc(n)}" width="800" height="800"{" fetchpriority=high" if i == 0 else " loading=lazy"} decoding="async">'
                    for i, u in enumerate(imgs))
    if len(imgs) == 1:
        return f'<div class="product-img"><div class="ph"><div class="g-track">{track}</div></div></div>'
    thumbs = "".join(f'<button type="button" data-g="{i}" aria-label="{esc(t["photo"])} {i + 1}"{" aria-current=true" if i == 0 else ""}>'
                     f'<img src="{esc(local(u))}" alt="" width="80" height="80" loading="lazy"></button>' for i, u in enumerate(imgs))
    return f'<div class="product-img" data-gallery><div class="ph"><div class="g-track">{track}</div></div><div class="g-thumbs">{thumbs}</div></div>'


def share_box(lang, p, n):
    """Share with a friend: the phone's own share menu where there is one, else WhatsApp, Facebook and copy link."""
    t = T[lang]
    link = BASE + url(lang, "p/" + p["id"] + "/")[len(PREFIX):] + "?utm_source=share"
    msg = t["share_msg"].format(n=n, p=money(lang, p["price"]) + " " + (t["kg"] if p["unit"] == "kg" else t["piece"]))
    wa = "https://wa.me/?text=" + urllib.parse.quote(msg + " " + link)
    fb = "https://www.facebook.com/sharer/sharer.php?u=" + urllib.parse.quote(link)
    icon = ('<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.6"/><circle cx="6" cy="12" r="2.6"/>'
            '<circle cx="18" cy="19" r="2.6"/><path d="M8.3 10.8l7.4-4.4M8.3 13.2l7.4 4.4"/></svg>')
    return (f'<div class="share" data-share-box data-title="{esc(n)}" data-text="{esc(msg)}" data-url="{esc(link)}">'
            f'<button type="button" class="share-btn" data-share>{icon}<span>{esc(t["share"])}</span></button>'
            f'<div class="share-alt" data-share-alt hidden>'
            f'<a class="sh-wa" href="{esc(wa)}" rel="noopener" target="_blank">WhatsApp</a>'
            f'<a class="sh-fb" href="{esc(fb)}" rel="noopener" target="_blank">Facebook</a>'
            f'<button type="button" class="sh-copy" data-copy="{esc(link)}" data-copy-label="{esc(t["share_copy"])}">{esc(t["share_copy"])}</button>'
            f'</div></div>')


def product_page(lang, p, products, cats):
    t = T[lang]
    cat = cats[p["cat"]]
    img, real = image_of(p)
    n = name(p, lang)
    unit = t["kg"] if p["unit"] == "kg" else t["piece"]
    path = "p/" + p["id"] + "/"
    title = f"{n} – {money(lang, p['price'])} {unit} | {t['name']}"
    desc = (f"{about(p, lang)} {money(lang, p['price'])} {unit}." if about(p, lang)
            else f"{n} ({p['ar'] if lang != 'ar' else p['fr']}), {money(lang, p['price'])} {unit}. {t['order_note']}")
    names = "".join(f'<li lang="{l}"><span>{esc(T[l]["langname"])}</span> {esc(p[l])}</li>' for l in LANGS if p.get(l))
    same = [q for q in products if q["cat"] == p["cat"] and q["id"] != p["id"]][:8]
    related = "".join(card(lang, q, cats) for q in same)
    one = f"https://wa.me/{CFG['whatsapp']}?text=" + urllib.parse.quote(t["one_msg"] + p["t"] + ("" if p["t"] == n else f" ({n})"))
    extra = (f'\n<meta property="og:type" content="product">'
             f'\n<meta property="product:retailer_item_id" content="{p["id"]}">'
             f'\n<meta property="product:price:amount" content="{num(p["price"])}">'
             f'\n<meta property="product:price:currency" content="MAD">'
             f'\n<meta property="product:availability" content="in stock">'
             f'\n<meta property="product:condition" content="new">'
             f'\n<meta property="product:brand" content="Almas">')
    ld = {
        "@context": "https://schema.org", "@type": "Product", "productID": p["id"], "sku": p["id"], "name": n,
        "alternateName": [p[l] for l in LANGS if p.get(l) and p[l] != n], "image": images_of(p), "brand": {"@type": "Brand", "name": "Almas"},
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
<div class="wrap crumbs"><a class="back-btn" href="{url(lang)}#products" data-back><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg><span>{esc(t['back'])}</span></a>
<span class="crumb-cat" style="--c:{cat['color']}">{esc(cat[lang])}</span></div>
<section class="wrap product" style="--c:{cat['color']}">
{gallery(p, n, t)}
<div class="product-info">
<p class="kicker">{esc(cat[lang])}</p>
<h1>{esc(n)}</h1>
<a class="stars-mini big" href="#reviews" data-stars="{p['id']}" hidden></a>
{f'<p class="about">{esc(about(p, lang))}</p>' if about(p, lang) else ""}
<ul class="names">{names}</ul>
<p class="big-price"><b data-price="{p['id']}">{esc(money(lang, p['price']))}</b> <small>{esc(unit)}</small> <small class="eur" data-eur-unit="{p['id']}"></small></p>
<div class="qty-row"><div class="qty" data-qty-for="{p['id']}"><button type="button" data-step="-1" aria-label="-">−</button><output data-qty-label></output><button type="button" data-step="1" aria-label="+">+</button></div>
<p class="qty-price"><small>{esc(t['qty_for'])}</small><b data-qty-price></b><small class="eur" data-eur-qty></small></p></div>
<div class="cta"><button type="button" class="btn" data-add-qty="{p['id']}">{esc(t['add'])}</button>
<a class="btn ghost wa-link" data-order-one="{p['id']}" href="{esc(one)}" rel="noopener">{esc(t['order_one'])}</a></div>
{share_box(lang, p, n)}
<p class="note">{esc(t['order_note'])}<br>{esc(t['pay_note'])}</p>
</div>
</section>
{reviews_block(lang, p)}
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


def reviews_block(lang, p):
    """Customer reviews under the product: loaded from the shop's cloud (published ones only), and a form to write one."""
    t = T[lang]
    if not CFG.get("cloud_url"):
        return ""
    stars = "".join(f'<label><input type="radio" name="rating" value="{i}" required><span aria-hidden="true">★</span>'
                    f'<b class="sr">{i}/5</b></label>' for i in range(5, 0, -1))
    google = CFG.get("review_url") or CFG["maps_url"]
    return f"""<section class="wrap reviews" id="reviews" data-reviews="{p['id']}">
<div class="rv-head"><h2>{esc(t['rv_title'])}</h2><p class="rv-sum" data-rv-sum></p>
<button type="button" class="btn ghost" data-rv-open>{esc(t['rv_write'])}</button></div>
<ul class="rv-list" data-rv-list><li class="rv-none">{esc(t['rv_none'])}</li></ul>
<form class="rv-form" data-rv-form hidden>
<fieldset class="rv-stars"><legend>{esc(t['rv_rating'])}</legend><div class="stars-in" dir="ltr">{stars}</div></fieldset>
<label>{esc(t['rv_text'])}<textarea name="text" rows="3" maxlength="600" required></textarea></label>
<label>{esc(t['rv_name'])}<input name="name" maxlength="80" autocomplete="name" required></label>
<p class="note">{esc(t['rv_proof'])}</p>
<div class="two-in"><label>{esc(t['rv_order'])}<input name="order" maxlength="24" dir="ltr" placeholder="AL-…"></label>
<label>{esc(t['rv_phone'])}<input name="phone" type="tel" inputmode="tel" maxlength="20" dir="ltr"></label></div>
<input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
<button class="btn" type="submit" data-rv-send>{esc(t['rv_send'])}</button>
<p class="rv-done" data-rv-done hidden>{esc(t['rv_done'])} <a href="{esc(google)}" rel="noopener">★ {esc(t['rv_google'])}</a></p>
</form>
</section>"""


def widgets(lang):
    """On every page: the back-to-top arrow and the shop assistant (العشّاب / Achab, drawn as a tagine on a wood fire)."""
    t = T[lang]
    chips = "".join(f'<button type="button" data-as-chip>{esc(c)}</button>' for c in t["as_chips"])
    tagine = ('<svg viewBox="0 0 64 76" aria-hidden="true" class="tagine">'
              '<g class="steam"><path d="M28 6c-2-2.5 2-4.5 0-7"/><path d="M36 6c-2-2.5 2-4.5 0-7"/></g>'
              '<g class="fire"><path class="flame f1" d="M22 70c-3-4 0-8 2-11 0 3 2 4 3 2 1 4 1 7-1 9z"/>'
              '<path class="flame f2" d="M30 71c-4-5 0-11 3-15 0 4 3 5 4 3 2 5 1 9-2 12z"/>'
              '<path class="flame f3" d="M39 70c-3-4 0-8 2-11 0 3 2 4 3 2 1 4 1 7-1 9z"/>'
              '<rect class="log" x="15" y="69" width="34" height="5" rx="2.5" transform="rotate(-8 32 71.5)"/>'
              '<rect class="log" x="15" y="69" width="34" height="5" rx="2.5" transform="rotate(8 32 71.5)"/>'
              '<circle class="ember e1" cx="24" cy="72" r="1.2"/><circle class="ember e2" cx="40" cy="71" r="1"/></g>'
              '<path class="base" d="M3 44h58c-1.5 6-8 10-16 10H19C11 54 4.5 50 3 44z"/>'
              '<path class="rim" d="M2 42.5h60v2.6H2z"/>'
              '<path class="dots" d="M14 48.5h2v2h-2zM24 49.5h2v2h-2zM38 49.5h2v2h-2zM48 48.5h2v2h-2z"/>'
              '<path class="lid" d="M30.2 9.5L11 42.5h42L33.8 9.5z"/>'
              '<path class="band" d="M15.6 34.6h32.8l2.1 3.6H13.5zM25.3 18h13.4l1.6 2.8H23.7z"/>'
              '<circle class="knob" cx="32" cy="7" r="3.6"/>'
              '<circle class="eye" cx="27.5" cy="27" r="2.1"/><circle class="eye" cx="36.5" cy="27" r="2.1"/>'
              '<path class="smile" d="M28 30.8c2.3 2.2 5.7 2.2 8 0"/></svg>')
    sheet = (f'<div class="app-sheet" data-app-sheet hidden role="dialog" aria-label="{esc(t["app_title"])}"><div class="app-card">'
             f'<div class="app-top"><img src="{PREFIX}/img/icon-maskable-192.png" alt="" width="52" height="52">'
             f'<div><b>{esc(t["app_title"])}</b><p>{esc(t["app_sub"])}</p></div>'
             f'<button type="button" class="x" data-app-no aria-label="×">×</button></div>'
             f'<p class="app-how" data-app-how hidden data-ios="{esc(t["app_ios"])}" data-manual="{esc(t["app_manual"])}"></p>'
             f'<div class="app-act"><button type="button" class="btn" data-app-go>{esc(t["app_go"])}</button>'
             f'<button type="button" class="link-btn" data-app-no>{esc(t["app_not_now"])}</button></div></div></div>')
    return sheet + f"""<button type="button" class="to-top" data-to-top aria-label="{esc(t['top'])}" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button>
<button type="button" class="as-fab" data-as-open aria-label="{esc(t['as_open'])}">{tagine}<span class="as-tip">{esc(t['as_open'])}</span></button>
<div class="as" data-as hidden role="dialog" aria-modal="false" aria-label="{esc(t['as_title'])}">
<div class="as-head">{tagine}<div><b>{esc(t['as_title'])}</b><small>{esc(t['as_sub'])}</small></div>
<button type="button" class="snd" data-as-sound aria-pressed="true" aria-label="{esc(t['as_sound'])}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path class="w1" d="M15.5 9a4.5 4.5 0 0 1 0 6"/><path class="w2" d="M18 6.5a8 8 0 0 1 0 11"/><path class="mute" d="M16 9.5l5 5m0-5l-5 5"/></svg></button>
<button type="button" class="x" data-as-close aria-label="×">×</button></div>
<div class="as-body" data-as-body><div class="msg bot">{esc(t['as_hello'])}</div><div class="as-chips">{chips}</div></div>
<form class="as-form" data-as-form><input name="q" maxlength="500" autocomplete="off" placeholder="{esc(t['as_ph'])}" aria-label="{esc(t['as_ph'])}" required>
<button type="button" class="mic" data-mic="[data-as-form] input" aria-label="{esc(t['mic'])}" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/></svg></button>
<button type="submit" aria-label="{esc(t['as_send'])}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5.5 11.5L12 5l6.5 6.5"/></svg></button></form>
<a class="as-wa" href="https://wa.me/{esc(CFG['whatsapp'])}" rel="noopener" data-as-wa>{esc(t['as_wa'])}</a>
</div>"""


def manifest(lang):
    """The installed app: one app ("id"), opening in the language it was installed from."""
    t = T[lang]
    return {
        "id": PREFIX + "/", "name": t["name"], "short_name": "Almas", "description": t["desc"],
        "start_url": url(lang) + "?src=app", "scope": PREFIX + "/", "display": "standalone", "orientation": "portrait-primary",
        "background_color": "#f7f0e7", "theme_color": "#211a16", "lang": lang, "dir": t["dir"],
        "categories": ["shopping", "food"],
        "icons": [{"src": f"{PREFIX}/img/logo-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
                  {"src": f"{PREFIX}/img/logo-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
                  {"src": f"{PREFIX}/img/icon-maskable-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable"},
                  {"src": f"{PREFIX}/img/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}],
        "shortcuts": [{"name": t["my_orders"], "url": url(lang) + "?orders=1&src=app", "icons": [{"src": f"{PREFIX}/img/logo-192.png", "sizes": "192x192"}]},
                      {"name": t["nav_pro"], "url": url(lang, "pro/") + "?src=app", "icons": [{"src": f"{PREFIX}/img/logo-192.png", "sizes": "192x192"}]}],
    }


def not_found():
    t = T["ar"]
    links = " · ".join(f'<a href="{url(l)}" lang="{l}">{esc(T[l]["nf_body"])}</a>' for l in LANGS)
    return f"""{head('ar', t['nf_title'], t['desc'], '', f'{BASE}/img/og-ar.jpg')}
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
    cols = ["id", "title", "description", "availability", "condition", "price", "link", "image_link", "additional_image_link", "brand",
            "google_product_category", "product_type", "custom_label_0", "custom_label_1"]
    with open(out / "meta.csv", "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, lineterminator=chr(10))  # LF on every OS, so the daily Linux build does not rewrite it
        w.writerow(cols)
        for p in products:
            how, size = UNIT_FEED.get(p["unit"], UNIT_FEED["piece"])
            img, real = image_of(p)
            w.writerow([
                p["id"], f"{p['fr']} {size}"[:150],
                (about(p, "fr") + " ") + f"{p['fr']} ({p['ar']}), vendu {how} par Almas, herboristerie à Ksar Sghir près de Tanger. "
                f"Commande en ligne ou sur WhatsApp ; paiement à la livraison, à la boutique ou par virement.",
                "in stock", "new", f"{float(p['price']):.2f} MAD", BASE + url("fr", "p/" + p["id"] + "/")[len(PREFIX):],
                img, ",".join(images_of(p)[1:]), "Almas", GOOGLE_CAT.get(p["cat"], GOOGLE_CAT["pantry"]), cats[p["cat"]]["fr"],
                cats[p["cat"]]["fr"], "photo" if real else "carte"])
    over = {"ar": ("ar_AR", "{ar} {size}", "{ar}، يُباع {how} لدى معشبة ألماس في القصر الصغير قرب طنجة. اطلب عبر الموقع أو واتساب، والدفع عند الاستلام أو في المتجر أو بالتحويل البنكي.",
                   {"kg": ("بالكيلوغرام", "(1 كلغ)"), "piece": ("بالقطعة", "(للقطعة)")}),
            "en": ("en_XX", "{en} {size}", "{en} ({ar}), sold {how} by Almas, a spice and herb shop in Ksar Sghir near Tangier. Order online or on WhatsApp; pay on delivery, at the shop or by bank transfer.",
                   {"kg": ("by the kilo", "(1 kg)"), "piece": ("by the piece", "(each)")}),
            "es": ("es_XX", "{es} {size}", "{es} ({ar}), vendido {how} por Almas, tienda de especias y hierbas en Ksar Sghir, cerca de Tánger. Pide en la web o por WhatsApp; pago a la entrega, en la tienda o por transferencia.",
                   {"kg": ("al kilo", "(1 kg)"), "piece": ("por unidad", "(unidad)")})}
    for lang, (code, title, desc, units) in over.items():
        with open(out / f"meta-{lang}.csv", "w", encoding="utf-8", newline="") as f:
            w = csv.writer(f, lineterminator=chr(10))  # LF on every OS, so the daily Linux build does not rewrite it
            w.writerow(["id", "override", "title", "description", "link"])
            for p in products:
                how, size = units.get(p["unit"], units["piece"])
                w.writerow([p["id"], code, title.format(size=size, **p)[:150], (about(p, lang) + " " if about(p, lang) else "") + desc.format(how=how, **p),
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
    if "--offline" not in sys.argv:
        fetch_rate()
    cats = {c["id"]: c for c in data["categories"]}
    for c, names in NAMES["_shelves"].items():
        if c in cats:
            cats[c].update(names)
    for c in cats.values():
        c.setdefault("es", c["fr"])
    products = [p for p in data["products"] if p.get("cat") in cats and p.get("price")]
    for p in products:
        p["t"] = p["ar"]  # the till's name, kept for the order the shop receives
        p.update({k: v for k, v in NAMES.get(p["id"], {}).items() if v})
        p.setdefault("es", p["fr"])
    order = {c: i for i, c in enumerate(cats)}
    products.sort(key=lambda p: (order[p["cat"]], -(p.get("rank") or 0), p["fr"]))
    # every build reads the till's prices afresh (Vercel builds on each push and once a day), so the day shown
    # is the day they were last read
    now = datetime.now(timezone.utc)
    day = {"ar": now.strftime("%d/%m/%Y"), "fr": now.strftime("%d/%m/%Y"), "en": now.strftime("%Y-%m-%d"),
           "es": now.strftime("%d/%m/%Y")}

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
        data_js = "window.ALMAS=" + json.dumps(page_data(lang, products, cats), ensure_ascii=False) + ";" + chr(10)
        DATA_V[lang] = hashlib.sha256(data_js.encode("utf-8")).hexdigest()[:10]
        write(OUT / "assets" / f"data-{lang}.js", data_js)
        write(base / "index.html", home(lang, products, cats, day[lang]))
        write(base / "merci" / "index.html", thanks(lang))
        write(base / "pro" / "index.html", pro_page(lang, products, cats))
        for p in products:
            write(base / "p" / p["id"] / "index.html", product_page(lang, p, products, cats))
    for lang in LANGS:
        write(OUT / f"manifest-{lang}.webmanifest", json.dumps(manifest(lang), ensure_ascii=False, indent=1))
    shutil.copyfile(HERE / "assets" / "sw.js", OUT / "sw.js")
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
