/**
 * SQLite bağlantısı (Node.js yerleşik `node:sqlite` modülü — ek sürücü gerekmez).
 * Tüm menü, görsel ve oturum verileri tek bir dosyada kalıcı olarak saklanır: data/menu.db
 */
import { DatabaseSync, type SQLInputValue, type StatementSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { migrate } from "./migrations";

export type Param = SQLInputValue;
type Row = Record<string, unknown>;

export class Db {
  readonly raw: DatabaseSync;
  private cache = new Map<string, StatementSync>();
  private depth = 0;

  constructor(file: string) {
    if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
    this.raw = new DatabaseSync(file);
    this.raw.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA foreign_keys = ON;
      PRAGMA busy_timeout = 5000;
    `);
    migrate(this);
  }

  private stmt(sql: string): StatementSync {
    let s = this.cache.get(sql);
    if (!s) {
      s = this.raw.prepare(sql);
      this.cache.set(sql, s);
    }
    return s;
  }

  get<T = Row>(sql: string, ...params: Param[]): T | undefined {
    return this.stmt(sql).get(...params) as T | undefined;
  }

  all<T = Row>(sql: string, ...params: Param[]): T[] {
    return this.stmt(sql).all(...params) as T[];
  }

  run(sql: string, ...params: Param[]): { changes: number; lastInsertRowid: number } {
    const r = this.stmt(sql).run(...params);
    return { changes: Number(r.changes), lastInsertRowid: Number(r.lastInsertRowid) };
  }

  exec(sql: string) {
    this.raw.exec(sql);
  }

  /** İşlem (transaction). İç içe çağrılar SAVEPOINT kullanır. */
  tx<T>(fn: () => T): T {
    const name = `sp_${this.depth}`;
    if (this.depth === 0) this.raw.exec("BEGIN IMMEDIATE");
    else this.raw.exec(`SAVEPOINT ${name}`);
    this.depth++;
    try {
      const result = fn();
      this.depth--;
      if (this.depth === 0) this.raw.exec("COMMIT");
      else this.raw.exec(`RELEASE ${name}`);
      return result;
    } catch (err) {
      this.depth--;
      if (this.depth === 0) this.raw.exec("ROLLBACK");
      else this.raw.exec(`ROLLBACK TO ${name}; RELEASE ${name}`);
      throw err;
    }
  }

  close() {
    this.cache.clear();
    this.raw.close();
  }
}

let instance: Db | null = null;

export function openDb(file: string): Db {
  if (instance) instance.close();
  instance = new Db(file);
  return instance;
}

export function db(): Db {
  if (!instance) throw new Error("Veritabanı henüz açılmadı (openDb çağrılmalı).");
  return instance;
}

export function nowIso() {
  return new Date().toISOString();
}

export const bool = (v: unknown) => v === 1 || v === 1n || v === true;
