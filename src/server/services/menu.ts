/** Herkese açık menü verisinin hazırlanması (yalnızca aktif kategori ve ürünler). */
import { db } from "../db";
import { mapProducts, type ProductRow } from "../repo/products";
import { defaultPrivacyNotice } from "../../shared/privacy";
import { getDesign, getGeneral, getRestaurant, MENU_PATH, resolveBaseUrl } from "../repo/settings";
import type { DesignSettings, PublicCategory, PublicMenu, PublicProduct, Product } from "../../shared/types";

function toPublic(p: Product): PublicProduct {
  return {
    id: p.id,
    categoryId: p.categoryId,
    name: p.name,
    slug: p.slug,
    description: p.description,
    priceCents: p.priceCents,
    image: p.image,
    isFeatured: p.isFeatured,
    isSoldOut: p.isSoldOut,
    badges: p.badges,
    allergens: p.allergens,
    calories: p.calories,
  };
}

export function buildPublicMenu(requestOrigin: string, opts: { preview?: boolean; design?: Partial<DesignSettings> } = {}): PublicMenu {
  const general = getGeneral();
  const cats = db().all<{ id: number; name: string; slug: string; description: string; icon: string }>(
    "SELECT id, name, slug, description, icon FROM categories WHERE is_active = 1 ORDER BY sort_order, id",
  );
  const rows = db().all<ProductRow>(
    `SELECT p.* FROM products p JOIN categories c ON c.id = p.category_id
     WHERE p.is_active = 1 AND c.is_active = 1
     ORDER BY p.sort_order, p.id`,
  );
  const products = mapProducts(rows).map(toPublic);
  const byCategory = new Map<number, PublicProduct[]>();
  for (const p of products) {
    const list = byCategory.get(p.categoryId) ?? [];
    list.push(p);
    byCategory.set(p.categoryId, list);
  }
  const categories: PublicCategory[] = cats
    .map((c) => ({ ...c, products: byCategory.get(c.id) ?? [] }))
    .filter((c) => c.products.length > 0);

  // Öne çıkanlar: kategori sırasına göre, tükenenler sona
  const featured = categories
    .flatMap((c) => c.products.filter((p) => p.isFeatured))
    .sort((a, b) => Number(a.isSoldOut) - Number(b.isSoldOut));

  const design = { ...getDesign(), ...(opts.design ?? {}) };
  const { base } = resolveBaseUrl(requestOrigin);

  const restaurant = getRestaurant();
  return {
    restaurant,
    design,
    categories,
    featured,
    timezone: general.timezone,
    menuUrl: base + MENU_PATH,
    generatedAt: new Date().toISOString(),
    preview: !!opts.preview,
    privacyNotice: general.privacyNotice || defaultPrivacyNotice(restaurant),
  };
}
