/**
 * Tarayıcı testleri (Playwright + Chromium): derlenmiş uygulamayı geçici bir veri klasörüyle
 * başlatır, örnek menüyü yükler ve müşteri menüsü ile yönetim panelini gerçek tarayıcıda dener.
 *
 *   npm run build && npm run test:e2e
 *   npm run test:e2e -- --ekran     → docs/ekran-goruntuleri altına güncel ekran görüntüleri kaydeder
 */
import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import sharp from "sharp";
import { decodeQrPng } from "../qr";

const repo = path.resolve(import.meta.dirname, "../..");
const shotsDir = path.join(repo, "docs", "ekran-goruntuleri");
const takeShots = process.argv.includes("--ekran");
const ADMIN = { email: "yonetici@ornek.com", password: "E2eTestSifresi2026" };

if (!fs.existsSync(path.join(repo, "dist", "server.mjs"))) {
  console.error("Önce uygulamayı derleyin: npm run build");
  process.exit(1);
}

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "dijital-menu-e2e-"));
const env = { ...process.env, DATA_DIR: dataDir, NODE_ENV: "production", SITE_URL: "", TRUST_PROXY: "false", ADMIN_EMAIL: ADMIN.email, ADMIN_PASSWORD: ADMIN.password };

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address() as net.AddressInfo;
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

let passed = 0;
async function step(name: string, fn: () => Promise<void>) {
  const t = Date.now();
  try {
    await fn();
    passed++;
    console.log(`  ✔ ${name} (${Date.now() - t} ms)`);
  } catch (err) {
    console.error(`  ✘ ${name}`);
    throw err;
  }
}

