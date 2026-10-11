/** Yönetim paneli API'si — tüm uç noktalar oturum + CSRF korumalıdır (bkz. app.ts) */
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import type { ZodType, ZodTypeDef } from "zod";
import { config } from "../config";
import { defaultPrivacyNotice } from "../../shared/privacy";
import { buildPublicMenu } from "../services/menu";
import { db } from "../db";
import { LATEST_SCHEMA_VERSION } from "../db/migrations";
import { apiError, bytes, HttpError, intParam, json, readJson, type Ctx } from "../http/core";
import { hashPassword, verifyPassword } from "../auth/password";
import { countSessions, destroyOtherSessions } from "../auth/session";
import { logActivity, recentActivity } from "../repo/activity";
import {
  CategoryDeleteError,
  createCategory,
  deleteCategory,
  getCategory,
  listCategories,
  reorderCategories,
  setCategoryActive,
  updateCategory,
} from "../repo/categories";
import { deleteOrphanImages, getImageRef, imageExists, insertImage } from "../repo/images";
import {
  createProduct,
  deleteProduct,
  getProduct,
  listProducts,
  patchProduct,
  reorderProducts,
  updateProduct,
  type ProductFilter,
} from "../repo/products";
import {
  getDesign,
  getGeneral,
  getRestaurant,
  getStoredRestaurant,
  MENU_PATH,
  resolveBaseUrl,
  saveDesign,
  saveGeneral,
  saveRestaurant,
} from "../repo/settings";
import { menuViewsSeries, topProducts } from "../repo/stats";
import { findUserByEmail, findUserById, updateUserPassword, updateUserProfile } from "../repo/users";
import { ImageError, processImage } from "../services/images";
import { qrPng, qrSvg } from "../services/qr";
import { formatPrice } from "../../shared/format";
import {
  accountInputSchema,
  categoryDeleteSchema,
  categoryInputSchema,
  designInputSchema,
  fieldErrors,
  generalInputSchema,
  passwordChangeSchema,
  productInputSchema,
  productPatchSchema,
  productReorderSchema,
  reorderSchema,
  restaurantInputSchema,
} from "../../shared/schemas";
import type { DashboardSummary, ImageKind } from "../../shared/types";

function validate<O, I = O>(schema: ZodType<O, ZodTypeDef, I>, body: unknown): O {
  const r = schema.safeParse(body);
  if (!r.success) throw new HttpError(422, "Lütfen işaretli alanları kontrol edin.", fieldErrors(r.error));
  return r.data;
}

const uid = (ctx: Ctx) => ctx.session!.user.id;

function idParam(ctx: Ctx): number {
  const id = intParam(ctx.params.id);
  if (!id) throw new HttpError(404, "Kayıt bulunamadı.");
  return id;
}

export function menuUrlFor(ctx: Ctx) {
  const { base, configured } = resolveBaseUrl(ctx.origin);
  return { menuUrl: base + MENU_PATH, configured };
}

// ---------------------------------------------------------------------------
// Genel bakış
// ---------------------------------------------------------------------------
export function summary(ctx: Ctx): Response {
  const t = db().get<Record<string, number>>(`
    SELECT
      (SELECT count(*) FROM products) AS products,
      (SELECT count(*) FROM products WHERE is_active = 1) AS activeProducts,
      (SELECT count(*) FROM products WHERE is_active = 0) AS inactiveProducts,
      (SELECT count(*) FROM products WHERE is_sold_out = 1 AND is_active = 1) AS soldOutProducts,
      (SELECT count(*) FROM products WHERE is_featured = 1 AND is_active = 1) AS featuredProducts,
      (SELECT count(*) FROM products WHERE image_id IS NULL) AS productsWithoutImage,
      (SELECT count(*) FROM categories) AS categories,
      (SELECT count(*) FROM categories WHERE is_active = 1) AS activeCategories
  `)!;
  const tz = getGeneral().timezone;
  const views = menuViewsSeries(14, tz);
  const { menuUrl, configured } = menuUrlFor(ctx);
  const body: DashboardSummary = {
    totals: {
      products: t.products,
      activeProducts: t.activeProducts,
      inactiveProducts: t.inactiveProducts,
      soldOutProducts: t.soldOutProducts,
      featuredProducts: t.featuredProducts,
      categories: t.categories,
      activeCategories: t.activeCategories,
      productsWithoutImage: t.productsWithoutImage,
    },
    views,
    viewsTotal: views.reduce((s, v) => s + v.views, 0),
    topProducts: topProducts(30, tz, 5),
    activity: recentActivity(8),
    menuUrl,
    menuPublished: getGeneral().menuPublished,
    siteUrlConfigured: configured,
  };
  return json(body);
}

