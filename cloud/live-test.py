"""End-to-end check of the deployed back office, then removal of everything it created.

    python cloud/live-test.py

Reads the URL and ingest secret from cloud/.cloud.json and the admin key from %USERPROFILE%/keys/almas-admin.txt.
Secrets travel only in curl header/body files (never a command line, never stdout). Creates order AL-TEST-0001,
quote QT-TEST-0001 and one review, checks the whole contract, and deletes all of them (plus the test customer) in
a finally block, so production is left clean even when a check fails. Exit 0 = every check passed.
"""
import json
import os
import subprocess
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
CONF = json.loads((HERE / ".cloud.json").read_text(encoding="utf-8"))
URL = CONF["url"]
KEYFILE = Path(os.environ.get("USERPROFILE", str(Path.home()))) / "keys" / "almas-admin.txt"
SITE = "https://almas-epices.vercel.app"
ORDER_ID = "AL-TEST-0001"
QUOTE_ID = "QT-TEST-0001"
PHONE = "06 00 00 00 01"
PN = "212600000001"
WORK = Path(tempfile.mkdtemp(prefix="almas-live-"))
JAR = WORK / "jar.txt"
results = []


def say(m):
    print(str(m).encode("ascii", "backslashreplace").decode(), flush=True)


def check(label, ok, detail=""):
    results.append(bool(ok))
    say(("PASS  " if ok else "FAIL  ") + label + (("  -- " + detail) if detail and not ok else ""))
    return ok


def curl(method, path, body=None, headers=None, secret=False, admin=False, raw=False):
    """-> (status, parsed json or bytes, response headers dict lowercased)"""
    args = ["curl", "-s", "-S", "--max-time", "60", "--retry", "3", "-X", method, URL + path, "-D", str(WORK / "h.txt"), "-o", str(WORK / "b.bin"),
            "-w", "%{http_code}"]
    hfile = WORK / "req-headers.txt"
    lines = list(headers or [])
    if secret:
        lines.append("X-Almas-Secret: " + CONF["ingest_secret"])
    if admin:
        args += ["-b", str(JAR), "-c", str(JAR)]
        if method == "POST":
            lines.append("X-Almas-Csrf: 1")
    if body is not None:
        (WORK / "body.json").write_bytes(json.dumps(body, ensure_ascii=False).encode("utf-8"))
        args += ["--data-binary", "@" + str(WORK / "body.json")]
        lines.append("Content-Type: application/json")
    hfile.write_bytes("\n".join(lines).encode("utf-8"))
    if lines:
        args += ["-H", "@" + str(hfile)]
    done = subprocess.run(args, capture_output=True)
    status = int(done.stdout.decode() or 0)
    data = (WORK / "b.bin").read_bytes() if (WORK / "b.bin").exists() else b""
    hdrs = {}
    for line in (WORK / "h.txt").read_bytes().decode("utf-8", "replace").splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            hdrs[k.strip().lower()] = v.strip()
    for f in ("body.json", "req-headers.txt", "b.bin", "h.txt"):
        (WORK / f).unlink(missing_ok=True)
    if raw:
        return status, data, hdrs
    try:
        return status, json.loads(data.decode("utf-8")), hdrs
    except ValueError:
        return status, data[:200], hdrs


