"""Build assets/catalog/products.json, the app's catalogue, from the shop's till (Aronium).

    python tool/build_catalog.py <till-export.json>

The export comes from the till (export_catalog.py in the Aronium repo): every product with its Arabic name and
current price. This file decides which of them the app shows, in which category, with which French and English
name, and whether it is sold by the kilo (step 250 g) or by the piece. A product left out of CURATION is not in
the app: household brands, duplicates, placeholders, and anything sold as a remedy (Play forbids medical claims).
Prices and Arabic names always come from the till, so the app never shows a price the shop does not charge.
A French or English name left as None falls back to the Arabic one, rather than a guessed translation.
"""
import json
import sys
from pathlib import Path

CATEGORIES = [
    # id, Arabic, French, English, colour
    ("spices", "التوابل", "Épices", "Spices", "#B5472C"),
    ("blends", "الخلطات", "Mélanges", "Spice blends", "#C9822B"),
    ("herbs", "الأعشاب", "Herbes", "Herbs", "#5E7F3E"),
    ("seeds", "حبوب وفواكه جافة", "Graines & fruits secs", "Seeds & dried fruit", "#8A6A3B"),
    ("pastry", "الحلويات", "Pâtisserie", "Pastry", "#C7647A"),
    ("pantry", "البقالة", "Épicerie", "Pantry", "#4F6D8A"),
    ("beauty", "الحناء والتجميل", "Henné & beauté", "Henna & beauty", "#7C4A2D"),
    ("incense", "البخور والمسك", "Encens & musc", "Incense & musk", "#5B4B8A"),
]

