import { db } from "../db";
import type { ActivityItem } from "../../shared/types";

export type ActivityAction = "create" | "update" | "delete" | "reorder" | "login" | "settings";

/** Yönetim panelindeki "Son değişiklikler" listesi için kayıt tutar. */
export function logActivity(
  userId: number | null,
  action: ActivityAction,
  entity: string,
  entityId: string | number | null,
  summary: string,
) {
  db().run(
    "INSERT INTO activity (user_id, action, entity, entity_id, summary) VALUES (?, ?, ?, ?, ?)",
    userId,
    action,
    entity,
    entityId === null ? null : String(entityId),
    summary.slice(0, 240),
  );
  // Tablo sınırsız büyümesin: son 2000 kayıt tutulur
  db().run("DELETE FROM activity WHERE id <= (SELECT id FROM activity ORDER BY id DESC LIMIT 1 OFFSET 2000)");
}

export function recentActivity(limit = 8): ActivityItem[] {
  return db()
    .all<{
      id: number;
      action: string;
      entity: string;
      entity_id: string | null;
      summary: string;
      user_name: string | null;
      created_at: string;
    }>(
      `SELECT a.id, a.action, a.entity, a.entity_id, a.summary, u.name AS user_name, a.created_at
       FROM activity a LEFT JOIN users u ON u.id = a.user_id
       WHERE a.action != 'login'
       ORDER BY a.id DESC LIMIT ?`,
      limit,
    )
    .map((r) => ({
      id: r.id,
      action: r.action,
      entity: r.entity,
      entityId: r.entity_id,
      summary: r.summary,
      userName: r.user_name,
      createdAt: r.created_at,
    }));
}