// ---------------------------------------------------------------------------
// Kategoriler
// ---------------------------------------------------------------------------
export function categoriesList(): Response {
  return json({ categories: listCategories() });
}

export async function categoryCreate(ctx: Ctx): Promise<Response> {
  const input = validate(categoryInputSchema, await readJson(ctx.req));
  const category = createCategory(input);
  logActivity(uid(ctx), "create", "kategori", category.id, `“${category.name}” kategorisi oluşturuldu`);
  return json({ category }, 201);
}

export async function categoryUpdate(ctx: Ctx): Promise<Response> {
  const id = idParam(ctx);
  const input = validate(categoryInputSchema, await readJson(ctx.req));
  const before = getCategory(id);
  const category = updateCategory(id, input);
  if (!category || !before) return apiError(404, "Kategori bulunamadı.");
  const summary = before.name !== category.name ? `“${before.name}” kategorisinin adı “${category.name}” olarak değiştirildi` : `“${category.name}” kategorisi güncellendi`;
  logActivity(uid(ctx), "update", "kategori", id, summary);
  return json({ category });
}

export async function categoryPatch(ctx: Ctx): Promise<Response> {
  const id = idParam(ctx);
  const body = await readJson<{ isActive?: unknown }>(ctx.req);
  if (typeof body.isActive !== "boolean") return apiError(422, "Geçersiz istek.");
  const cat = getCategory(id);
  if (!cat) return apiError(404, "Kategori bulunamadı.");
  setCategoryActive(id, body.isActive);
  logActivity(uid(ctx), "update", "kategori", id, `“${cat.name}” kategorisi ${body.isActive ? "menüde gösteriliyor" : "menüden gizlendi"}`);
  return json({ category: getCategory(id) });
}

export async function categoryDelete(ctx: Ctx): Promise<Response> {
  const id = idParam(ctx);
  const opts = validate(categoryDeleteSchema, ctx.req.headers.get("content-type")?.includes("json") ? await readJson(ctx.req) : {});
  const cat = getCategory(id);
  if (!cat) return apiError(404, "Kategori bulunamadı.");
  try {
    const result = deleteCategory(id, opts);
    let summary = `“${cat.name}” kategorisi silindi`;
    if (result.movedProducts) summary += `, ${result.movedProducts} ürün “${getCategory(opts.targetCategoryId!)?.name}” kategorisine taşındı`;
    if (result.deletedProducts) summary += `, ${result.deletedProducts} ürün silindi`;
    logActivity(uid(ctx), "delete", "kategori", id, summary);
    return json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof CategoryDeleteError) return apiError(422, err.message);
    throw err;
  }
}

export async function categoriesReorder(ctx: Ctx): Promise<Response> {
  const { ids } = validate(reorderSchema, await readJson(ctx.req));
  reorderCategories(ids);
  logActivity(uid(ctx), "reorder", "kategori", null, "Kategori sıralaması güncellendi");
  return json({ categories: listCategories() });
}

// ---------------------------------------------------------------------------
// Ürünler
// ---------------------------------------------------------------------------
function assertProductRefs(categoryId: number, imageId: string | null) {
  if (!getCategory(categoryId)) throw new HttpError(422, "Lütfen işaretli alanları kontrol edin.", { categoryId: "Seçilen kategori bulunamadı." });
  if (imageId && !imageExists(imageId, "product")) {
    throw new HttpError(422, "Lütfen işaretli alanları kontrol edin.", { imageId: "Görsel bulunamadı. Lütfen yeniden yükleyin." });
  }
}

export function productsList(ctx: Ctx): Response {
  const q = ctx.url.searchParams;
  const status = q.get("durum");
  const filter: ProductFilter = {
    q: q.get("q")?.slice(0, 80) || undefined,
    categoryId: intParam(q.get("kategori") ?? undefined) ?? undefined,
    status: (["active", "inactive", "featured", "soldout", "noimage"] as const).find((s) => s === status),
  };
  return json({ products: listProducts(filter) });
}

export function productGet(ctx: Ctx): Response {
  const product = getProduct(idParam(ctx));
  return product ? json({ product }) : apiError(404, "Ürün bulunamadı.");
}

