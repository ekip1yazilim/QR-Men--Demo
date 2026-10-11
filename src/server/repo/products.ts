import { bool, db, nowIso, type Param } from "../db";
import { searchKey, slugify } from "../../shared/format";
import { BADGE_KEYS } from "../../shared/catalog";
import type { ProductInput } from "../../shared/schemas";
import type { BadgeKey, Product } from "../../shared/types";
import { getImageRefs } from "./images";

export interface ProductRow {
  id: number;
  category_id: number;
  name: string;
  slug: string;
  description: string;
  price_cents: number;
  image_id: string | null;
  is_active: number;
  is_featured: number;
  is_sold_out: number;
  badges: string;
  allergens: string;
  calories: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

function parseBadges(raw: string): BadgeKey[] {
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr.filter((b) => (BADGE_KEYS as string[]).includes(b)) as BadgeKey[]) : [];
  } catch {
    return [];
  }
}

export function mapProducts(rows: ProductRow[]): Product[] {
  const images = getImageRefs(rows.map((r) => r.image_id ?? ""));
  return rows.map((r) => ({
    id: r.id,
    categoryId: r.category_id,
    name: r.name,
    slug: r.slug,
    description: r.description,
    priceCents: r.price_cents,
    image: r.image_id ? (images.get(r.image_id) ?? null) : null,
    isActive: bool(r.is_active),
    isFeatured: bool(r.is_featured),
    isSoldOut: bool(r.is_sold_out),
    badges: parseBadges(r.badges),
    allergens: r.allergens,
    calories: r.calories,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export interface ProductFilter {
  q?: string;
  categoryId?: number;
  status?: "active" | "inactive" | "featured" | "soldout" | "noimage";
}

export function listProducts(filter: ProductFilter = {}): Product[] {
  const where: string[] = [];
  const params: Param[] = [];
  if (filter.categoryId) {
    where.push("p.category_id = ?");
    params.push(filter.categoryId);
  }
  switch (filter.status) {
    case "active":
      where.push("p.is_active = 1");
      break;
    case "inactive":
      where.push("p.is_active = 0");
      break;
    case "featured":
      where.push("p.is_featured = 1");
      break;
    case "soldout":
      where.push("p.is_sold_out = 1");
      break;
    case "noimage":
      where.push("p.image_id IS NULL");
      break;
  }
  const rows = db().all<ProductRow>(
    `SELECT p.* FROM products p JOIN categories c ON c.id = p.category_id
     ${where.length ? "WHERE " + where.join(" AND ") : ""}
     ORDER BY c.sort_order, c.id, p.sort_order, p.id`,
    ...params,
  );
  let products = mapProducts(rows);
  if (filter.q) {
    const needle = searchKey(filter.q);
    products = products.filter((p) => searchKey(p.name, p.description).includes(needle));
  }
  return products;
}

export function getProduct(id: number): Product | null {
  const row = db().get<ProductRow>("SELECT * FROM products WHERE id = ?", id);
  return row ? mapProducts([row])[0] : null;
}

export function uniqueProductSlug(name: string, exceptId?: number): string {
  const base = slugify(name);
  let slug = base;
  for (let i = 2; ; i++) {
    const hit = db().get<{ id: number }>("SELECT id FROM products WHERE slug = ?", slug);
    if (!hit || hit.id === exceptId) return slug;
    slug = `${base}-${i}`;
  }
}

export function createProduct(input: ProductInput): Product {
  const next = db().get<{ n: number }>(
    "SELECT coalesce(max(sort_order), -1) + 1 AS n FROM products WHERE category_id = ?",
    input.categoryId,
  )!.n;
  const { lastInsertRowid } = db().run(
    `INSERT INTO products (category_id, name, slug, description, price_cents, image_id, is_active, is_featured,
       is_sold_out, badges, allergens, calories, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    input.categoryId,
    input.name,
    uniqueProductSlug(input.name),
    input.description,
    input.priceCents,
    input.imageId,
    input.isActive ? 1 : 0,
    input.isFeatured ? 1 : 0,
    input.isSoldOut ? 1 : 0,
    JSON.stringify([...new Set(input.badges)]),
    input.allergens,
    input.calories,
    next,
  );
  return getProduct(lastInsertRowid)!;
}

export function updateProduct(id: number, input: ProductInput): Product | null {
  const existing = getProduct(id);
  if (!existing) return null;
  const slug = existing.name === input.name ? existing.slug : uniqueProductSlug(input.name, id);
  let sortOrder = existing.sortOrder;
  if (existing.categoryId !== input.categoryId) {
    sortOrder = db().get<{ n: number }>(
      "SELECT coalesce(max(sort_order), -1) + 1 AS n FROM products WHERE category_id = ?",
      input.categoryId,
    )!.n;
  }
  db().run(
    `UPDATE products SET category_id = ?, name = ?, slug = ?, description = ?, price_cents = ?, image_id = ?,
       is_active = ?, is_featured = ?, is_sold_out = ?, badges = ?, allergens = ?, calories = ?, sort_order = ?,
       updated_at = ?
     WHERE id = ?`,
    input.categoryId,
    input.name,
    slug,
    input.description,
    input.priceCents,
    input.imageId,
    input.isActive ? 1 : 0,
    input.isFeatured ? 1 : 0,
    input.isSoldOut ? 1 : 0,
    JSON.stringify([...new Set(input.badges)]),
    input.allergens,
    input.calories,
    sortOrder,
    nowIso(),
    id,
  );
  return getProduct(id);
}

export function patchProduct(
  id: number,
  patch: Partial<{ isActive: boolean; isFeatured: boolean; isSoldOut: boolean; priceCents: number }>,
): Product | null {
  const sets: string[] = [];
  const params: Param[] = [];
  if (patch.isActive !== undefined) (sets.push("is_active = ?"), params.push(patch.isActive ? 1 : 0));
  if (patch.isFeatured !== undefined) (sets.push("is_featured = ?"), params.push(patch.isFeatured ? 1 : 0));
  if (patch.isSoldOut !== undefined) (sets.push("is_sold_out = ?"), params.push(patch.isSoldOut ? 1 : 0));
  if (patch.priceCents !== undefined) (sets.push("price_cents = ?"), params.push(patch.priceCents));
  if (!sets.length) return getProduct(id);
  const r = db().run(`UPDATE products SET ${sets.join(", ")}, updated_at = ? WHERE id = ?`, ...params, nowIso(), id);
  return r.changes ? getProduct(id) : null;
}

export function deleteProduct(id: number): boolean {
  return db().run("DELETE FROM products WHERE id = ?", id).changes > 0;
}

/** Bir kategorideki ürünlerin sırasını kaydeder */
export function reorderProducts(categoryId: number, ids: number[]) {
  db().tx(() => {
    const all = db()
      .all<{ id: number }>("SELECT id FROM products WHERE category_id = ? ORDER BY sort_order, id", categoryId)
      .map((r) => r.id);
    const known = ids.filter((id) => all.includes(id));
    const rest = all.filter((id) => !known.includes(id));
    [...known, ...rest].forEach((id, index) => db().run("UPDATE products SET sort_order = ? WHERE id = ?", index, id));
  });
}
