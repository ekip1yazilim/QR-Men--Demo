/**
 * Şema göçleri. Yeni bir değişiklik gerektiğinde listeye yeni bir sürüm ekleyin;
 * mevcut sürümleri asla değiştirmeyin. Her göç tek bir işlem içinde uygulanır.
 */
import type { Db } from "./index";

const NOW = "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))";

const MIGRATIONS: { version: number; name: string; sql: string }[] = [
  {
    version: 1,
    name: "ilk şema",
    sql: `
      CREATE TABLE settings (
        key         TEXT PRIMARY KEY,
        value       TEXT NOT NULL,
        updated_at  TEXT NOT NULL DEFAULT ${NOW}
      );

      CREATE TABLE images (
        id           TEXT PRIMARY KEY,
        kind         TEXT NOT NULL CHECK (kind IN ('product','cover','logo')),
        width        INTEGER NOT NULL,
        height       INTEGER NOT NULL,
        placeholder  TEXT,
        original_name TEXT NOT NULL DEFAULT '',
        bytes_total  INTEGER NOT NULL DEFAULT 0,
        created_at   TEXT NOT NULL DEFAULT ${NOW}
      );

      CREATE TABLE image_variants (
        image_id  TEXT NOT NULL REFERENCES images(id) ON DELETE CASCADE,
        width     INTEGER NOT NULL,
        height    INTEGER NOT NULL,
        data      BLOB NOT NULL,
        PRIMARY KEY (image_id, width)
      );

      CREATE TABLE categories (
        id           INTEGER PRIMARY KEY,
        name         TEXT NOT NULL,
        slug         TEXT NOT NULL UNIQUE,
        description  TEXT NOT NULL DEFAULT '',
        icon         TEXT NOT NULL DEFAULT 'utensils',
        sort_order   INTEGER NOT NULL DEFAULT 0,
        is_active    INTEGER NOT NULL DEFAULT 1,
        created_at   TEXT NOT NULL DEFAULT ${NOW},
        updated_at   TEXT NOT NULL DEFAULT ${NOW}
      );

      CREATE TABLE products (
        id           INTEGER PRIMARY KEY,
        category_id  INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
        name         TEXT NOT NULL,
        slug         TEXT NOT NULL UNIQUE,
        description  TEXT NOT NULL DEFAULT '',
        price_cents  INTEGER NOT NULL CHECK (price_cents >= 0),
        image_id     TEXT REFERENCES images(id) ON DELETE SET NULL,
        is_active    INTEGER NOT NULL DEFAULT 1,
        is_featured  INTEGER NOT NULL DEFAULT 0,
        is_sold_out  INTEGER NOT NULL DEFAULT 0,
        badges       TEXT NOT NULL DEFAULT '[]',
        allergens    TEXT NOT NULL DEFAULT '',
        calories     INTEGER,
        sort_order   INTEGER NOT NULL DEFAULT 0,
        created_at   TEXT NOT NULL DEFAULT ${NOW},
        updated_at   TEXT NOT NULL DEFAULT ${NOW}
      );
      CREATE INDEX products_by_category ON products(category_id, sort_order);
      CREATE INDEX products_by_image ON products(image_id);

      CREATE TABLE users (
        id                   INTEGER PRIMARY KEY,
        email                TEXT NOT NULL UNIQUE COLLATE NOCASE,
        name                 TEXT NOT NULL,
        password_hash        TEXT NOT NULL,
        created_at           TEXT NOT NULL DEFAULT ${NOW},
        updated_at           TEXT NOT NULL DEFAULT ${NOW},
        password_changed_at  TEXT NOT NULL DEFAULT ${NOW},
        last_login_at        TEXT
      );

      CREATE TABLE sessions (
        id            TEXT PRIMARY KEY,           -- sha256(token); düz token saklanmaz
        user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        csrf          TEXT NOT NULL,
        created_at    TEXT NOT NULL DEFAULT ${NOW},
        last_seen_at  TEXT NOT NULL DEFAULT ${NOW},
        expires_at    TEXT NOT NULL,
        remember      INTEGER NOT NULL DEFAULT 0,
        ip            TEXT NOT NULL DEFAULT '',
        user_agent    TEXT NOT NULL DEFAULT ''
      );
      CREATE INDEX sessions_by_user ON sessions(user_id);

      CREATE TABLE login_attempts (
        key               TEXT PRIMARY KEY,
        failures          INTEGER NOT NULL,
        first_failure_at  INTEGER NOT NULL,
        locked_until      INTEGER
      );

      CREATE TABLE activity (
        id          INTEGER PRIMARY KEY,
        user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
        action      TEXT NOT NULL,
        entity      TEXT NOT NULL,
        entity_id   TEXT,
        summary     TEXT NOT NULL,
        created_at  TEXT NOT NULL DEFAULT ${NOW}
      );
      CREATE INDEX activity_by_time ON activity(created_at DESC);

      CREATE TABLE menu_views (
        day    TEXT PRIMARY KEY,
        views  INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE product_views (
        day         TEXT NOT NULL,
        product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        views       INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (day, product_id)
      );
    `,
  },
  {
    version: 2,
    name: "görsel kaynak bilgisi",
    // Lisanslı örnek fotoğraflar için yazar / lisans / kaynak (JSON). Restoranın kendi görsellerinde NULL.
    sql: `ALTER TABLE images ADD COLUMN credit TEXT;`,
  },
];

export function migrate(db: Db) {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL DEFAULT ${NOW}
  )`);
  const applied = new Set(db.all<{ version: number }>("SELECT version FROM schema_migrations").map((r) => r.version));
  for (const m of MIGRATIONS) {
    if (applied.has(m.version)) continue;
    db.tx(() => {
      db.exec(m.sql);
      db.run("INSERT INTO schema_migrations (version, name) VALUES (?, ?)", m.version, m.name);
    });
  }
}

export const LATEST_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;