def main():
    s, d, _ = curl("GET", "/health")
    check("/health ok and db", s == 200 and d == {"ok": True, "db": True}, str(d))

    s, d, _ = curl("GET", "/admin/app.js")
    check("admin script served", s == 200)

    s, d, _ = curl("POST", "/ingest/order", body={"id": "AL-NOPE-0001"}, headers=["X-Almas-Secret: wrong"])
    check("ingest with a wrong secret -> 401", s == 401, str(s))

    s, d, _ = curl("GET", "/admin/api/products")
    check("admin API without a session -> 401", s == 401, str(s))

    order = {"id": ORDER_ID, "at": None, "lang": "ar", "name": "Test Almas", "phone": PHONE, "address": "Test address, Tangier",
             "notes": "automated test, will be deleted", "pay": "bank", "total": 75, "source": "live-test",
             "items": [{"product": "p13", "name_till": "الفلفلة حلوة", "name": "الفلفلة حلوة", "qty": 0.5, "unit": "kg", "unit_price": 60, "line": 30},
                       {"product": "p2", "name_till": "الخرقوم", "name": "الخرقوم", "qty": 0.25, "unit": "kg", "unit_price": 70, "line": 17.5},
                       {"product": "p1", "name_till": "سكنجبر", "name": "سكنجبر", "qty": 0.25, "unit": "kg", "unit_price": 90, "line": 22.5}]}
    order.pop("at")
    s1, d1, _ = curl("POST", "/ingest/order", body=order, secret=True)
    check("order ingest -> {ok:true}", s1 == 200 and d1 == {"ok": True}, "%s %s" % (s1, d1))
    s2, d2, _ = curl("POST", "/ingest/order", body=order, secret=True)
    check("same order again -> ok, duplicate", s2 == 200 and d2.get("ok") and d2.get("duplicate"), "%s %s" % (s2, d2))

    s, d, _ = curl("POST", "/ingest/paid", body={"id": ORDER_ID, "stripe_session": "cs_test_live", "amount": 75}, secret=True)
    check("paid ingest -> ok", s == 200 and d.get("ok"), "%s %s" % (s, d))

    quote = {"id": QUOTE_ID, "lang": "fr", "type": "restaurant", "business": "Test Restaurant", "contact": "Test", "phone": PHONE,
             "city": "Tanger", "date": "2026-12-20", "guests": "80", "freq": "monthly", "items": "cumin 2 kg (test)"}
    s, d, _ = curl("POST", "/ingest/quote", body=quote, secret=True)
    check("quote ingest -> {ok:true}", s == 200 and d == {"ok": True}, "%s %s" % (s, d))
    s, d, _ = curl("POST", "/ingest/quote", body=quote, secret=True)
    check("same quote again -> duplicate", s == 200 and d.get("duplicate"), "%s %s" % (s, d))

    review = {"product": "p13", "rating": 5, "text": "Test review, will be deleted", "name": "Tester", "lang": "en",
              "order_id": ORDER_ID, "phone": "+212600000001", "ip": "203.0.113.7"}
    s, d, _ = curl("POST", "/ingest/review", body=review, secret=True)
    check("verified review -> verified 1", s == 200 and d == {"ok": True, "verified": 1}, "%s %s" % (s, d))

    s, d, h = curl("GET", "/public/reviews?product=p13", headers=["Origin: " + SITE])
    check("pending review not public", s == 200 and d.get("count") == 0 and d.get("reviews") == [], str(d))
    check("CORS echoes the Vercel origin", h.get("access-control-allow-origin") == SITE, str(h.get("access-control-allow-origin")))
    check("reviews Cache-Control max-age=60", h.get("cache-control") == "public, max-age=60", str(h.get("cache-control")))
    s, d, h = curl("GET", "/public/ratings", headers=["Origin: https://evil.example"])
    check("foreign origin gets no CORS header", "access-control-allow-origin" not in h, str(h.get("access-control-allow-origin")))

    s, d, _ = curl("POST", "/admin/api/login", body={"key": "definitely-wrong"}, admin=True)
    check("wrong admin key -> 403", s == 403, str(s))
    s, d, _ = curl("POST", "/admin/api/login", body={"key": KEYFILE.read_text(encoding="utf-8").strip()}, admin=True)
    jar = JAR.read_text(encoding="utf-8") if JAR.exists() else ""
    check("admin login -> cookie", s == 200 and "almas_admin" in jar, str(s))
    check("cookie is HttpOnly (curl marks #HttpOnly_)", "#HttpOnly_" in jar)

    s, d, _ = curl("GET", "/admin/api/order?id=" + ORDER_ID, admin=True)
    ok = s == 200 and isinstance(d, dict)
    check("order stored once with 3 items", ok and len(d["items"]) == 3, str(d)[:200])
    if ok:
        o = d["order"]
        check("phone normalised to 2126..", o["phone_norm"] == PN, o["phone_norm"])
        check("paid=1 and stripe session kept", o["paid"] == 1 and o["stripe_session"] == "cs_test_live", str((o["paid"], o["stripe_session"])))

    s, d, _ = curl("GET", "/admin/api/reviews?status=pending", admin=True)
    mine = [r for r in (d.get("reviews") or []) if r.get("order_id") == ORDER_ID]
    check("admin sees the pending review with the product name", len(mine) == 1 and (mine[0].get("product_name") or {}).get("ar"), str(d)[:200])
    if mine:
        s, d, _ = curl("POST", "/admin/api/review", body={"id": mine[0]["id"], "status": "published"}, headers=[])
        check("publish without session and CSRF header -> refused", s in (401, 403), str(s))
        s, d, _ = curl("POST", "/admin/api/review", body={"id": mine[0]["id"], "status": "published"}, admin=True)
        check("admin publishes the review", s == 200 and d.get("ok"), "%s %s" % (s, d))

    s, d, _ = curl("GET", "/public/reviews?product=p13", headers=["Origin: " + SITE])
    revs = d.get("reviews") or []
    check("published review is public", s == 200 and d.get("count") == 1 and d.get("avg") == 5 and len(revs) == 1, str(d)[:200])
    if revs:
        check("public review shape", sorted(revs[0]) == ["date", "lang", "name", "rating", "text", "verified"] and revs[0]["verified"] == 1, str(revs[0]))
    s, d, h = curl("GET", "/public/ratings", headers=["Origin: " + SITE])
    check("ratings has p13 avg 5 count 1", d.get("p13") == {"avg": 5, "count": 1}, str(d))
    check("ratings Cache-Control max-age=300", h.get("cache-control") == "public, max-age=300", str(h.get("cache-control")))

    s, d, _ = curl("GET", "/admin/api/overview", admin=True)
    check("overview counts the test order", s == 200 and d.get("today", {}).get("orders", 0) >= 1 and d.get("new_quotes", 0) >= 1, str(d)[:200])
    s, d, _ = curl("GET", "/admin/api/products", admin=True)
    prods = d.get("products") or []
    p13 = next((p for p in prods if p["id"] == "p13"), {})
    check("products: catalogue read through the binding", s == 200 and len(prods) >= 100 and not d.get("error"), "%s n=%d %s" % (s, len(prods), d.get("error")))
    check("products: p13 sales and rating", p13.get("rev30") == 30 and p13.get("count") == 1, str(p13))
    s, d, _ = curl("GET", "/admin/api/customer?phone=" + PN, admin=True)
    check("customer file has the order and the quote, kind pro", s == 200 and len(d.get("orders", [])) == 1 and len(d.get("quotes", [])) == 1
          and d["customer"]["kind"] == "pro", str(d)[:200])
    s, data, h = curl("GET", "/admin/export/orders.csv", admin=True, raw=True)
    check("orders CSV with BOM", s == 200 and data[:3] == b"\xef\xbb\xbf" and ORDER_ID.encode() in data, "%s %r" % (s, data[:20]))
    s, data, h = curl("GET", "/admin/export/customers.csv", admin=True, raw=True)
    check("customers CSV with BOM", s == 200 and data[:3] == b"\xef\xbb\xbf" and PN.encode() in data, "%s %r" % (s, data[:20]))


