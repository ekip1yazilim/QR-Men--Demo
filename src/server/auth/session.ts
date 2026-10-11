/**
 * Sunucu taraflı oturumlar. Çerezde yalnızca rastgele bir belirteç bulunur;
 * veritabanında bu belirtecin SHA-256 özeti saklanır (veritabanı sızsa bile oturum çalınamaz).
 */
import { createHash, randomBytes } from "node:crypto";
import { db, nowIso } from "../db";
import { config } from "../config";
import type { SessionUser } from "../../shared/types";

export const SESSION_COOKIE = "menu_oturum";
const TOUCH_INTERVAL_MS = 10 * 60_000;

export interface Session {
  id: string;
  user: SessionUser;
  csrf: string;
  expiresAt: string;
  remember: boolean;
  /** Oturum süresi uzatıldıysa yeni çerez gönderilmeli */
  renewed: boolean;
  token: string;
}

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");
const token = () => randomBytes(32).toString("base64url");

function lifetimeMs(remember: boolean) {
  return (remember ? config.rememberDays : config.sessionDays) * 86400_000;
}

export function createSession(userId: number, opts: { remember: boolean; ip: string; userAgent: string }) {
  const raw = token();
  const csrf = token();
  const expiresAt = new Date(Date.now() + lifetimeMs(opts.remember)).toISOString();
  db().run(
    "INSERT INTO sessions (id, user_id, csrf, expires_at, remember, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)",
    sha256(raw),
    userId,
    csrf,
    expiresAt,
    opts.remember ? 1 : 0,
    opts.ip.slice(0, 64),
    opts.userAgent.slice(0, 300),
  );
  // Süresi dolmuş oturumları temizle
  db().run("DELETE FROM sessions WHERE expires_at < ?", nowIso());
  return { token: raw, expiresAt, remember: opts.remember };
}

export function getSession(rawToken: string | undefined): Session | null {
  if (!rawToken || rawToken.length > 100) return null;
  const id = sha256(rawToken);
  const row = db().get<{
    id: string;
    csrf: string;
    expires_at: string;
    last_seen_at: string;
    remember: number;
    user_id: number;
    name: string;
    email: string;
    password_changed_at: string;
    created_at: string;
  }>(
    `SELECT s.id, s.csrf, s.expires_at, s.last_seen_at, s.remember, s.created_at, u.id AS user_id, u.name, u.email,
            u.password_changed_at
     FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`,
    id,
  );
  if (!row) return null;
  const now = Date.now();
  if (new Date(row.expires_at).getTime() <= now) {
    db().run("DELETE FROM sessions WHERE id = ?", id);
    return null;
  }
  let expiresAt = row.expires_at;
  let renewed = false;
  // Kayan süre: etkinlik oldukça oturum uzar (en fazla 10 dakikada bir yazılır)
  if (now - new Date(row.last_seen_at).getTime() > TOUCH_INTERVAL_MS) {
    expiresAt = new Date(now + lifetimeMs(row.remember === 1)).toISOString();
    db().run("UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE id = ?", new Date(now).toISOString(), expiresAt, id);
    renewed = true;
  }
  return {
    id,
    user: { id: row.user_id, name: row.name, email: row.email },
    csrf: row.csrf,
    expiresAt,
    remember: row.remember === 1,
    renewed,
    token: rawToken,
  };
}

export function destroySession(rawToken: string | undefined) {
  if (!rawToken) return;
  db().run("DELETE FROM sessions WHERE id = ?", sha256(rawToken));
}

/** Kullanıcının diğer tüm oturumlarını kapatır (şifre değişince / "tüm cihazlardan çık") */
export function destroyOtherSessions(userId: number, keepSessionId: string | null): number {
  if (keepSessionId) return db().run("DELETE FROM sessions WHERE user_id = ? AND id != ?", userId, keepSessionId).changes;
  return db().run("DELETE FROM sessions WHERE user_id = ?", userId).changes;
}

export function countSessions(userId: number): number {
  return db().get<{ n: number }>("SELECT count(*) AS n FROM sessions WHERE user_id = ? AND expires_at > ?", userId, nowIso())!.n;
}
