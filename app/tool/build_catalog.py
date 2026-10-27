"""Build assets/catalog/products.json, the catalogue built into the app, from the shop's till (Aronium).

    python tool/build_catalog.py <till-export.json>

The export comes from the till (export_catalog.py in the Aronium repo): every product with its Arabic name and
current price. tool/curation.json decides which of them the app shows, on which shelf, with which French and
English name, and whether it is sold by the kilo (step 250 g) or by the piece. The till reads the same file to
publish the live catalogue online (Aronium shop/agent/app_feed.py), so the two never disagree; the app loads the
live one when it has internet and falls back to this one.

A product left out of curation.json is not in the app: household brands, duplicates, placeholders, and anything
sold as a remedy (Play forbids medical claims). Prices and Arabic names always come from the till. A French or
English name left as null falls back to the Arabic one, rather than a guessed translation.
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
CURATION = HERE / "curation.json"


def build(export_path, out_path, curation_path=CURATION):
    cur = json.loads(Path(curation_path).read_text(encoding="utf-8"))
    till = {p["id"]: p for p in json.loads(Path(export_path).read_text(encoding="utf-8"))["products"]}
    products, missing = [], []
    for key, c in cur["products"].items():
        pid = int(key)
        p = till.get(pid)
        if not p or not p.get("enabled") or not p.get("price"):
            missing.append(pid)
            continue
        ar = " ".join(str(p["name"]).split())
        products.append({"id": f"p{pid}", "ar": ar, "fr": c["fr"] or ar, "en": c["en"] or ar, "cat": c["cat"],
                         "price": round(float(p["price"]), 2), "unit": c["unit"],
                         "rank": round(float(p.get("sold_120d") or 0), 3)})
    order = [c["id"] for c in cur["categories"]]
    products.sort(key=lambda x: (order.index(x["cat"]), -x["rank"], x["ar"]))
    data = {"categories": cur["categories"], "products": products}
    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    Path(out_path).write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8", newline="\n")
    return products, missing


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    products, missing = build(sys.argv[1], HERE.parent / "assets" / "catalog" / "products.json")
    print(f"{len(products)} products written; not on the till or no price: {missing}")