export async function productCreate(ctx: Ctx): Promise<Response> {
  const input = validate(productInputSchema, await readJson(ctx.req));
  assertProductRefs(input.categoryId, input.imageId);
  const product = createProduct(input);
  logActivity(uid(ctx), "create", "urun", product.id, `“${product.name}” ürünü eklendi (${formatPrice(product.priceCents)})`);
  return json({ product }, 201);
}

export async function productUpdate(ctx: Ctx): Promise<Response> {
  const id = idParam(ctx);
  const input = validate(productInputSchema, await readJson(ctx.req));
  const before = getProduct(id);
  if (!before) return apiError(404, "Ürün bulunamadı.");
  assertProductRefs(input.categoryId, input.imageId);
  const product = updateProduct(id, input)!;
  const changes: string[] = [];
  if (before.priceCents !== product.priceCents) changes.push(`fiyat ${formatPrice(before.priceCents)} → ${formatPrice(product.priceCents)}`);
  if (before.name !== product.name) changes.push(`ad “${before.name}” → “${product.name}”`);
  if (before.isActive !== product.isActive) changes.push(product.isActive ? "menüde gösteriliyor" : "menüden gizlendi");
  logActivity(uid(ctx), "update", "urun", id, `“${product.name}” güncellendi${changes.length ? ": " + changes.join(", ") : ""}`);
  return json({ product });
}

export async function productPatch(ctx: Ctx): Promise<Response> {
  const id = idParam(ctx);
  const patch = validate(productPatchSchema, await readJson(ctx.req));
  const before = getProduct(id);
  if (!before) return apiError(404, "Ürün bulunamadı.");
  const product = patchProduct(id, patch)!;
  const parts: string[] = [];
  if (patch.priceCents !== undefined && patch.priceCents !== before.priceCents)
    parts.push(`fiyatı ${formatPrice(before.priceCents)} → ${formatPrice(product.priceCents)}`);
  if (patch.isActive !== undefined && patch.isActive !== before.isActive) parts.push(patch.isActive ? "menüde gösteriliyor" : "menüden gizlendi");
  if (patch.isFeatured !== undefined && patch.isFeatured !== before.isFeatured) parts.push(patch.isFeatured ? "öne çıkarıldı" : "öne çıkanlardan kaldırıldı");
  if (patch.isSoldOut !== undefined && patch.isSoldOut !== before.isSoldOut) parts.push(patch.isSoldOut ? "tükendi olarak işaretlendi" : "yeniden satışta");
  if (parts.length) logActivity(uid(ctx), "update", "urun", id, `“${product.name}” ${parts.join(", ")}`);
  return json({ product });
}

export function productDelete(ctx: Ctx): Response {
  const id = idParam(ctx);
  const product = getProduct(id);
  if (!product || !deleteProduct(id)) return apiError(404, "Ürün bulunamadı.");
  logActivity(uid(ctx), "delete", "urun", id, `“${product.name}” ürünü silindi`);
  return json({ ok: true });
}

export async function productsReorder(ctx: Ctx): Promise<Response> {
  const { categoryId, ids } = validate(productReorderSchema, await readJson(ctx.req));
  const cat = getCategory(categoryId);
  if (!cat) return apiError(404, "Kategori bulunamadı.");
  reorderProducts(categoryId, ids);
  logActivity(uid(ctx), "reorder", "urun", categoryId, `“${cat.name}” kategorisindeki ürün sıralaması güncellendi`);
  return json({ products: listProducts({ categoryId }) });
}

