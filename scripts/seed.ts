/**
 * Örnek verileri yükler.
 *
 *   npm run seed                           → veritabanı boşsa örnek restoran + menüyü (fotoğraflarıyla) yükler
 *   npm run seed -- --sifirla              → mevcut menüyü SİLER ve örnek menüyü yeniden yükler
 *   npm run seed -- --fotografsiz          → örnek menüyü fotoğrafsız yükler
 *   npm run seed -- --fotograflar ./klasor → kendi fotoğraflarınızı ürünlere bağlar
 *        (dosya adı ürünün kısa adıyla eşleşmeli: izgara-tavuk.jpg; kapak için kapak.jpg, logo için logo.png)
 *
 * Yönetici hesabı yoksa ADMIN_EMAIL / ADMIN_PASSWORD ortam değişkenleriyle (yoksa rastgele şifreyle) oluşturulur.
 */
import fs from "node:fs";
import path from "node:path";
import { config } from "../src/server/config";
import { db, openDb } from "../src/server/db";
import { generatePassword, hashPassword } from "../src/server/auth/password";
import { createCategory } from "../src/server/repo/categories";
import { insertImage } from "../src/server/repo/images";
import { createProduct } from "../src/server/repo/products";
import { DEFAULT_DESIGN, DEFAULT_GENERAL, getStoredRestaurant, saveDesign, saveGeneral, saveRestaurant } from "../src/server/repo/settings";
import { countUsers, createUser } from "../src/server/repo/users";
import { processImage } from "../src/server/services/images";
import { slugify } from "../src/shared/format";
import type { ImageCredit, ImageKind } from "../src/shared/types";
import { SAMPLE_COVER_PHOTO, SAMPLE_MENU, SAMPLE_RESTAURANT } from "./seed-data";

const args = process.argv.slice(2);
const reset = args.includes("--sifirla");
const noPhotos = args.includes("--fotografsiz");
const photosIdx = args.indexOf("--fotograflar");
const photosDir = photosIdx >= 0 ? path.resolve(args[photosIdx + 1] ?? "") : null;
const SAMPLE_PHOTOS_DIR = path.join(config.root, "ornek-veriler", "fotograflar");

function findPhoto(dir: string, base: string): string | null {
  for (const ext of [".jpg", ".jpeg", ".png", ".webp", ".avif"]) {
    const f = path.join(dir, base + ext);
    if (fs.existsSync(f)) return f;
  }
  return null;
}

async function importPhoto(file: string, kind: ImageKind, credit: ImageCredit | null = null): Promise<string> {
  const img = await processImage(fs.readFileSync(file), kind, path.basename(file));
  img.credit = credit;
  insertImage(img);
  return img.id;
}

/** Örnek fotoğrafların yazar/lisans bilgileri */
function loadSampleCredits(): Record<string, ImageCredit> {
  try {
    return JSON.parse(fs.readFileSync(path.join(SAMPLE_PHOTOS_DIR, "kaynaklar.json"), "utf8"));
  } catch {
    return {};
  }
}

