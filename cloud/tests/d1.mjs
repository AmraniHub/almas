// A D1 stand-in on node:sqlite (Node 22.13+), enough of the binding for worker.js: prepare/bind/first/all/run
// and batch() as one transaction, with the same result shapes ({results}, {meta: {changes}}).
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";

// every real D1 call is a network round trip: yield once so concurrent requests interleave as they do in production
const tick = () => new Promise((r) => setImmediate(r));

class Stmt {
  constructor(db, sql, args = []) {
    this.db = db;
    this.sql = sql;
    this.args = args;
  }
  bind(...args) {
    for (const a of args) if (a === undefined) throw new Error("D1_TYPE_ERROR: undefined bound in " + this.sql);
    return new Stmt(this.db, this.sql, args);
  }
  _prep() {
    return this.db.prepare(this.sql);
  }
  _exec() {
    const p = this._prep();
    if (/^\s*(select|with)\b/i.test(this.sql)) return { results: p.all(...this.args).map((r) => ({ ...r })), success: true, meta: { changes: 0 } };
    const r = p.run(...this.args);
    return { results: [], success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
  }
  async first(col) {
    await tick();
    const r = this._prep().get(...this.args);
    if (!r) return null;
    return col ? r[col] : { ...r };
  }
  async all() {
    await tick();
    return this._exec();
  }
  async run() {
    await tick();
    return this._exec();
  }
}

export function fakeD1(schemaPath) {
  const db = new DatabaseSync(":memory:");
  for (const sql of readFileSync(schemaPath, "utf8").replace(/--[^\n]*/g, "").split(";")) if (sql.trim()) db.exec(sql);
  return {
    raw: db,
    prepare: (sql) => new Stmt(db, sql),
    async batch(stmts) {
      await tick();
      db.exec("begin");
      try {
        const out = stmts.map((s) => s._exec());
        db.exec("commit");
        return out;
      } catch (e) {
        db.exec("rollback");
        throw e;
      }
    },
  };
}
