"""Deploy the website to Vercel from the laptop, over the REST API with curl (the Vercel CLI's uploads die on
this 4G link). Uploads only what site/build.py needs and lets Vercel run the build (vercel.json), so a laptop
deploy and a git deploy produce the same site from the till's live catalogue.

    python site/deploy-vercel.py            production
    python site/deploy-vercel.py --preview

The token comes from the Vercel CLI's newest auth.json (run `vercel whoami` first to refresh it) and is never
printed or put on a command line. Not needed once the Vercel GitHub app can see AmraniHub/almas: then every
push deploys by itself.
"""
import hashlib
import json
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PROJECT = "almas-epices"
TEAM = "team_ue3PsJr6RqkpDCV8sS5nHmKX"
# what the build reads: the generator, its static files, the app's privacy page and Play images, and the
# app's built-in catalogue (the build's fallback when the till's feed cannot be reached)
INCLUDE = ["vercel.json", "site", "docs/privacy-policy.html", "docs/store", "app/assets/catalog/products.json"]
SKIP = {"__pycache__", "deploy-vercel.py", "cards.py"}


def token():
    a = Path(os.environ["APPDATA"])
    files = [f for f in (a / "xdg.data" / "com.vercel.cli" / "auth.json", a / "com.vercel.cli" / "Data" / "auth.json")
             if f.exists()]
    if not files:
        sys.exit("no Vercel credentials: run vercel login")
    return json.loads(max(files, key=lambda f: f.stat().st_mtime).read_text(encoding="utf-8"))["token"]


def curl(args, data_file=None):
    cmd = ["curl", "-s", "--max-time", "120", "--retry", "20", "--retry-all-errors"] + args
    if data_file:
        cmd += ["--data-binary", "@" + str(data_file)]
    r = subprocess.run(cmd, capture_output=True)
    out = r.stdout.decode("utf-8", "replace")
    try:
        return json.loads(out) if out.strip() else {}
    except ValueError:
        return {"raw": out[:300]}


def api(tok, method, path, body=None):
    args = ["-X", method, "-H", "Authorization: Bearer " + tok, "-H", "Content-Type: application/json",
            f"https://api.vercel.com{path}{'&' if '?' in path else '?'}teamId={TEAM}"]
    if body is None:
        return curl(args)
    fd, tmp = tempfile.mkstemp(suffix=".json")
    os.close(fd)
    try:
        Path(tmp).write_text(json.dumps(body), encoding="utf-8")
        return curl(args, tmp)
    finally:
        os.unlink(tmp)


def files():
    out = []
    for inc in INCLUDE:
        p = ROOT / inc
        for f in ([p] if p.is_file() else sorted(p.rglob("*"))):
            if f.is_file() and not (SKIP & set(f.relative_to(ROOT).parts)):
                out.append(f)
    return out


def main():
    tok = token()
    listed = []
    for f in files():
        data = f.read_bytes()
        sha = hashlib.sha1(data).hexdigest()
        rel = f.relative_to(ROOT).as_posix()
        r = curl(["-X", "POST", "-H", "Authorization: Bearer " + tok, "-H", "Content-Type: application/octet-stream",
                  "-H", f"x-vercel-digest: {sha}", "-H", f"Content-Length: {len(data)}",
                  f"https://api.vercel.com/v2/files?teamId={TEAM}"], f)
        if r.get("error") and r["error"].get("code") != "file_exists":
            sys.exit(f"upload failed for {rel}: {r['error']}")
        listed.append({"file": rel, "sha": sha, "size": len(data)})
    print(f"{len(listed)} files uploaded")
    body = {"name": PROJECT, "project": PROJECT, "files": listed,
            "projectSettings": {"framework": None, "buildCommand": "python3 site/build.py",
                                "outputDirectory": "public", "installCommand": "echo no install"}}
    if "--preview" not in sys.argv:
        body["target"] = "production"
    d = api(tok, "POST", "/v13/deployments", body)
    if d.get("error"):
        sys.exit(f"deployment refused: {d['error']}")
    print("deployment", d.get("id"), d.get("url"))
    for _ in range(60):
        time.sleep(5)
        s = api(tok, "GET", f"/v13/deployments/{d['id']}")
        state = s.get("readyState")
        if state in ("READY", "ERROR", "CANCELED"):
            print("state", state, "aliases", s.get("alias"))
            if state != "READY":
                sys.exit(1)
            return
    sys.exit("still building after 5 minutes")


if __name__ == "__main__":
    main()