def cleanup():
    say("-- cleanup")
    s, d, _ = curl("GET", "/admin/api/reviews", admin=True)
    for r in d.get("reviews") or [] if isinstance(d, dict) else []:
        if r.get("order_id") == ORDER_ID or r.get("text") == "Test review, will be deleted":
            s, _, _ = curl("POST", "/admin/api/review/delete", body={"id": r["id"]}, admin=True)
            check("deleted test review %s" % r["id"], s == 200, str(s))
    s, _, _ = curl("POST", "/admin/api/order/delete", body={"id": ORDER_ID}, admin=True)
    check("deleted test order", s in (200, 404), str(s))
    s, _, _ = curl("POST", "/admin/api/quote/delete", body={"id": QUOTE_ID}, admin=True)
    check("deleted test quote", s in (200, 404), str(s))
    s, _, _ = curl("POST", "/admin/api/customer/delete", body={"phone_norm": PN}, admin=True)
    check("deleted test customer", s in (200, 404), str(s))
    s, d, _ = curl("GET", "/admin/api/order?id=" + ORDER_ID, admin=True)
    check("order is gone", s == 404, str(s))
    s, d, _ = curl("GET", "/admin/api/overview", admin=True)
    check("production is empty again", s == 200 and d["d30"]["orders"] == 0 and d["pending_reviews"] == 0 and d["new_quotes"] == 0, str(d)[:300])
    s, d, _ = curl("GET", "/public/ratings")
    check("no public ratings left", d == {}, str(d))
    s, d, _ = curl("GET", "/admin/api/customers", admin=True)
    check("no customers left", s == 200 and d.get("customers") == [], str(d)[:200])
    curl("POST", "/admin/api/logout", body={}, admin=True)


if __name__ == "__main__":
    try:
        main()
    finally:
        try:
            cleanup()
        finally:
            JAR.unlink(missing_ok=True)
            for f in WORK.iterdir():
                f.unlink()
            WORK.rmdir()
    say("%d/%d checks passed" % (sum(results), len(results)))
    raise SystemExit(0 if all(results) else 1)