/** Ekran görüntüsünü depoda az yer kaplaması için WebP olarak kaydeder */
async function shot(page: Page, name: string) {
  if (!takeShots) return;
  fs.mkdirSync(shotsDir, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
  const png = await page.screenshot();
  await sharp(png).webp({ quality: 82 }).toFile(path.join(shotsDir, `${name}.webp`));
}

/** Sayfadaki tüm (görünür) görseller yüklendi mi? */
async function imagesLoaded(page: Page, selector: string) {
  await page.waitForFunction(
    (sel) => [...document.querySelectorAll<HTMLImageElement>(sel)].every((img) => img.complete && img.naturalWidth > 0),
    selector,
    { timeout: 10_000 },
  );
}

async function main() {
  // 1) Örnek veriyi yükle ve sunucuyu başlat
  const seed = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", "dist/seed.mjs"], { cwd: repo, env, encoding: "utf8" });
  assert.equal(seed.status, 0, seed.stderr || seed.stdout);
  assert.match(seed.stdout, /Örnek menü yüklendi: 7 kategori, 33 ürün/);

  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const server: ChildProcess = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", "dist/server.mjs"], {
    cwd: repo,
    env: { ...env, PORT: String(port), HOST: "127.0.0.1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let serverLog = "";
  server.stdout?.on("data", (d) => (serverLog += d));
  server.stderr?.on("data", (d) => (serverLog += d));
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(`${base}/saglik`)).ok) break;
    } catch {
      /* henüz açılmadı */
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  const browser: Browser = await chromium.launch();
  const pageErrors: string[] = [];
  const track = (p: Page) => {
    p.on("pageerror", (e) => pageErrors.push(`${p.url()}: ${e.message}`));
    p.on("console", (m) => m.type() === "error" && pageErrors.push(`${p.url()}: ${m.text()}`));
    return p;
  };

  try {
    console.log("\nMüşteri menüsü — masaüstü");
    const desk = track(await browser.newPage({ viewport: { width: 1440, height: 900 } }));
    await desk.goto(`${base}/menu`, { waitUntil: "networkidle" });

    await step("kapak, arama ve kategori sekmeleri referanstaki sırada", async () => {
      assert.equal((await desk.locator("h1").innerText()).replace(/\s+/g, " "), "Eşsiz Lezzetler Sizi Bekliyor");
      assert.ok(await desk.getByRole("searchbox", { name: "Menüde ara" }).isVisible());
      const tiles = await desk.locator("[data-tile]").allInnerTexts();
      assert.deepEqual(tiles.map((t) => t.trim()), ["Tüm Ürünler", "Başlangıçlar", "Ana Yemekler", "Izgaralar", "Burgerler", "Salatalar", "Tatlılar", "İçecekler"]);
      assert.equal(await desk.locator('[data-tile="tumu"]').getAttribute("aria-current"), "true");
    });

    await step("öne çıkanlar: 4 fotoğraflı kart, turuncu fiyat", async () => {
      const cards = desk.locator('section[aria-labelledby="one-cikanlar"] li:visible');
      assert.equal(await cards.count(), 4);
      await imagesLoaded(desk, 'section[aria-labelledby="one-cikanlar"] li:not([hidden]) img');
      const first = await cards.first().innerText();
      assert.match(first, /Izgara Tavuk/);
      assert.match(first, /₺180,00/);
      assert.ok(await desk.getByText("Tümünü Gör").isVisible());
    });

    await step("sepet, sipariş veya ödeme öğesi yok", async () => {
      const text = await desk.locator("body").innerText();
      assert.ok(!/sepet|sepete ekle|sipariş ver|ödeme|adet/i.test(text), "menüde sepet/sipariş öğesi bulunmamalı");
    });

    await step("kategori sekmesi menüyü filtreler ve adrese yazılır", async () => {
      await desk.locator('[data-tile="izgaralar"]').click();
      await desk.waitForURL(/kategori=izgaralar/);
      assert.ok(await desk.locator("#izgaralar").isVisible());
      assert.equal(await desk.locator("#baslangiclar").count(), 0);
      assert.equal(await desk.locator("#izgaralar [data-urun]").count(), 6);
      await desk.locator('[data-tile="tumu"]').click();
      await desk.waitForURL((u) => !u.search.includes("kategori"));
      assert.equal(await desk.locator("section[id] [data-urun]").count() >= 33, true);
    });

    await step("arama Türkçe karakterden bağımsız sonuç verir", async () => {
      await desk.getByRole("searchbox", { name: "Menüde ara" }).fill("sogan corbasi");
      await desk.getByRole("heading", { name: "Arama sonuçları" }).waitFor();
      assert.equal(await desk.locator("#menu-icerik [data-urun]").count(), 1);
      assert.ok(await desk.locator('[data-urun="firinda-sogan-corbasi"]').isVisible());
      await desk.getByRole("searchbox", { name: "Menüde ara" }).fill("xyzxyz");
      await desk.getByText("“xyzxyz” için sonuç yok").waitFor();
      await desk.getByRole("button", { name: "Tüm menüyü göster" }).click();
    });

    await step("ürün detayı: fotoğraf, ad, fiyat, içerik ve alerjen (sepet yok)", async () => {
      await desk.locator('[data-urun="izgara-tavuk"]').first().click();
      await desk.waitForURL(/urun=izgara-tavuk/);
      const dialog = desk.locator("dialog[open]");
      await dialog.waitFor();
      await imagesLoaded(desk, "dialog[open] img");
      const text = await dialog.innerText();
      assert.match(text, /Izgara Tavuk/);
      assert.match(text, /₺180,00/);
      assert.match(text, /İÇERİK|İçerik/); // CSS ile büyük harfe çevrilir
      assert.match(text, /Alerjenler/);
      assert.ok(!/sepet|ekle|adet|sipariş/i.test(text));
      await shot(desk, "urun-detay-masaustu");
      await desk.keyboard.press("Escape");
      await desk.waitForURL((u) => !u.search.includes("urun"));
      assert.equal(await desk.locator("dialog[open]").count(), 0);
    });

    await step("tükenen ürün işaretli, rozet filtresi çalışır", async () => {
      assert.match(await desk.locator('[data-urun="firinda-dana-incik"]').innerText(), /Tükendi/);
      await desk.getByRole("button", { name: /Filtrele/ }).click();
      await desk.getByRole("button", { name: "Vegan", exact: true }).click();
      await desk.getByRole("button", { name: /ürünü göster/ }).click();
      await desk.waitForTimeout(300);
      assert.deepEqual(await desk.locator("#menu-icerik section[id] [data-urun]").evaluateAll((els) => els.map((e) => e.getAttribute("data-urun"))), ["avokadolu-kinoa-kasesi"]);
      await desk.getByRole("button", { name: "Temizle" }).first().click();
    });

    await step("çerez yok; alt bilgide gizlilik ve çerez bilgisi açılır", async () => {
      assert.deepEqual(await desk.context().cookies(), [], "müşteri menüsü çerez yazmamalı");
      await desk.getByRole("button", { name: "Gizlilik ve çerezler" }).click();
      const sheet = desk.locator("dialog[open]");
      await sheet.getByRole("heading", { name: "Çerezler", exact: true }).waitFor();
      assert.match(await sheet.innerText(), /Dijital menümüz çerez kullanmaz/);
      await desk.keyboard.press("Escape");
      await desk.waitForFunction(() => !document.querySelector("dialog[open]"));
    });

    await step("paylaşılan ürün bağlantısı sunucuda açık gelir", async () => {
      await desk.goto(`${base}/menu?urun=dana-antrikot`, { waitUntil: "networkidle" });
      assert.match(await desk.locator("dialog[open]").innerText(), /Dana Antrikot/);
      assert.match(await desk.title(), /^Dana Antrikot \|/);
      await desk.goto(`${base}/menu`, { waitUntil: "networkidle" });
      assert.ok(await desk.getByRole("link", { name: "WhatsApp ile bize yazın" }).isVisible());
      await shot(desk, "menu-masaustu");
    });

    console.log("\nMüşteri menüsü — telefon");
    const phone = track(
      await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }),
    );
    await phone.goto(`${base}/menu`, { waitUntil: "networkidle" });

    await step("yatay taşma yok; alt gezinme Ana Sayfa · Menü · Ara · İletişim", async () => {
      const { sw, cw } = await phone.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      assert.equal(sw, cw, "sayfa yatay kaymamalı");
      const nav = phone.getByRole("navigation", { name: "Hızlı gezinme" });
      assert.deepEqual((await nav.getByRole("button").allInnerTexts()).map((t) => t.trim()), ["Ana Sayfa", "Menü", "Ara", "İletişim"]);
      assert.ok(!/sepet/i.test(await nav.innerText()));
      assert.ok(!(await phone.getByRole("link", { name: "WhatsApp ile bize yazın" }).isVisible()), "telefonda içerik üzerine binmemeli");
      await shot(phone, "menu-telefon");
    });

    await step("öne çıkanlar yatay kaydırılır; kart detayı alttan açılır, geri tuşu kapatır", async () => {
      const scroller = phone.locator('section[aria-labelledby="one-cikanlar"] ul');
      assert.ok(await scroller.evaluate((el) => el.scrollWidth > el.clientWidth));
      await phone.locator('[data-urun="dana-antrikot"]').first().click();
      await phone.locator("dialog[open]").waitFor();
      await imagesLoaded(phone, "dialog[open] img");
      await shot(phone, "urun-detay-telefon");
      await phone.goBack();
      await phone.waitForFunction(() => !document.querySelector("dialog[open]"));
    });

    await step("Menü sekmesi kategori listesini açar ve seçilen kategoriye gider", async () => {
      await phone.getByRole("navigation", { name: "Hızlı gezinme" }).getByRole("button", { name: "Menü" }).click();
      const sheet = phone.locator("dialog[open]");
      await sheet.getByRole("button", { name: /Tatlılar/ }).click();
      await phone.waitForURL(/kategori=tatlilar/);
      assert.ok(await phone.locator("#tatlilar").isVisible());
    });

    console.log("\nYönetim paneli");
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
    const adminPage = track(await ctx.newPage());

    await step("giriş", async () => {
      await adminPage.goto(`${base}/yonetim`);
      await adminPage.waitForURL(/\/yonetim\/giris/);
      await adminPage.getByLabel("E-posta").fill(ADMIN.email);
      await adminPage.getByLabel("Şifre", { exact: true }).fill(ADMIN.password);
      await adminPage.getByRole("button", { name: "Giriş yap" }).click();
      await adminPage.waitForURL(`${base}/yonetim`);
      await adminPage.getByRole("heading", { name: "Genel Bakış" }).waitFor();
      await shot(adminPage, "yonetim-genel-bakis");
    });

    await step("fotoğraflı yeni ürün ekleme → menüde görünür", async () => {
      const photo = path.join(dataDir, "kunefe.jpg");
      await sharp({ create: { width: 1200, height: 900, channels: 3, background: "#d98b2b" } }).jpeg().toFile(photo);
      await adminPage.goto(`${base}/yonetim/urunler/yeni`);
      await adminPage.getByRole("textbox", { name: /^Ürün adı/ }).fill("E2E Künefe");
      await adminPage.getByLabel(/^Açıklama/).fill("Antep fıstıklı, sıcak servis edilir.");
      await adminPage.getByRole("textbox", { name: /^Fiyat/ }).fill("145,50");
      await adminPage.getByLabel(/^Kategori/).selectOption({ label: "Tatlılar" });
      await adminPage.getByLabel(/^Alerjenler/).fill("Süt ürünleri, Antep fıstığı");
      await adminPage.locator('input[type="file"]').setInputFiles(photo);
      await adminPage.getByRole("button", { name: "Değiştir" }).waitFor({ timeout: 15_000 });
      await shot(adminPage, "yonetim-urun-formu");
      await adminPage.getByRole("button", { name: "Ürünü ekle" }).click();
      await adminPage.waitForURL(`${base}/yonetim/urunler`);
      await adminPage.getByText("E2E Künefe").first().waitFor();
      await shot(adminPage, "yonetim-urunler");

      const menu = track(await browser.newPage({ viewport: { width: 1440, height: 900 } }));
      await menu.goto(`${base}/menu?kategori=tatlilar`, { waitUntil: "networkidle" });
      const card = menu.locator('[data-urun="e2e-kunefe"]');
      assert.match(await card.innerText(), /₺145,50/);
      await imagesLoaded(menu, '[data-urun="e2e-kunefe"] img');
      await card.click();
      assert.match(await menu.locator("dialog[open]").innerText(), /Süt ürünleri, Antep fıstığı/);
      await menu.close();
    });

    await step("QR kod PNG indirilir ve menü adresine çözülür", async () => {
      await adminPage.goto(`${base}/yonetim/qr-kod`);
      await adminPage.getByRole("link", { name: /PNG indir/ }).waitFor();
      await shot(adminPage, "yonetim-qr");
      const [download] = await Promise.all([adminPage.waitForEvent("download"), adminPage.getByRole("link", { name: /PNG indir/ }).click()]);
      assert.equal(download.suggestedFilename(), "menu-qr-kod.png");
      const file = await download.path();
      assert.equal(await decodeQrPng(fs.readFileSync(file)), `${base}/menu`);
    });

    await step("basılı fiyat listesi tüm ürünleri fiyatlarıyla A4 olarak hazırlar", async () => {
      await adminPage.goto(`${base}/yonetim/fiyat-listesi`);
      const sheet = adminPage.getByLabel("Basılı fiyat listesi önizlemesi");
      await sheet.waitFor();
      const text = await sheet.innerText();
      assert.match(text, /FİYAT LİSTESİ/);
      assert.match(text, /E2E Künefe[\s\S]*₺145,50/);
      assert.match(text, /Alerjen: Süt ürünleri, Antep fıstığı/);
      assert.match(text, /KDV dahildir/);
      assert.equal(await sheet.locator("li").count(), 34);
      await shot(adminPage, "yonetim-fiyat-listesi");
      const pdf = await adminPage.pdf({ preferCSSPageSize: true, printBackground: true });
      assert.ok(pdf.subarray(0, 5).toString() === "%PDF-" && pdf.length > 20_000);
    });

    await step("koyu tema kaydedilir ve menüye uygulanır", async () => {
      await adminPage.goto(`${base}/yonetim/tasarim`);
      await adminPage.getByRole("radio", { name: /Koyu \(antrasit\)/ }).click();
      await adminPage.frameLocator('iframe[title="Menü önizlemesi"]').locator('body[data-mode="dark"]').waitFor({ timeout: 10_000 });
      await shot(adminPage, "yonetim-tasarim");
      await adminPage.getByRole("button", { name: "Tasarımı kaydet" }).click();
      await adminPage.getByText(/kaydedildi/i).first().waitFor();
      const menu = track(await browser.newPage({ viewport: { width: 1440, height: 900 } }));
      await menu.goto(`${base}/menu`, { waitUntil: "networkidle" });
      assert.equal(await menu.locator("body").getAttribute("data-mode"), "dark");
      await shot(menu, "menu-koyu");
      await menu.close();
      // Varsayılana dön
      await adminPage.getByRole("radio", { name: /Açık \(beyaz\)/ }).click();
      await adminPage.getByRole("button", { name: "Tasarımı kaydet" }).click();
      await adminPage.getByText(/kaydedildi/i).first().waitFor();
    });

    await step("tarayıcı konsolunda hata yok", async () => {
      assert.deepEqual(pageErrors, []);
    });
  } catch (err) {
    console.error("\nSunucu günlüğü:\n" + serverLog.slice(-3000));
    throw err;
  } finally {
    await browser.close();
    server.kill();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
  console.log(`\n✔ ${passed} tarayıcı testi geçti${takeShots ? ` · ekran görüntüleri: ${path.relative(repo, shotsDir)}` : ""}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
