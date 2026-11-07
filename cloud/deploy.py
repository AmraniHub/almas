"""Deploy the Almas back office (cloud/worker.js + cloud/admin/) to Cloudflare, free plan, over curl.

    python cloud/deploy.py            create or update: D1 database almas-shop, tables, Worker almas-shop, workers.dev
    python cloud/deploy.py --rotate   new INGEST_SECRET, ADMIN_KEY and SESSION_SECRET (logs the owner out; the Vercel
                                      env var INGEST_SECRET must then be updated from cloud/.cloud.json)

Writes cloud/.cloud.json ({url, ingest_secret, db}, gitignored) for the Vercel side, and the owner's admin key to
%USERPROFILE%/keys/almas-admin.txt. Secrets are made on the first deploy or with --rotate; every other deploy keeps
the Worker's existing secrets (keep_bindings) and never re-sends them. Nothing secret is printed.

Copied from APPS/Aronium/laptop/cloud-deploy.py: uses the saved wrangler OAuth login (scopes include d1:write) and
the REST API, because wrangler cannot reach the network from this laptop. Cloudflare refresh tokens are SINGLE USE:
the replacement is written back before anything else. Cloudflare 403s Python-urllib, so every call is curl.
Does not touch the aronium-shop Worker or its D1; only calls its public catalogue through a service binding.
No cron triggers (the account is at its 5-cron limit).
"""
import datetime
import json
import os
import re
import secrets
import subprocess
import sys
import tempfile
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
API = "https://api.cloudflare.com/client/v4"
OAUTH = "https://dash.cloudflare.com/oauth2/token"
CLIENT_ID = "54d11594-84e4-41aa-b438-e81b8fa78ee7"  # wrangler's own OAuth client
CFG = Path(os.environ["APPDATA"]) / "xdg.config/.wrangler/config/default.toml"
NAME = "almas-shop"
DB_NAME = "almas-shop"
CATALOG_WORKER = "aronium-shop"  # read-only service binding: the till's public catalogue
COMPAT = "2026-09-01"
LOCAL = HERE / ".cloud.json"
KEYFILE = Path(os.environ.get("USERPROFILE", str(Path.home()))) / "keys" / "almas-admin.txt"
KEY_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"  # no 0/o, 1/l/i: typeable on a phone


def say(m):
    print(str(m).encode("ascii", "backslashreplace").decode(), flush=True)


def tmpfile(suffix):
    fd, name = tempfile.mkstemp(suffix=suffix)
    os.close(fd)  # Windows: an open handle blocks the later delete
    return Path(name)


def curl(args, label, tries=4):
    last = ""
    for _ in range(tries):
        done = subprocess.run(["curl", "-s", "-S", "--max-time", "90"] + args, capture_output=True)
        text = done.stdout.decode("utf-8", "replace")
        if done.returncode == 0 and text.strip():
            return text
        last = (done.stderr.decode("utf-8", "replace") or text)[:300]
        time.sleep(3)
    raise SystemExit("%s failed: %s" % (label, last))


def cf(method, path, token, payload=None, label="", allow_404=False):
    args = ["-X", method, API + path, "-H", "Authorization: Bearer " + token]
    tmp = None
    if payload is not None:
        tmp = tmpfile(".json")
        tmp.write_bytes(json.dumps(payload).encode("utf-8"))
        args += ["-H", "Content-Type: application/json", "--data-binary", "@" + str(tmp)]
    try:
        out = json.loads(curl(args, label or path))
    finally:
        if tmp:
            tmp.unlink()
    if not out.get("success"):
        codes = [e.get("code") for e in out.get("errors") or []]
        if allow_404 and (10007 in codes or 10090 in codes or "not found" in json.dumps(out).lower()):
            return None
        raise SystemExit("%s refused: %s" % (path, json.dumps(out.get("errors") or out)[:400]))
    return out["result"]


def token():
    saved = CFG.read_text(encoding="utf-8")

    def field(n):
        m = re.search(n + r'\s*=\s*"([^"]*)"', saved)
        return m.group(1) if m else ""
    try:
        when = datetime.datetime.fromisoformat(field("expiration_time").replace("Z", "+00:00"))
        if field("oauth_token") and when - datetime.timedelta(minutes=5) > datetime.datetime.now(datetime.timezone.utc):
            return field("oauth_token")
    except ValueError:
        pass
    refresh = field("refresh_token")
    if not refresh:
        raise SystemExit("no Cloudflare login - run APPS/qarun-cloud/login.py")
    fresh = json.loads(curl(["-X", "POST", OAUTH, "-H", "Content-Type: application/x-www-form-urlencoded",
                             "--data-urlencode", "grant_type=refresh_token", "--data-urlencode", "refresh_token=" + refresh,
                             "--data-urlencode", "client_id=" + CLIENT_ID], "token refresh", tries=1))
    if "access_token" not in fresh:
        raise SystemExit("Cloudflare would not refresh the login: %s - run APPS/qarun-cloud/login.py" % json.dumps(fresh)[:200])
    tok = fresh["access_token"]
    expires = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(seconds=int(fresh.get("expires_in", 3600)))).isoformat().replace("+00:00", "Z")
    saved = re.sub(r'(oauth_token\s*=\s*)"[^"]*"', lambda m: m.group(1) + '"%s"' % tok, saved, count=1)
    saved = re.sub(r'(expiration_time\s*=\s*)"[^"]*"', lambda m: m.group(1) + '"%s"' % expires, saved, count=1)
    if fresh.get("refresh_token"):
        saved = re.sub(r'(refresh_token\s*=\s*)"[^"]*"', lambda m: m.group(1) + '"%s"' % fresh["refresh_token"], saved, count=1)
    with open(CFG, "w", encoding="utf-8", newline="") as f:  # the old refresh token is spent: keep the new one first
        f.write(saved)
    say("cloudflare: refreshed and saved the replacement login")
    return tok


