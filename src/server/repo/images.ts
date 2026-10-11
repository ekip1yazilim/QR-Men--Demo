/**
 * Görseller veritabanında WebP varyantları olarak saklanır (ayrı dosya sunucusu gerekmez,
 * yedekleme tek dosyadan ibarettir). Her görsel benzersiz bir kimlik alır ve asla
 * yerinde değiştirilmez; bu sayede tarayıcı önbelleği güvenle "immutable" kullanılabilir.
 */
import { db } from "../db";
import type { ImageCredit, ImageKind, ImageRef } from "../../shared/types";

interface ImageRow {
  id: string;
  width: number;
  height: number;
  placeholder: string | null;
  credit: string | null;
}

export interface NewImage {
  id: string;
  kind: ImageKind;
  width: number;
  height: number;
  placeholder: string | null;
  originalName: string;
  variants: { width: number; height: number; data: Buffer }[];
  credit?: ImageCredit | null;
}

function parseCredit(raw: string | null): ImageCredit | null {
  if (!raw) return null;
  try {
    const c = JSON.parse(raw) as Partial<ImageCredit>;
    if (typeof c.author !== "string" || typeof c.license !== "string") return null;
    return { author: c.author, license: c.license, licenseUrl: c.licenseUrl ?? "", sourceUrl: c.sourceUrl ?? "" };
  } catch {
    return null;
  }
}

export function insertImage(img: NewImage) {
  const total = img.variants.reduce((s, v) => s + v.data.length, 0);
  db().tx(() => {
    db().run(
      "INSERT INTO images (id, kind, width, height, placeholder, original_name, bytes_total, credit) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      img.id,
      img.kind,
      img.width,
      img.height,
      img.placeholder,
      img.originalName.slice(0, 200),
      total,
      img.credit ? JSON.stringify(img.credit) : null,
    );
    for (const v of img.variants) {
      db().run("INSERT INTO image_variants (image_id, width, height, data) VALUES (?, ?, ?, ?)", img.id, v.width, v.height, v.data);
    }
  });
}

export function getImageRef(id: string): ImageRef | null {
  const row = db().get<ImageRow>("SELECT id, width, height, placeholder, credit FROM images WHERE id = ?", id);
  if (!row) return null;
  const widths = db()
    .all<{ width: number }>("SELECT width FROM image_variants WHERE image_id = ? ORDER BY width", id)
    .map((r) => r.width);
  return { id: row.id, width: row.width, height: row.height, placeholder: row.placeholder, widths, credit: parseCredit(row.credit) };
}

/** Birden çok görseli tek sorguda çözer (menü sayfası için) */
export function getImageRefs(ids: string[]): Map<string, ImageRef> {
  const map = new Map<string, ImageRef>();
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return map;
  const placeholders = unique.map(() => "?").join(",");
  const rows = db().all<ImageRow>(`SELECT id, width, height, placeholder, credit FROM images WHERE id IN (${placeholders})`, ...unique);
  const variants = db().all<{ image_id: string; width: number }>(
    `SELECT image_id, width FROM image_variants WHERE image_id IN (${placeholders}) ORDER BY width`,
    ...unique,
  );
  for (const r of rows)
    map.set(r.id, { id: r.id, width: r.width, height: r.height, placeholder: r.placeholder, widths: [], credit: parseCredit(r.credit) });
  for (const v of variants) map.get(v.image_id)?.widths.push(v.width);
  return map;
}

export function imageExists(id: string, kind?: ImageKind): boolean {
  const row = db().get<{ kind: string }>("SELECT kind FROM images WHERE id = ?", id);
  return !!row && (!kind || row.kind === kind);
}

/** İstenen genişliğe en uygun varyant (eşit veya büyük olan en küçük; yoksa en büyük) */
export function getVariant(id: string, width: number): { data: Uint8Array; width: number } | undefined {
  return (
    db().get<{ data: Uint8Array; width: number }>(
      "SELECT data, width FROM image_variants WHERE image_id = ? AND width >= ? ORDER BY width ASC LIMIT 1",
      id,
      width,
    ) ??
    db().get<{ data: Uint8Array; width: number }>(
      "SELECT data, width FROM image_variants WHERE image_id = ? ORDER BY width DESC LIMIT 1",
      id,
    )
  );
}

/**
 * Hiçbir ürüne, logoya veya kapağa bağlı olmayan ve belirtilen süreden eski görselleri siler.
 * (Yüklenip kaydedilmeyen ya da değiştirilen görseller birikmesin.)
 */
export function deleteOrphanImages(referencedIds: string[], olderThanHours = 24): number {
  const cutoff = new Date(Date.now() - olderThanHours * 3600_000).toISOString();
  const keep = [...new Set(referencedIds.filter(Boolean))];
  const notIn = keep.length ? `AND id NOT IN (${keep.map(() => "?").join(",")})` : "";
  const r = db().run(
    `DELETE FROM images
     WHERE created_at < ?
       AND id NOT IN (SELECT image_id FROM products WHERE image_id IS NOT NULL)
       ${notIn}`,
    cutoff,
    ...keep,
  );
  return r.changes;
}
