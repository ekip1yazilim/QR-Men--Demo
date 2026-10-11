/**
 * Giriş denemesi sınırlaması (kalıcı, sunucu yeniden başlasa da korunur).
 * Aynı IP veya aynı e-posta için 15 dakikada 5 hatalı deneme → 15 dakika kilit.
 */
import { db } from "../db";

export const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60_000;
const LOCK_MS = 15 * 60_000;

interface AttemptRow {
  key: string;
  failures: number;
  first_failure_at: number;
  locked_until: number | null;
}

function row(key: string): AttemptRow | undefined {
  return db().get<AttemptRow>("SELECT * FROM login_attempts WHERE key = ?", key);
}

/** Kilitliyse kalan süreyi (ms) döner, değilse 0 */
export function lockRemaining(keys: string[], now = Date.now()): number {
  let remaining = 0;
  for (const key of keys) {
    const r = row(key);
    if (r?.locked_until && r.locked_until > now) remaining = Math.max(remaining, r.locked_until - now);
  }
  return remaining;
}

export function registerFailure(keys: string[], now = Date.now()) {
  for (const key of keys) {
    const r = row(key);
    if (!r || now - r.first_failure_at > WINDOW_MS) {
      db().run(
        `INSERT INTO login_attempts (key, failures, first_failure_at, locked_until) VALUES (?, 1, ?, NULL)
         ON CONFLICT(key) DO UPDATE SET failures = 1, first_failure_at = excluded.first_failure_at, locked_until = NULL`,
        key,
        now,
      );
      continue;
    }
    const failures = r.failures + 1;
    db().run(
      "UPDATE login_attempts SET failures = ?, locked_until = ? WHERE key = ?",
      failures,
      failures >= MAX_FAILURES ? now + LOCK_MS : null,
      key,
    );
  }
  // Eski kayıtları temizle
  db().run("DELETE FROM login_attempts WHERE first_failure_at < ? AND (locked_until IS NULL OR locked_until < ?)", now - WINDOW_MS * 4, now);
}

export function clearFailures(keys: string[]) {
  for (const key of keys) db().run("DELETE FROM login_attempts WHERE key = ?", key);
}

/** Basit bellek içi sınırlayıcı (ör. herkese açık görüntülenme sayacı için) */
export class MemoryRateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();
  constructor(
    private limit: number,
    private windowMs: number,
  ) {}

  allow(key: string, now = Date.now()): boolean {
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      if (this.hits.size > 10_000) this.sweep(now);
      return true;
    }
    entry.count++;
    return entry.count <= this.limit;
  }

  private sweep(now: number) {
    for (const [k, v] of this.hits) if (v.resetAt <= now) this.hits.delete(k);
  }
}