K, P = "kg", "piece"
CURATION = {
    # till id: (category, French, English, unit)
    # (2, 5, 8, 11, 13, 14 and 15 are "services" on the till, i.e. sold without stock tracking - still products)
    13: ("spices", "Paprika doux", "Sweet paprika", K),
    2: ("spices", "Curcuma", "Turmeric", K),
    8: ("spices", "Piment fort moulu", "Hot chili powder", K),
    5: ("spices", "Ail en poudre", "Garlic powder", K),
    11: ("spices", "Oignon en poudre", "Onion powder", K),
    1: ("spices", "Gingembre moulu", "Ground ginger", K),
    6: ("spices", "Cumin", "Cumin", K),
    3: ("spices", "Poivre noir", "Black pepper", K),
    245: ("spices", "Poivre blanc", "White pepper", K),
    9: ("spices", "Cannelle", "Cinnamon", K),
    212: ("spices", "Cannelle spéciale", "Cinnamon (special)", K),
    130: ("spices", "Coriandre", "Coriander", K),
    92: ("spices", "Clou de girofle", "Cloves", K),
    40: ("spices", "Fenouil", "Fennel seeds", K),
    39: ("spices", "Anis vert", "Aniseed", K),
    73: ("spices", None, None, K),
    64: ("spices", "Gingembre", "Ginger", K),
    43: ("spices", "Nigelle", "Nigella seeds", K),
    79: ("spices", "Galanga", "Galangal", K),
    282: ("spices", "Fenugrec", "Fenugreek", K),
    292: ("spices", "Carvi", "Caraway", K),
    48: ("spices", "Cardamome", "Cardamom", K),
    49: ("spices", "Macis", "Mace", K),
    75: ("spices", None, None, K),
    46: ("spices", None, None, K),
    128: ("spices", "Ail", "Garlic", K),
    269: ("spices", None, None, K),
    52: ("spices", "Noix de muscade", "Nutmeg", P),
    85: ("spices", "Safran pur", "Pure saffron", P),
    193: ("spices", "Asa-fœtida", "Asafoetida", P),
    7: ("blends", "Ras el hanout", "Ras el hanout", K),
    4: ("blends", "Mélange pour poulet", "Chicken spice blend", K),
    12: ("blends", "Mélange pour viande", "Meat spice blend", K),
    10: ("blends", "Mélange pour poisson", "Fish spice blend", K),
    226: ("blends", "Mélange maison (tkhlita)", "House blend (tkhlita)", K),
    185: ("blends", "Tbrima pour viande", "Tbrima meat seasoning", K),
    14: ("blends", "Épices pour harira", "Harira spice blend", K),
    15: ("blends", "Épices pour kefta", "Kefta spice blend", K),
    36: ("herbs", "Thym (zaatar)", "Thyme (zaatar)", K),
    63: ("herbs", "Menthe séchée", "Dried mint", K),
    59: ("herbs", "Verveine", "Lemon verbena", K),
    55: ("herbs", "Camomille", "Chamomile", K),
    143: ("herbs", "Lavande", "Lavender", K),
    65: ("herbs", "Hibiscus", "Hibiscus", K),
    56: ("herbs", "Boutons de rose", "Rose buds", K),
    60: ("herbs", "Romarin", "Rosemary", K),
    62: ("herbs", "Sauge", "Sage", K),
    140: ("herbs", "Marjolaine", "Marjoram", K),
    35: ("herbs", "Armoise blanche (chih)", "White wormwood (chih)", K),
    68: ("herbs", "Myrte (rihan)", "Myrtle (rihan)", K),
    70: ("herbs", "Genévrier (arar)", "Juniper (arar)", K),
    91: ("herbs", "Réglisse", "Licorice root", K),
    50: ("herbs", "Écorce de grenade", "Pomegranate peel", K),
    271: ("herbs", "Marrube", "Horehound", K),
    268: ("herbs", "Moringa", "Moringa", K),
    213: ("herbs", "Costus indien", "Indian costus", K),
    74: ("herbs", None, None, K),
    37: ("herbs", "Laurier", "Bay leaves", P),
    57: ("herbs", "Menthe pouliot", "Pennyroyal", P),
    20: ("seeds", "Sésame", "Sesame seeds", K),
    21: ("seeds", "Sésame premium", "Sesame seeds (premium)", P),
    44: ("seeds", "Graines de lin", "Flaxseed", K),
    47: ("seeds", "Graines de cresson", "Garden cress seeds", K),
    26: ("seeds", "Raisins secs", "Raisins", K),
    25: ("seeds", "Raisins secs premium", "Raisins (premium)", P),
    16: ("seeds", "Amandes", "Almonds", K),
    17: ("seeds", "Noix", "Walnuts", K),
    76: ("seeds", "Graines de courge", "Pumpkin seeds", K),
    41: ("seeds", "Souchet (habb laaziz)", "Tiger nuts", K),
    45: ("seeds", "Soja", "Soybeans", K),
    90: ("seeds", "Lentilles corail", "Red lentils", K),
    94: ("seeds", "Psyllium", "Psyllium seeds", P),
    267: ("seeds", "Son de psyllium", "Psyllium husk", K),
    135: ("pastry", "Eau de fleur d'oranger", "Orange blossom water", P),
    136: ("pastry", "Eau de fleur d'oranger premium", "Orange blossom water (premium)", P),
    223: ("pastry", "Eau de rose", "Rose water", P),
    156: ("pastry", "Eau de rose (petite)", "Rose water (small)", P),
    131: ("pastry", "Levure chimique", "Baking powder", P),
    133: ("pastry", "Levure chimique (grand)", "Baking powder (large)", P),
    263: ("pastry", "Levure", "Yeast", P),
    138: ("pastry", "Sucre glace", "Icing sugar", P),
    22: ("pastry", "Noix de coco râpée", "Desiccated coconut", K),
    28: ("pastry", "Vermicelles de chocolat", "Chocolate sprinkles", P),
    29: ("pastry", "Fruits confits", "Candied fruit", P),
    24: ("pastry", "Beurre pâtissier", "Pastry butter", P),
    31: ("pastry", "Caissettes à gâteaux (grandes)", "Cake cases (large)", P),
    30: ("pastry", "Caissettes à gâteaux (petites)", "Cake cases (small)", P),
    54: ("pantry", "Café moulu", "Ground coffee", K),
    53: ("pantry", "Café aux épices", "Spiced coffee", K),
    32: ("pantry", "Miel (petit)", "Honey (small)", P),
    33: ("pantry", "Miel (moyen)", "Honey (medium)", P),
    34: ("pantry", "Miel (grand)", "Honey (large)", P),
    61: ("pantry", "Pollen d'abeille", "Bee pollen", K),
    132: ("pantry", "Sel de l'Himalaya", "Himalayan salt", K),
    125: ("pantry", "Sel", "Salt", K),
    72: ("pantry", "Câpres", "Capers", P),
    137: ("pantry", "Bicarbonate de soude", "Baking soda", P),
    153: ("pantry", "Vinaigre de cidre (grand)", "Apple cider vinegar (large)", P),
    154: ("pantry", "Vinaigre de cidre (petit)", "Apple cider vinegar (small)", P),
    278: ("pantry", "Vinaigre (grande bouteille)", "Vinegar (large bottle)", P),
    175: ("beauty", "Henné en poudre", "Henna powder", K),
    208: ("beauty", "Henné (sachet)", "Henna (sachet)", P),
    163: ("beauty", "Henné Tamzourine", "Tamzourine henna", P),
    277: ("beauty", "Henné Oued Eddahab", "Oued Eddahab henna", P),
    287: ("beauty", "Henné Najwa", "Najwa henna", P),
    69: ("beauty", None, None, P),
    194: ("beauty", "Savon noir beldi", "Black soap (beldi)", K),
    198: ("beauty", "Savon noir aux herbes", "Herbal black soap", P),
    205: ("beauty", "Ghassoul", "Ghassoul clay", P),
    237: ("beauty", "Ghassoul blanc", "White ghassoul", P),
    51: ("beauty", "Poudre de sidr", "Sidr powder", K),
    187: ("beauty", "Huile d'argan", "Argan oil", P),
    160: ("beauty", "Huile aux herbes", "Herbal oil", P),
    162: ("beauty", "Huile aux herbes premium", "Herbal oil (premium)", P),
    161: ("beauty", "Huile aux herbes naturelle", "Natural herbal oil", P),
    227: ("beauty", "Akar fassi", "Akar fassi (natural blush)", P),
    126: ("beauty", "Pierre d'alun", "Alum stone", K),
    176: ("beauty", "Siwak", "Miswak stick", P),
    211: ("beauty", "Nila bleue", "Blue nila", P),
    58: ("incense", "Encens (bkhour)", "Incense (bakhour)", P),
    261: ("incense", "Encens Anouar", "Anouar incense", P),
    250: ("incense", "Nadd", "Nadd incense", P),
    127: ("incense", "Benjoin (jaoui)", "Benzoin (jawi)", P),
    86: ("incense", "Musc pur", "Pure musk", P),
    84: ("incense", "Musc (petit)", "Musk (small)", P),
    260: ("incense", "Musc (grand)", "Musk (large)", P),
    210: ("incense", "Brûle-encens (mjmar)", "Incense burner (mjmar)", P),
    238: ("incense", "Charbon pour encens", "Incense charcoal", P),
}


def build(export_path, out_path):
    till = {p["id"]: p for p in json.loads(Path(export_path).read_text(encoding="utf-8"))["products"]}
    products, missing = [], []
    for pid, (cat, fr, en, unit) in CURATION.items():
        p = till.get(pid)
        if not p or not p.get("enabled") or not p.get("price"):
            missing.append(pid)
            continue
        ar = " ".join(str(p["name"]).split())
        products.append({"id": f"p{pid}", "ar": ar, "fr": fr or ar, "en": en or ar, "cat": cat,
                         "price": round(float(p["price"]), 2), "unit": unit,
                         "rank": round(float(p.get("sold_120d") or 0), 3)})
    order = [c[0] for c in CATEGORIES]
    products.sort(key=lambda x: (order.index(x["cat"]), -x["rank"], x["ar"]))
    data = {"categories": [{"id": i, "ar": a, "fr": f, "en": e, "color": c} for i, a, f, e, c in CATEGORIES],
            "products": products}
    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    Path(out_path).write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8", newline="\n")
    return products, missing


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    here = Path(__file__).resolve().parent.parent
    products, missing = build(sys.argv[1], here / "assets" / "catalog" / "products.json")
    print(f"{len(products)} products written; not on the till or no price: {missing}")