async function main() {
  openDb(config.dbFile);
  console.log(`Veritabanı: ${config.dbFile}`);

  // --- Yönetici hesabı -----------------------------------------------------
  if (countUsers() === 0) {
    const email = (process.env.ADMIN_EMAIL ?? "yonetici@lezzetduragi.com").trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD || generatePassword();
    createUser(email, process.env.ADMIN_NAME ?? "Restoran Yöneticisi", await hashPassword(password));
    console.log("\n┌──────────────────────────────────────────────────────────");
    console.log("│ Yönetici hesabı oluşturuldu");
    console.log(`│ E-posta : ${email}`);
    console.log(`│ Şifre   : ${process.env.ADMIN_PASSWORD ? "(ADMIN_PASSWORD değişkenindeki şifre)" : password}`);
    console.log("│ Giriş yaptıktan sonra Genel Ayarlar → Şifre bölümünden değiştirin.");
    console.log("└──────────────────────────────────────────────────────────\n");
  }

  // --- Menü -----------------------------------------------------------------
  const existing = db().get<{ n: number }>("SELECT count(*) AS n FROM categories")!.n;
  if (existing > 0 && !reset) {
    console.log("Menüde zaten veri var; örnek menü yüklenmedi. (Sıfırlamak için: npm run seed -- --sifirla)");
  } else {
    const credits = loadSampleCredits();
    const samplePhotos = !noPhotos && fs.existsSync(SAMPLE_PHOTOS_DIR);
    if (!noPhotos && !samplePhotos) console.warn(`⚠  Örnek fotoğraf klasörü bulunamadı (${SAMPLE_PHOTOS_DIR}); menü fotoğrafsız yüklenecek.`);

    db().tx(() => {
      db().run("DELETE FROM products");
      db().run("DELETE FROM categories");
      db().run("DELETE FROM product_views");
    });
    let photoCount = 0;
    for (const cat of SAMPLE_MENU) {
      const category = createCategory({ name: cat.name, description: cat.description, icon: cat.icon, isActive: true });
      for (const p of cat.products) {
        let imageId: string | null = null;
        const file = samplePhotos && p.photo ? findPhoto(SAMPLE_PHOTOS_DIR, p.photo) : null;
        if (file) {
          imageId = await importPhoto(file, "product", credits[p.photo!] ?? null);
          photoCount++;
        }
        createProduct({
          name: p.name,
          description: p.description,
          priceCents: Math.round(p.price * 100),
          categoryId: category.id,
          imageId,
          isActive: true,
          isFeatured: !!p.featured,
          isSoldOut: !!p.soldOut,
          badges: p.badges ?? [],
          allergens: p.allergens ?? "",
          calories: p.calories ?? null,
        });
      }
    }
    if (reset || !db().get("SELECT 1 FROM settings WHERE key = 'restaurant'")) {
      const restaurant = { ...SAMPLE_RESTAURANT };
      const cover = samplePhotos ? findPhoto(SAMPLE_PHOTOS_DIR, SAMPLE_COVER_PHOTO) : null;
      if (cover) restaurant.coverImageId = await importPhoto(cover, "cover", credits[SAMPLE_COVER_PHOTO] ?? null);
      saveRestaurant(restaurant);
      saveDesign({ ...DEFAULT_DESIGN });
      saveGeneral({ ...DEFAULT_GENERAL, seoDescription: "" });
    }
    const n = SAMPLE_MENU.reduce((s, c) => s + c.products.length, 0);
    console.log(`✔ Örnek menü yüklendi: ${SAMPLE_MENU.length} kategori, ${n} ürün, ${photoCount} fotoğraf.`);
  }

  // --- Kendi fotoğraflarınız ------------------------------------------------------
  if (photosDir) {
    if (!fs.existsSync(photosDir)) throw new Error(`Klasör bulunamadı: ${photosDir}`);
    let linked = 0;
    const products = db().all<{ id: number; name: string; slug: string }>("SELECT id, name, slug FROM products");
    for (const p of products) {
      const file = findPhoto(photosDir, p.slug) ?? findPhoto(photosDir, slugify(p.name));
      if (!file) continue;
      const id = await importPhoto(file, "product");
      db().run("UPDATE products SET image_id = ? WHERE id = ?", id, p.id);
      linked++;
    }
    const stored = getStoredRestaurant();
    const cover = findPhoto(photosDir, "kapak");
    const logo = findPhoto(photosDir, "logo");
    if (cover) stored.coverImageId = await importPhoto(cover, "cover");
    if (logo) stored.logoImageId = await importPhoto(logo, "logo");
    if (cover || logo) saveRestaurant(stored);
    console.log(`✔ ${linked} ürün fotoğrafı bağlandı${cover ? ", kapak eklendi" : ""}${logo ? ", logo eklendi" : ""}.`);
  }
}

main().catch((err) => {
  console.error("Hata:", err instanceof Error ? err.message : err);
  process.exit(1);
});
