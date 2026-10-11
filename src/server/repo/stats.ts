/**
 * Anonim görüntülenme sayaçları: yalnızca gün bazında toplam sayılar tutulur;
 * kişisel veri, IP veya çerez saklanmaz.
 */
import { db } from "../db";

/** Saat dilimine göre gün anahtarı: "2026-10-11" */
export function dayKey(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  return parts; // en-CA → YYYY-MM-DD
}

export function recordMenuView(timeZone: string, date = new Date()) {
  db().run(
    "INSERT INTO menu_views (day, views) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET views = views + 1",
    dayKey(date, timeZone),
  );
}

export function recordProductView(productId: number, timeZone: string, date = new Date()): boolean {
  const exists = db().get("SELECT 1 FROM products WHERE id = ? AND is_active = 1", productId);
  if (!exists) return false;
  db().run(
    `INSERT INTO product_views (day, product_id, views) VALUES (?, ?, 1)
     ON CONFLICT(day, product_id) DO UPDATE SET views = views + 1`,
    dayKey(date, timeZone),
    productId,
  );
  return true;
}

/** Son `days` günün görüntülenmeleri (bugün dahil, eksik günler 0) */
export function menuViewsSeries(days: number, timeZone: string, now = new Date()): { day: string; views: number }[] {
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i--) keys.push(dayKey(new Date(now.getTime() - i * 86400_000), timeZone));
  const rows = db().all<{ day: string; views: number }>(
    `SELECT day, views FROM menu_views WHERE day >= ? AND day <= ?`,
    keys[0],
    keys[keys.length - 1],
  );
  const map = new Map(rows.map((r) => [r.day, r.views]));
  return keys.map((day) => ({ day, views: map.get(day) ?? 0 }));
}

export function topProducts(days: number, timeZone: string, limit = 5, now = new Date()) {
  const since = dayKey(new Date(now.getTime() - (days - 1) * 86400_000), timeZone);
  return db().all<{ id: number; name: string; views: number }>(
    `SELECT p.id, p.name, sum(v.views) AS views
     FROM product_views v JOIN products p ON p.id = v.product_id
     WHERE v.day >= ?
     GROUP BY p.id ORDER BY views DESC, p.name LIMIT ?`,
    since,
    limit,
  );
}
