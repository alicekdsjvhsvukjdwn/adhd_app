import { DatabaseSync } from "node:sqlite";

/** Les paramètres arrivent en liste, en tableau ou avec des undefined : node:sqlite veut une liste de valeurs. */
const valeurs = (p) => (p.length === 1 && Array.isArray(p[0]) ? p[0] : p).map((v) => (v === undefined ? null : v));

class Base {
  constructor() {
    this.d = new DatabaseSync(":memory:");
  }
  async execAsync(sql) {
    this.d.exec(sql);
  }
  async runAsync(sql, ...p) {
    const r = this.d.prepare(sql).run(...valeurs(p));
    return { lastInsertRowId: Number(r.lastInsertRowid), changes: Number(r.changes) };
  }
  async getAllAsync(sql, ...p) {
    return this.d.prepare(sql).all(...valeurs(p));
  }
  async getFirstAsync(sql, ...p) {
    return this.d.prepare(sql).get(...valeurs(p)) ?? null;
  }
  async withTransactionAsync(travail) {
    this.d.exec("BEGIN");
    try {
      await travail();
      this.d.exec("COMMIT");
    } catch (e) {
      this.d.exec("ROLLBACK");
      throw e;
    }
  }
  async withExclusiveTransactionAsync(travail) {
    return this.withTransactionAsync(() => travail(this));
  }
  async closeAsync() {}
}

const bases = new Map();
export async function openDatabaseAsync(nom) {
  if (!bases.has(nom)) bases.set(nom, new Base());
  return bases.get(nom);
}
export async function deleteDatabaseAsync(nom) {
  bases.delete(nom);
}