def schema():
    text = (HERE / "schema.sql").read_text(encoding="utf-8")
    text = "\n".join(line.split("--", 1)[0] for line in text.splitlines())
    return [s.strip() for s in text.split(";") if s.strip()]


def build():
    out = tmpfile(".mjs")
    done = subprocess.run(["node", str(HERE / "build.mjs"), str(out)], capture_output=True)
    if done.returncode:
        out.unlink()
        raise SystemExit("build failed: " + done.stderr.decode("utf-8", "replace")[:400])
    ok = subprocess.run(["node", "--check", str(out)], capture_output=True)
    code = out.read_bytes()
    out.unlink()
    if ok.returncode:
        raise SystemExit("worker does not parse: " + ok.stderr.decode("utf-8", "replace")[:400])
    bad = [i for i, c in enumerate(code) if c < 9 or 13 < c < 32 or c == 127]
    if bad:
        raise SystemExit("bundle carries raw control bytes at %s" % bad[:5])
    return code


def admin_key():
    return "almas-" + "-".join("".join(secrets.choice(KEY_ALPHABET) for _ in range(5)) for _ in range(4))


def main():
    rotate = "--rotate" in sys.argv
    code = build()
    tok = token()
    acc = cf("GET", "/accounts", tok)[0]["id"]
    dbs = cf("GET", "/accounts/%s/d1/database?name=%s" % (acc, DB_NAME), tok)
    db = next((d for d in dbs if d.get("name") == DB_NAME), None)
    if not db:
        db = cf("POST", "/accounts/%s/d1/database" % acc, tok, {"name": DB_NAME}, "create D1")
        say("D1 database %s created" % DB_NAME)
    dbid = db["uuid"]
    stmts = schema()
    for sql in stmts:
        cf("POST", "/accounts/%s/d1/database/%s/query" % (acc, dbid), tok, {"sql": sql}, "schema")
    say("D1 schema applied (%d statements)" % len(stmts))

    local = json.loads(LOCAL.read_text(encoding="utf-8")) if LOCAL.exists() else {}
    exists = cf("GET", "/accounts/%s/workers/scripts/%s/settings" % (acc, NAME), tok, allow_404=True) is not None
    fresh = rotate or not exists or not local.get("ingest_secret")
    if exists and not rotate and not local.get("ingest_secret"):
        say("cloud/.cloud.json has no ingest secret for the existing Worker: making new secrets")
    bindings = [{"type": "d1", "name": "DB", "id": dbid},
                {"type": "service", "name": "ARONIUM", "service": CATALOG_WORKER, "environment": "production"}]
    metadata = {"main_module": "worker.js", "compatibility_date": COMPAT, "bindings": bindings}
    key = None
    if fresh:
        local["ingest_secret"] = secrets.token_urlsafe(32)
        key = admin_key()
        bindings += [{"type": "secret_text", "name": "INGEST_SECRET", "text": local["ingest_secret"]},
                     {"type": "secret_text", "name": "ADMIN_KEY", "text": key},
                     {"type": "secret_text", "name": "SESSION_SECRET", "text": secrets.token_urlsafe(32)}]
    else:
        metadata["keep_bindings"] = ["secret_text"]  # the Worker keeps its own secrets; none leave this laptop

    scratch = Path(tempfile.mkdtemp())
    (scratch / "metadata.json").write_bytes(json.dumps(metadata).encode("utf-8"))
    (scratch / "worker.js").write_bytes(code)
    cwd = os.getcwd()
    os.chdir(scratch)  # curl -F mangles paths with spaces: name the parts relatively
    try:
        out = json.loads(curl(["-X", "PUT", "%s/accounts/%s/workers/scripts/%s" % (API, acc, NAME), "-H", "Authorization: Bearer " + tok,
                               "-F", "metadata=@metadata.json;type=application/json",
                               "-F", "worker.js=@worker.js;type=application/javascript+module"], "worker upload", tries=2))
    finally:
        os.chdir(cwd)
        for f in scratch.iterdir():
            f.unlink()  # the metadata holds the secrets
        scratch.rmdir()
    if not out.get("success"):
        raise SystemExit("upload refused: %s" % json.dumps(out.get("errors"))[:400])
    say("worker uploaded (%d KB)%s" % (len(code) // 1024, ", new secrets" if fresh else ", secrets kept"))
    cf("POST", "/accounts/%s/workers/scripts/%s/subdomain" % (acc, NAME), tok, {"enabled": True, "previews_enabled": False}, "subdomain")
    sub = cf("GET", "/accounts/%s/workers/subdomain" % acc, tok)["subdomain"]
    local["url"] = "https://%s.%s.workers.dev" % (NAME, sub)
    local["db"] = dbid
    LOCAL.write_bytes(json.dumps({"url": local["url"], "ingest_secret": local["ingest_secret"], "db": dbid}, indent=1).encode("utf-8"))
    if key:
        KEYFILE.parent.mkdir(parents=True, exist_ok=True)
        KEYFILE.write_bytes(key.encode("ascii"))
        say("admin key written to %s" % KEYFILE)
        if exists:
            say("secrets rotated: update INGEST_SECRET on Vercel from cloud/.cloud.json, then redeploy the site")
    say("url: %s  (admin: %s/admin)" % (local["url"], local["url"]))
    for _ in range(10):
        try:
            say("health: %s" % curl([local["url"] + "/health"], "health", tries=1))
            return 0
        except SystemExit:
            time.sleep(6)
    say("uploaded, but %s did not answer yet (a new workers.dev name can take a minute)" % local["url"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
