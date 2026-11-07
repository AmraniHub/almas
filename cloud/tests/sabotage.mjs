// Proves the tests guard something: each entry breaks one guard in a copy of worker.js, runs the suite against
// it (ALMAS_WORKER_SRC), and expects at least one failure. A sabotage whose text is not found is itself a failure,
// so a refactor cannot silently turn this into a no-op.
//   node cloud/tests/sabotage.mjs
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(HERE, "..", "worker.js"), "utf8");

const CASES = [
  ["ingest secret check removed", 'if (!(await secretEquals(env, req.headers.get("X-Almas-Secret"), env.INGEST_SECRET))) throw new Http(401, "secret");', ""],
  ["concurrent-retry catch removed", 'if (/UNIQUE|constraint/i.test(String(e && e.message))) return { ok: true, duplicate: true };', ""],
  ["order idempotency removed (both layers)", 'if (await first(env, "select 1 x from orders where id = ?", id)) return { ok: true, duplicate: true };',
    "", 'if (/UNIQUE|constraint/i.test(String(e && e.message))) return { ok: true, duplicate: true };', ""],
  ["Moroccan 06 numbers not normalised", 'if (d.length === 10 && d.startsWith("0")) d = "212" + d.slice(1);', ""],
  ["control characters kept", "else if (n < 32 || (n >= 127 && n < 160)", "else if (false"],
  ["review verified without the phone", "o.id = ? and o.phone_norm = ? and i.product = ?", "o.id = ? and ? <> '' and i.product = ?"],
  ["review rate limit raised", "const REVIEWS_PER_DAY = 5;", "const REVIEWS_PER_DAY = 50;"],
  ["raw ip stored", "nowIso(), iph),", "nowIso(), text(b.ip, 64)),"],
  ["pending reviews public", "where product = ? and status = 'published' order by at desc", "where product = ? order by at desc"],
  ["CORS localhost regex unanchored", "(:\\d{1,5})?$/.test(o)", "(:\\d{1,5})?/.test(o)"],
  ["login lock raised", "const LOGIN_FAILS = 5;", "const LOGIN_FAILS = 50;"],
  ["session cookie SameSite=Lax", "Max-Age=${SESSION_DAYS * 86400}; HttpOnly; Secure; SameSite=Strict", "Max-Age=${SESSION_DAYS * 86400}; HttpOnly; Secure; SameSite=Lax"],
  ["session signature not checked", 'if (!same(c.slice(dot + 1), await hmac(env.SESSION_SECRET, "sess:" + payload))) return false;', ""],
  ["admin API without a session", 'if (!(await isAdmin(req, env))) throw new Http(401, "login");', ""],
  ["CSRF header not required", 'if (req.headers.get("X-Almas-Csrf") !== "1" ||', "if ("],
  ["foreign Origin accepted", "(origin && origin !== url.origin)", "false"],
  ["CSV formulas not neutralised", `s = "'" + s; // no formulas`, "s = s; // no formulas"],
  ["CSV without BOM", "new Response(BOM + lines.join(CRLF)", "new Response(lines.join(CRLF)"],
  ["CSP allows inline script", "script-src 'self'; style-src", "script-src 'self' 'unsafe-inline'; style-src"],
  ["LIKE wildcards not escaped", 'return "%" + q.replace(/[!%_]/g, (c) => "!" + c) + "%";', 'return "%" + q + "%";'],
  ["paid_at overwritten", "paid = 1, paid_at = coalesce(paid_at, ?)", "paid = 1, paid_at = ?"],
  ["invisible marks not cleaned from the key", "invisibleClean(b.key)", 'String(b.key || "")'],
  ["published reviews dropped from ratings", "from reviews where status = 'published' group by product\");", "from reviews where status = 'nothing' group by product\");"],
];

const dir = mkdtempSync(join(tmpdir(), "almas-sabotage-"));
let bad = 0;
for (const [label, ...pairs] of CASES) {
  let broken = SRC;
  let missing = false;
  for (let i = 0; i < pairs.length; i += 2) {
    if (!broken.includes(pairs[i])) missing = true;
    broken = broken.replace(pairs[i], () => pairs[i + 1]);
  }
  if (missing) {
    console.log("MISSING  " + label + " (text not found in worker.js)");
    bad++;
    continue;
  }
  const file = join(dir, "worker.js");
  writeFileSync(file, broken, "utf8");
  const run = spawnSync(process.execPath, ["--test", join(HERE, "worker.test.mjs")], {
    env: { ...process.env, ALMAS_WORKER_SRC: file }, encoding: "utf8",
  });
  const failed = (run.stdout.match(/^# fail (\d+)/m) || [])[1];
  if (run.status !== 0 && Number(failed) > 0) console.log("caught   " + label + " (" + failed + " failing)");
  else {
    console.log("MISSED   " + label + " (suite still green)");
    bad++;
  }
}
console.log(bad ? `${bad} of ${CASES.length} sabotages NOT caught` : `all ${CASES.length} sabotages caught`);
process.exit(bad ? 1 : 0);
