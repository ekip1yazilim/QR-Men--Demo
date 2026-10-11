import { bool, db, nowIso } from "../db";
import { slugify } from "../../shared/format";
import type { CategoryInput } from "../../shared/schemas";
import type { Category } from "../../shared/types";

interface CategoryRow {
  id: number;
  name: string;
  slug: string;
  description: string;
  icon: string;
  sort_order: number;
  is_active: number;
  product_count: number;
  active_product_count: number;
}

function map(r: CategoryRow): Category {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description,
    icon: r.icon,
    sortOrder: r.sort_order,
    isActive: bool(r.is_active),
    productCount: r.product_count ?? 0,
    activeProductCount: r.active_product_count ?? 0,
  };
}

const SELECT = `
  SELECT c.*,
    (SELECT count(*) FROM products p WHERE p.category_id = c.id) AS product_count,
    (SELECT count(*) FROM products p WHERE p.category_id = c.id AND p.is_active = 1) AS active_product_count
  FROM categories c`;

export function listCategories(): Category[] {
  return db().all<CategoryRow>(`${SELECT} ORDER BY c.sort_order, c.id`).map(map);
}

export function getCategory(id: number): Category | null {
  const row = db().get<CategoryRow>(`${SELECT} WHERE c.id = ?`, id);
  return row ? map(row) : null;
}

export function uniqueCategorySlug(name: string, exceptId?: number): string {
  const base = slugify(name);
  let slug = base;
  for (let i = 2; ; i++) {
    const hit = db().get<{ id: number }>("SELECT id FROM categories WHERE slug = ?", slug);
    if (!hit || hit.id === exceptId) return slug;
    slug = `${base}-${i}`;
  }
}

export function createCategory(input: CategoryInput): Category {
  const next = db().get<{ n: number }>("SELECT coalesce(max(sort_order), -1) + 1 AS n FROM categories")!.n;
  const { lastInsertRowid } = db().run(
    "INSERT INTO categories (name, slug, description, icon, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?)",
    input.name,
    uniqueCategorySlug(input.name),
    input.description,
    input.icon,
    next,
    input.isActive ? 1 : 0,
  );
  return getCategory(lastInsertRowid)!;
}

export function updateCategory(id: number, input: CategoryInput): Category | null {
  const existing = getCategory(id);
  if (!existing) return null;
  const slug = existing.name === input.name ? existing.slug : uniqueCategorySlug(input.name, id);
  db().run(
    "UPDATE categories SET name = ?, slug = ?, description = ?, icon = ?, is_active = ?, updated_at = ? WHERE id = ?",
    input.name,
    slug,
    input.description,
    input.icon,
    input.isActive ? 1 : 0,
    nowIso(),
    id,
  );
  return getCategory(id);
}

export function setCategoryActive(id: number, isActive: boolean) {
  db().run("UPDATE categories SET is_active = ?, updated_at = ? WHERE id = ?", isActive ? 1 : 0, nowIso(), id);
}

export class CategoryDeleteError extends Error {}

/**
 * Kategoriyi siler. İçinde ürün varsa ya hedef kategoriye taşınır ya da ürünlerle birlikte silinir.
 */
export function deleteCategory(
  id: number,
  opts: { strategy: "move" | "delete"; targetCategoryId: number | null },
): { movedProducts: number; deletedProducts: number } {
  return db().tx(() => {
    const cat = getCategory(id);
    if (!cat) throw new CategoryDeleteError("Kategori bulunamadı.");
    let movedProducts = 0;
    let deletedProducts = 0;
    if (cat.productCount > 0) {
      if (opts.strategy === "move") {
        if (!opts.targetCategoryId || opts.targetCategoryId === id || !getCategory(opts.targetCategoryId)) {
          throw new CategoryDeleteError("Ürünlerin taşınacağı kategoriyi seçin.");
        }
        const start = db().get<{ n: number }>(
          "SELECT coalesce(max(sort_order), -1) + 1 AS n FROM products WHERE category_id = ?",
          opts.targetCategoryId,
        )!.n;
        const ids = db().all<{ id: number }>("SELECT id FROM products WHERE category_id = ? ORDER BY sort_order, id", id);
        ids.forEach((p, i) => {
          db().run(
            "UPDATE products SET category_id = ?, sort_order = ?, updated_at = ? WHERE id = ?",
            opts.targetCategoryId,
            start + i,
            nowIso(),
            p.id,
          );
        });
        movedProducts = ids.length;
      } else {
        deletedProducts = db().run("DELETE FROM products WHERE category_id = ?", id).changes;
      }
    }
    db().run("DELETE FROM categories WHERE id = ?", id);
    return { movedProducts, deletedProducts };
  });
}

/** Sıralama: verilen kimlik sırasını kaydeder. Listede olmayan kategoriler sona eklenir. */
export function reorderCategories(ids: number[]) {
  db().tx(() => {
    const all = db().all<{ id: number }>("SELECT id FROM categories ORDER BY sort_order, id").map((r) => r.id);
    const known = ids.filter((id) => all.includes(id));
    const rest = all.filter((id) => !known.includes(id));
    [...known, ...rest].forEach((id, index) => db().run("UPDATE categories SET sort_order = ? WHERE id = ?", index, id));
  });
}
