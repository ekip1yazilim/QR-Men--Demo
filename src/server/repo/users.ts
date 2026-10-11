import { db, nowIso } from "../db";
import type { SessionUser } from "../../shared/types";

export interface UserRow {
  id: number;
  email: string;
  name: string;
  password_hash: string;
  password_changed_at: string;
  last_login_at: string | null;
}

export function countUsers(): number {
  return db().get<{ n: number }>("SELECT count(*) AS n FROM users")!.n;
}

export function findUserByEmail(email: string): UserRow | undefined {
  return db().get<UserRow>("SELECT * FROM users WHERE email = ? COLLATE NOCASE", email.trim().toLowerCase());
}

export function findUserById(id: number): UserRow | undefined {
  return db().get<UserRow>("SELECT * FROM users WHERE id = ?", id);
}

export function listUsers(): SessionUser[] {
  return db().all<SessionUser>("SELECT id, name, email FROM users ORDER BY id");
}

export function createUser(email: string, name: string, passwordHash: string): number {
  return db().run(
    "INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)",
    email.trim().toLowerCase(),
    name.trim(),
    passwordHash,
  ).lastInsertRowid;
}

export function updateUserProfile(id: number, name: string, email: string) {
  db().run("UPDATE users SET name = ?, email = ?, updated_at = ? WHERE id = ?", name, email.toLowerCase(), nowIso(), id);
}

export function updateUserPassword(id: number, passwordHash: string) {
  const now = nowIso();
  db().run("UPDATE users SET password_hash = ?, password_changed_at = ?, updated_at = ? WHERE id = ?", passwordHash, now, now, id);
}

export function touchLogin(id: number) {
  db().run("UPDATE users SET last_login_at = ? WHERE id = ?", nowIso(), id);
}