// ---------------------------------------------------------------------------
// Görsel yükleme
// ---------------------------------------------------------------------------
export async function imageUpload(ctx: Ctx): Promise<Response> {
  const kind = ctx.url.searchParams.get("tur") as ImageKind | null;
  if (kind !== "product" && kind !== "cover" && kind !== "logo") return apiError(400, "Görsel türü geçersiz.");
  const length = Number(ctx.req.headers.get("content-length") ?? NaN);
  if (!Number.isFinite(length)) return apiError(411, "Dosya boyutu belirlenemedi.");
  const limitMb = Math.round(config.maxUploadBytes / 1024 / 1024);
  if (length > config.maxUploadBytes + 64 * 1024) return apiError(413, `Dosya en fazla ${limitMb} MB olabilir.`);
  if (!(ctx.req.headers.get("content-type") ?? "").includes("multipart/form-data")) return apiError(415, "Dosya yükleme biçimi geçersiz.");

  let file: FormDataEntryValue | null;
  try {
    file = (await ctx.req.formData()).get("dosya");
  } catch {
    return apiError(400, "Dosya okunamadı. Tekrar deneyin.");
  }
  if (!file || typeof file === "string") return apiError(400, "Yüklenecek bir görsel seçin.");
  if (file.size > config.maxUploadBytes) return apiError(413, `Dosya en fazla ${limitMb} MB olabilir.`);

  try {
    const processed = await processImage(Buffer.from(await file.arrayBuffer()), kind, file.name);
    insertImage(processed);
    return json({ image: getImageRef(processed.id) }, 201);
  } catch (err) {
    if (err instanceof ImageError) return apiError(422, err.message);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Restoran bilgileri, tasarım, genel ayarlar
// ---------------------------------------------------------------------------
export function restaurantGet(): Response {
  const stored = getStoredRestaurant();
  const r = getRestaurant();
  return json({ restaurant: { ...stored, logo: r.logo, cover: r.cover } });
}

export async function restaurantSave(ctx: Ctx): Promise<Response> {
  const input = validate(restaurantInputSchema, await readJson(ctx.req));
  const errors: Record<string, string> = {};
  if (input.logoImageId && !imageExists(input.logoImageId, "logo")) errors.logoImageId = "Logo bulunamadı. Lütfen yeniden yükleyin.";
  if (input.coverImageId && !imageExists(input.coverImageId, "cover")) errors.coverImageId = "Kapak fotoğrafı bulunamadı. Lütfen yeniden yükleyin.";
  if (Object.keys(errors).length) throw new HttpError(422, "Lütfen işaretli alanları kontrol edin.", errors);
  saveRestaurant(input);
  logActivity(uid(ctx), "settings", "restoran", null, "Restoran bilgileri güncellendi");
  return restaurantGet();
}

export function designGet(): Response {
  return json({ design: getDesign() });
}

export async function designSave(ctx: Ctx): Promise<Response> {
  const input = validate(designInputSchema, await readJson(ctx.req));
  saveDesign({ ...input, accentColor: input.accentColor.toUpperCase() });
  logActivity(uid(ctx), "settings", "tasarim", null, "Menü tasarım ayarları güncellendi");
  return json({ design: getDesign() });
}

function systemInfo() {
  let dbBytes = 0;
  for (const suffix of ["", "-wal"]) {
    try {
      dbBytes += fs.statSync(config.dbFile + suffix).size;
    } catch {
      /* yok */
    }
  }
  const img = db().get<{ n: number; bytes: number }>("SELECT count(*) AS n, coalesce(sum(bytes_total), 0) AS bytes FROM images")!;
  return {
    dbBytes,
    images: img.n,
    imageBytes: img.bytes,
    schemaVersion: LATEST_SCHEMA_VERSION,
    nodeVersion: process.version,
    dataDir: config.dataDir,
  };
}

export function settingsGet(ctx: Ctx): Response {
  const user = findUserById(uid(ctx))!;
  return json({
    general: getGeneral(),
    defaultPrivacyNotice: defaultPrivacyNotice(getRestaurant()),
    envSiteUrl: config.siteUrl,
    account: { name: user.name, email: user.email, passwordChangedAt: user.password_changed_at, lastLoginAt: user.last_login_at },
    sessions: countSessions(user.id),
    system: systemInfo(),
  });
}

export async function settingsSave(ctx: Ctx): Promise<Response> {
  const input = validate(generalInputSchema, await readJson(ctx.req));
  const before = getGeneral();
  saveGeneral(input);
  const notes: string[] = [];
  if (before.menuPublished !== input.menuPublished) notes.push(input.menuPublished ? "menü yayına alındı" : "menü yayından kaldırıldı");
  if (before.siteUrl !== input.siteUrl) notes.push("menü adresi değiştirildi");
  logActivity(uid(ctx), "settings", "ayarlar", null, `Genel ayarlar güncellendi${notes.length ? ": " + notes.join(", ") : ""}`);
  return settingsGet(ctx);
}

export async function accountSave(ctx: Ctx): Promise<Response> {
  const input = validate(accountInputSchema, await readJson(ctx.req));
  const other = findUserByEmail(input.email);
  if (other && other.id !== uid(ctx)) throw new HttpError(422, "Lütfen işaretli alanları kontrol edin.", { email: "Bu e-posta başka bir hesapta kullanılıyor." });
  updateUserProfile(uid(ctx), input.name, input.email);
  logActivity(uid(ctx), "settings", "hesap", uid(ctx), "Hesap bilgileri güncellendi");
  return json({ account: { name: input.name, email: input.email } });
}

export async function passwordChange(ctx: Ctx): Promise<Response> {
  const input = validate(passwordChangeSchema, await readJson(ctx.req));
  const user = findUserById(uid(ctx))!;
  if (!(await verifyPassword(input.currentPassword, user.password_hash))) {
    throw new HttpError(422, "Lütfen işaretli alanları kontrol edin.", { currentPassword: "Mevcut şifre hatalı." });
  }
  if (input.currentPassword === input.newPassword) {
    throw new HttpError(422, "Lütfen işaretli alanları kontrol edin.", { newPassword: "Yeni şifre mevcut şifreden farklı olmalıdır." });
  }
  updateUserPassword(user.id, await hashPassword(input.newPassword));
  const closed = destroyOtherSessions(user.id, ctx.session!.id);
  logActivity(user.id, "settings", "hesap", user.id, "Yönetici şifresi değiştirildi");
  return json({ ok: true, closedSessions: closed });
}

export function sessionsRevoke(ctx: Ctx): Response {
  const closed = destroyOtherSessions(uid(ctx), ctx.session!.id);
  logActivity(uid(ctx), "settings", "hesap", uid(ctx), `Diğer cihazlardaki ${closed} oturum kapatıldı`);
  return json({ ok: true, closedSessions: closed });
}

// ---------------------------------------------------------------------------
// QR kod
// ---------------------------------------------------------------------------
/** Basılı fiyat listesi için menüdeki aktif ürünler (müşteri menüsüyle aynı veri) */
export function priceListRoute(ctx: Ctx): Response {
  return json({ menu: buildPublicMenu(ctx.origin) });
}

export function qrInfo(ctx: Ctx): Response {
  const { menuUrl, configured } = menuUrlFor(ctx);
  return json({ menuUrl, configured, restaurantName: getRestaurant().name });
}

function qrFileName(ext: string) {
  return `menu-qr-kod.${ext}`;
}

export async function qrPngRoute(ctx: Ctx): Promise<Response> {
  const size = Number(ctx.url.searchParams.get("boyut") ?? 1024);
  if (![512, 1024, 2048].includes(size)) return apiError(400, "Geçersiz boyut.");
  const { menuUrl } = menuUrlFor(ctx);
  const png = await qrPng(menuUrl, size);
  const headers: Record<string, string> = { "content-type": "image/png", "cache-control": "no-store" };
  if (ctx.url.searchParams.get("indir") === "1") headers["content-disposition"] = `attachment; filename="${qrFileName("png")}"`;
  return new Response(bytes(png), { headers });
}

export function qrSvgRoute(ctx: Ctx): Response {
  const { menuUrl } = menuUrlFor(ctx);
  const headers: Record<string, string> = { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "no-store" };
  if (ctx.url.searchParams.get("indir") === "1") headers["content-disposition"] = `attachment; filename="${qrFileName("svg")}"`;
  return new Response(qrSvg(menuUrl), { headers });
}

// ---------------------------------------------------------------------------
// Yedek: veritabanının tutarlı bir kopyasını indirir (görseller dahil)
// ---------------------------------------------------------------------------
export function backupDownload(ctx: Ctx): Response {
  const dir = path.join(config.dataDir, "tmp");
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const file = path.join(dir, `yedek-${Date.now()}.db`);
  db().exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
  const size = fs.statSync(file).size;
  const stream = fs.createReadStream(file);
  stream.on("close", () => fs.rm(file, { force: true }, () => {}));
  logActivity(uid(ctx), "settings", "yedek", null, "Veritabanı yedeği indirildi");
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      "content-type": "application/vnd.sqlite3",
      "content-length": String(size),
      "content-disposition": `attachment; filename="menu-yedek-${stamp}.db"`,
      "cache-control": "no-store",
    },
  });
}

/** Kullanılmayan görselleri temizler (sunucu açılışında ve günde bir kez) */
export function cleanupImages(): number {
  const s = getStoredRestaurant();
  return deleteOrphanImages([s.logoImageId ?? "", s.coverImageId ?? ""]);
}
