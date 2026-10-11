/**
 * Uçtan uca sunucu davranışı (HTTP katmanı + veritabanı):
 * giriş/oturum güvenliği, menü yönetimi API'si, görsel yükleme, QR kod ve müşteri menüsü SSR.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import sharp from "sharp";
import { decodeQrPng } from "../qr";
import { ADMIN, Client, embedded, multipart, ORIGIN } from "./harness";

const admin = new Client();
const ids: { cat?: number; cat2?: number; product?: number; image?: string } = {};

describe("herkese açık sayfalar", () => {
  it("kök adres menüye yönlendirir; boş menü bilgi mesajı gösterir", async () => {
    const c = new Client();
    const root = await c.get("/");
    assert.equal(root.status, 302);
    assert.equal(root.headers.get("location"), "/menu");

    const menu = await c.get("/menu");
    assert.equal(menu.status, 200);
    assert.match(menu.text, /Menümüz hazırlanıyor/);
    assert.match(menu.headers.get("content-security-policy") ?? "", /default-src 'self'/);
    assert.equal(menu.headers.get("x-content-type-options"), "nosniff");
    assert.match(menu.text, /<body data-surface="menu" data-mode="light" data-font="geometrik"/);
  });

  it("sondaki eğik çizgiyi kaldırır, bilinmeyen sayfada 404 verir", async () => {
    const c = new Client();
    assert.equal((await c.get("/menu/")).status, 308);
    const missing = await c.get("/olmayan-sayfa");
    assert.equal(missing.status, 404);
    assert.match(missing.text, /Aradığınız sayfa bulunamadı/);
  });

  it("statik ikonları uzun süreli önbellekle sunar, klasör dışına çıkmaya izin vermez", async () => {
    const c = new Client();
    const icon = await c.get("/ikonlar/soup.webp?v=1");
    assert.equal(icon.status, 200);
    assert.equal(icon.headers.get("content-type"), "image/webp");
    // Üretimde "immutable"; geliştirme/test ortamında her istekte yeniden doğrulanır
    assert.match(icon.headers.get("cache-control") ?? "", /immutable|must-revalidate/);
    assert.equal((await c.get("/ikonlar/../manifest.json")).status, 404);
    assert.equal((await c.get("/ikonlar/%2e%2e/manifest.json")).status, 404);
  });

  it("robots.txt yönetim panelini dizinlemez", async () => {
    const r = await new Client().get("/robots.txt");
    assert.match(r.text, /Disallow: \/yonetim/);
  });
});

describe("giriş ve oturum güvenliği", () => {
  it("oturumsuz panel isteklerini reddeder", async () => {
    const c = new Client();
    const page = await c.get("/yonetim/urunler");
    assert.equal(page.status, 303);
    assert.equal(page.headers.get("location"), "/yonetim/giris?sonra=%2Fyonetim%2Furunler");
    const api = await c.get("/yonetim/api/kategoriler");
    assert.equal(api.status, 401);
    assert.match(api.json().error, /Oturumunuz/);
  });

  it("hatalı şifrede genel bir hata verir", async () => {
    const c = new Client("198.51.100.7");
    const res = await c.login(ADMIN.email, "yanlis-sifre-123");
    assert.equal(res.status, 401);
    assert.match(res.text, /E-posta adresi veya şifre hatalı/);
    assert.equal(c.cookies.size, 0);
  });

  it("başka siteden gönderilen giriş formunu reddeder", async () => {
    const c = new Client("198.51.100.8");
    const res = await c.send("POST", "/yonetim/giris", { form: { email: ADMIN.email, password: ADMIN.password }, origin: "https://kotu.site" });
    assert.equal(res.status, 403);
    assert.equal(c.cookies.size, 0);
  });

  it("doğru bilgilerle güvenli, yalnızca panele özel oturum çerezi verir", async () => {
    const res = await admin.send("POST", "/yonetim/giris", { form: { email: ADMIN.email.toUpperCase(), password: ADMIN.password, sonra: "/yonetim/urunler" } });
    assert.equal(res.status, 303);
    assert.equal(res.headers.get("location"), "/yonetim/urunler");
    const cookie = res.headers.getSetCookie().find((c) => c.startsWith("menu_oturum="))!;
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Lax/i);
    assert.match(cookie, /Path=\/yonetim/);
    await admin.login(); // CSRF belirtecini al
    assert.ok(admin.csrf.length >= 32);
  });

  it("CSRF belirteci olmadan veri değiştirmeye izin vermez", async () => {
    const noToken = new Client();
    noToken.cookies = new Map(admin.cookies);
    const res = await noToken.send("POST", "/yonetim/api/kategoriler", { json: { name: "Deneme", icon: "soup" } });
    assert.equal(res.status, 403);
    const crossSite = await admin.send("POST", "/yonetim/api/kategoriler", { json: { name: "Deneme", icon: "soup" }, origin: "https://kotu.site" });
    assert.equal(crossSite.status, 403);
  });

  it("art arda hatalı denemelerden sonra girişi geçici olarak kilitler", async () => {
    const c = new Client("198.51.100.99");
    let last = 0;
    for (let i = 0; i < 6; i++) last = (await c.login("kilit@ornek.com", "yanlis-sifre-123")).status;
    assert.equal(last, 429);
  });
});

describe("menü yönetimi API'si", () => {
  it("kategori oluşturur, doğrular ve sıralar", async () => {
    const bad = await admin.send("POST", "/yonetim/api/kategoriler", { json: { name: "", icon: "yok" } });
    assert.equal(bad.status, 422);
    assert.ok(bad.json().fieldErrors.name);
    assert.ok(bad.json().fieldErrors.icon);

    const a = await admin.send("POST", "/yonetim/api/kategoriler", { json: { name: "Izgaralar", icon: "beef", description: "Mangalda pişer." } });
    assert.equal(a.status, 201);
    ids.cat = a.json().category.id;
    assert.equal(a.json().category.slug, "izgaralar");

    const b = await admin.send("POST", "/yonetim/api/kategoriler", { json: { name: "İçecekler", icon: "cupsoda" } });
    ids.cat2 = b.json().category.id;
    assert.equal(b.json().category.slug, "icecekler");

    const order = await admin.send("PUT", "/yonetim/api/kategoriler/sirala", { json: { ids: [ids.cat2, ids.cat] } });
    assert.deepEqual(
      order.json().categories.map((c: { id: number }) => c.id),
      [ids.cat2, ids.cat],
    );
  });

  it("ürün fotoğrafı yükler (WebP varyantları, EXIF silinmiş)", async () => {
    const photo = await sharp({ create: { width: 1400, height: 1050, channels: 3, background: "#8a4a1f" } })
      .jpeg()
      .withExif({ IFD0: { Artist: "Gizli Kişi" } })
      .toBuffer();
    const { body, headers } = await multipart(photo, "kofte.jpg", "image/jpeg");
    const res = await admin.send("POST", "/yonetim/api/gorseller?tur=product", { body, headers });
    assert.equal(res.status, 201, res.text);
    const image = res.json().image;
    assert.deepEqual(image.widths, [400, 800, 1200]);
    ids.image = image.id;

    const variant = await new Client().get(`/img/${image.id}/400.webp`);
    assert.equal(variant.status, 200);
    assert.equal(variant.headers.get("content-type"), "image/webp");
    const meta = await sharp(variant.bytes).metadata();
    assert.equal(meta.width, 400);
    assert.equal(meta.exif, undefined);
    assert.equal((await new Client().get(`/img/${"0".repeat(24)}/400.webp`)).status, 404);
    assert.equal((await new Client().get(`/img/../400.webp`)).status, 404);

    const notImage = await multipart(Buffer.from("merhaba"), "not.txt", "text/plain");
    const rejected = await admin.send("POST", "/yonetim/api/gorseller?tur=product", notImage);
    assert.equal(rejected.status, 422);
  });

  it("ürün oluşturur, günceller ve hızlı düzenler", async () => {
    const bad = await admin.send("POST", "/yonetim/api/urunler", { json: { name: "Köfte", priceCents: -5, categoryId: ids.cat } });
    assert.equal(bad.status, 422);
    assert.equal(bad.json().fieldErrors.priceCents, "Fiyat negatif olamaz.");

    const created = await admin.send("POST", "/yonetim/api/urunler", {
      json: {
        name: "Izgara Köfte <b>",
        description: "Kasap köfte; közlenmiş biber ve domates ile.",
        priceCents: 26000,
        categoryId: ids.cat,
        imageId: ids.image,
        isFeatured: true,
        badges: ["sef"],
        allergens: "Gluten (ekmek)",
        calories: 620,
      },
    });
    assert.equal(created.status, 201, created.text);
    const p = created.json().product;
    ids.product = p.id;
    assert.equal(p.slug, "izgara-kofte-b");
    assert.equal(p.image.id, ids.image);

    const second = await admin.send("POST", "/yonetim/api/urunler", { json: { name: "Ayran", priceCents: 4500, categoryId: ids.cat2 } });
    assert.equal(second.status, 201);
    const soldOut = await admin.send("POST", "/yonetim/api/urunler", {
      json: { name: "Kuzu Şiş", priceCents: 39000, categoryId: ids.cat, isFeatured: true, isSoldOut: true },
    });
    assert.equal(soldOut.status, 201);

    const patched = await admin.send("PATCH", `/yonetim/api/urunler/${p.id}`, { json: { priceCents: 27500 } });
    assert.equal(patched.json().product.priceCents, 27500);

    const list = await admin.get(`/yonetim/api/urunler?kategori=${ids.cat}`);
    assert.equal(list.status, 200);
    assert.ok(list.json().products.length >= 2);
  });

  it("genel bakış özetini döner", async () => {
    const s = (await admin.get("/yonetim/api/ozet")).json();
    assert.equal(s.totals.products, 3);
    assert.equal(s.totals.categories, 2);
    assert.equal(s.totals.soldOutProducts, 1);
    assert.equal(s.totals.productsWithoutImage, 2);
    assert.equal(s.menuUrl, `${ORIGIN}/menu`);
    assert.ok(s.activity.length > 0);
  });
});

describe("müşteri menüsü (SSR)", () => {
  it("yalnızca aktif ürünleri, güvenli biçimde ve sepet/sipariş öğesi olmadan gösterir", async () => {
    const res = await new Client().get("/menu");
    assert.equal(res.status, 200);
    const data = embedded(res.text, "menu-veri");
    assert.equal(data.initialView, "tumu");
    assert.deepEqual(
      data.data.categories.map((c: { name: string }) => c.name),
      ["İçecekler", "Izgaralar"],
    );
    // Öne çıkanlar: tükenen ürün sona
    assert.deepEqual(
      data.data.featured.map((p: { name: string }) => p.name),
      ["Izgara Köfte <b>", "Kuzu Şiş"],
    );
    assert.ok(!res.text.includes("Izgara Köfte <b>"), "ürün adı HTML olarak kaçışlanmalı");
    assert.match(res.text, /Izgara Köfte &lt;b&gt;/);
    assert.match(res.text, /Tüm Ürünler/);
    assert.ok(!/sepet|sipariş ver|sepete ekle/i.test(res.text.replace(/<script[\s\S]*?<\/script>/g, "")), "menüde sepet/sipariş öğesi olmamalı");
  });

  it("?urun= ile paylaşılan ürün detayını açık getirir ve sosyal önizleme üretir", async () => {
    const res = await new Client().get("/menu?urun=izgara-kofte-b");
    const data = embedded(res.text, "menu-veri");
    assert.equal(data.initialSlug, "izgara-kofte-b");
    assert.match(res.text, /<title>Izgara Köfte &lt;b&gt; \| /);
    assert.match(res.text, new RegExp(`<meta property="og:image" content="${ORIGIN}/img/${ids.image}/1200.jpg">`));
    assert.match(res.text, /<dialog[^>]*open/);
    assert.match(res.text, /Gluten \(ekmek\)/);

    const jpg = await new Client().get(`/img/${ids.image}/1200.jpg`);
    assert.equal(jpg.headers.get("content-type"), "image/jpeg");

    const missing = embedded((await new Client().get("/menu?urun=olmayan-urun")).text, "menu-veri");
    assert.equal(missing.initialSlug, null);
    assert.equal(missing.missingProduct, true);
  });

  it("?kategori= ile seçili sekmeyi getirir, geçersiz değeri yok sayar", async () => {
    assert.equal(embedded((await new Client().get("/menu?kategori=izgaralar")).text, "menu-veri").initialView, "izgaralar");
    assert.equal(embedded((await new Client().get("/menu?kategori=one-cikanlar")).text, "menu-veri").initialView, "one-cikanlar");
    assert.equal(embedded((await new Client().get("/menu?kategori=%3Cscript%3E")).text, "menu-veri").initialView, "tumu");
  });

  it("pasif kategori ve ürünleri menüden gizler", async () => {
    await admin.send("PATCH", `/yonetim/api/kategoriler/${ids.cat2}`, { json: { isActive: false } });
    const data = embedded((await new Client().get("/menu")).text, "menu-veri");
    assert.deepEqual(
      data.data.categories.map((c: { name: string }) => c.name),
      ["Izgaralar"],
    );
    await admin.send("PATCH", `/yonetim/api/kategoriler/${ids.cat2}`, { json: { isActive: true } });
  });

  it("tasarım önizlemesi yalnızca oturum açmış yöneticiye açıktır", async () => {
    const anon = await new Client().get("/yonetim/onizleme?mod=dark");
    assert.equal(anon.status, 303);
    // Ziyaretçi ?onizleme parametresiyle kaydedilmemiş ayarları göremez
    assert.match((await new Client().get("/menu?onizleme=1&mod=dark")).text, /data-mode="light"/);

    const preview = await admin.get("/yonetim/onizleme?mod=dark&renk=%23C0392B&yazi=klasik");
    assert.equal(preview.status, 200);
    assert.match(preview.text, /data-mode="dark" data-font="klasik"/);
    assert.match(preview.text, /--c-accent:#c0392b/);
    assert.match(preview.text, /noindex/);
    assert.equal(embedded(preview.text, "menu-veri").data.preview, true);
  });

  it("menü yayından kaldırılınca bilgilendirme sayfası gösterir", async () => {
    const general = (await admin.get("/yonetim/api/ayarlar")).json().general;
    const off = await admin.send("PUT", "/yonetim/api/ayarlar", { json: { ...general, menuPublished: false, unpublishedMessage: "Bakımdayız, birazdan döneceğiz." } });
    assert.equal(off.status, 200, off.text);
    const res = await new Client().get("/menu");
    assert.equal(res.status, 503);
    assert.match(res.text, /Bakımdayız, birazdan döneceğiz\./);
    assert.equal((await admin.get("/yonetim/onizleme")).status, 200);
    await admin.send("PUT", "/yonetim/api/ayarlar", { json: { ...general, menuPublished: true } });
    assert.equal((await new Client().get("/menu")).status, 200);
  });
});

describe("restoran ayarları ve QR kod", () => {
  it("restoran bilgilerini kaydeder ve menüye yansıtır", async () => {
    const current = (await admin.get("/yonetim/api/restoran")).json().restaurant;
    const { logo: _l, cover: _c, ...stored } = current;
    const res = await admin.send("PUT", "/yonetim/api/restoran", {
      json: { ...stored, name: "Lezzet Durağı", heroTitle: "Eşsiz Lezzetler Sizi Bekliyor", tagline: "Taze malzemeler.", whatsapp: "+90 555 123 45 67" },
    });
    assert.equal(res.status, 200, res.text);
    const menu = await new Client().get("/menu");
    assert.match(menu.text, /Eşsiz Lezzetler Sizi Bekliyor/);
    assert.match(menu.text, /wa\.me\/905551234567/);

    const bad = await admin.send("PUT", "/yonetim/api/restoran", { json: { ...stored, coverImageId: "a".repeat(24) } });
    assert.equal(bad.status, 422);
  });

  it("menü adresini içeren, okunabilir QR kod PNG/SVG üretir", async () => {
    const info = (await admin.get("/yonetim/api/qr")).json();
    assert.equal(info.menuUrl, `${ORIGIN}/menu`);
    const png = await admin.get("/yonetim/api/qr.png?boyut=1024&indir=1");
    assert.equal(png.headers.get("content-type"), "image/png");
    assert.match(png.headers.get("content-disposition") ?? "", /attachment; filename="menu-qr-kod\.png"/);
    assert.equal(await decodeQrPng(png.bytes), `${ORIGIN}/menu`);
    assert.equal((await admin.get("/yonetim/api/qr.png?boyut=7")).status, 400);
    assert.match((await admin.get("/yonetim/api/qr.svg")).text, /^<svg/);

    // Site adresi ayarlanınca QR bu adrese göre üretilir
    const general = (await admin.get("/yonetim/api/ayarlar")).json().general;
    await admin.send("PUT", "/yonetim/api/ayarlar", { json: { ...general, siteUrl: "https://lezzetduragi.com/" } });
    const png2 = await admin.get("/yonetim/api/qr.png?boyut=512");
    assert.equal(await decodeQrPng(png2.bytes), "https://lezzetduragi.com/menu");
    await admin.send("PUT", "/yonetim/api/ayarlar", { json: { ...general, siteUrl: "" } });
  });
});

describe("hesap", () => {
  it("şifre değişince diğer oturumları kapatır", async () => {
    const other = new Client("192.0.2.50");
    await other.login();
    assert.equal((await other.get("/yonetim/api/ozet")).status, 200);

    const weak = await admin.send("PUT", "/yonetim/api/hesap/sifre", { json: { currentPassword: ADMIN.password, newPassword: "kisa", confirmPassword: "kisa" } });
    assert.equal(weak.status, 422);

    const newPassword = "YeniGucluSifre2026!";
    const res = await admin.send("PUT", "/yonetim/api/hesap/sifre", { json: { currentPassword: ADMIN.password, newPassword, confirmPassword: newPassword } });
    assert.equal(res.status, 200, res.text);
    assert.ok(res.json().closedSessions >= 1);
    assert.equal((await other.get("/yonetim/api/ozet")).status, 401);
    assert.equal((await admin.get("/yonetim/api/ozet")).status, 200);

    const out = await admin.send("POST", "/yonetim/cikis", { form: { csrf: admin.csrf } });
    assert.equal(out.status, 303);
    assert.equal((await admin.get("/yonetim/api/ozet")).status, 401);
  });
});
