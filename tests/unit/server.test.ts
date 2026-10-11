/** Sunucu modüllerinin birim testleri (bellek içi veritabanı ile) */
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import sharp from "sharp";
import { openDb } from "../../src/server/db";
import { escapeHtml, safeJson } from "../../src/server/http/core";
import { generatePassword, hashPassword, verifyPassword } from "../../src/server/auth/password";
import { clearFailures, lockRemaining, MAX_FAILURES, MemoryRateLimiter, registerFailure } from "../../src/server/auth/rateLimit";
import { qrMatrix, qrPng, qrSvg } from "../../src/server/services/qr";
import { ImageError, processImage } from "../../src/server/services/images";
import { safeNext } from "../../src/server/routes/auth";
import { decodeQrPng } from "../qr";

before(() => {
  openDb(":memory:");
});

describe("şifreler", () => {
  it("scrypt ile özetler ve doğrular", async () => {
    const hash = await hashPassword("GüçlüŞifre2026");
    assert.match(hash, /^scrypt\$/);
    assert.ok(await verifyPassword("GüçlüŞifre2026", hash));
    assert.ok(!(await verifyPassword("güçlüşifre2026", hash)));
    assert.ok(!(await verifyPassword("x", "bozuk$özet")));
  });

  it("rastgele şifre üretir", () => {
    const a = generatePassword();
    assert.equal(a.length, 16);
    assert.notEqual(a, generatePassword());
  });
});

describe("giriş deneme sınırı", () => {
  it(`${MAX_FAILURES} hatalı denemeden sonra kilitler ve temizlenince açar`, () => {
    const keys = ["ip:10.0.0.1", "email:deneme@ornek.com"];
    const now = Date.now();
    for (let i = 0; i < MAX_FAILURES - 1; i++) registerFailure(keys, now);
    assert.equal(lockRemaining(keys, now), 0);
    registerFailure(keys, now);
    assert.ok(lockRemaining(keys, now) > 0);
    clearFailures(keys);
    assert.equal(lockRemaining(keys, now), 0);
  });

  it("bellek içi sınırlayıcı pencere başına isteği sınırlar", () => {
    const limiter = new MemoryRateLimiter(2, 60_000);
    assert.ok(limiter.allow("a"));
    assert.ok(limiter.allow("a"));
    assert.ok(!limiter.allow("a"));
    assert.ok(limiter.allow("b"));
  });
});

describe("HTML güvenliği", () => {
  it("metni ve gömülü JSON'u kaçışlar", () => {
    assert.equal(escapeHtml(`<a href="x">'&'</a>`), "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
    const json = safeJson({ ad: "</script><script>alert(1)</script>", satir: "a b" });
    assert.ok(!json.includes("</script>"));
    assert.ok(!json.includes(" "));
    assert.deepEqual(JSON.parse(json), { ad: "</script><script>alert(1)</script>", satir: "a b" });
  });

  it("girişten sonra yalnızca panel içine yönlendirir", () => {
    assert.equal(safeNext("/yonetim/urunler"), "/yonetim/urunler");
    assert.equal(safeNext("https://kotu.site"), "/yonetim");
    assert.equal(safeNext("//kotu.site"), "/yonetim");
    assert.equal(safeNext("/yonetim\\..\\x"), "/yonetim");
    assert.equal(safeNext(null), "/yonetim");
  });
});

describe("QR kod", () => {
  const url = "https://lezzetduragi.com/menu";

  it("matris ve SVG üretir", () => {
    const m = qrMatrix(url);
    assert.ok(m.length >= 21 && m.length === m[0].length);
    const svg = qrSvg(url);
    assert.match(svg, /^<svg[^>]+viewBox="0 0 \d+ \d+"/);
    assert.ok(svg.includes(`aria-label="QR kod: ${url}"`));
  });

  it("okunabilir PNG üretir (çözülen metin menü adresiyle aynı)", async () => {
    for (const size of [512, 1024]) {
      const png = await qrPng(url, size);
      const meta = await sharp(png).metadata();
      assert.equal(meta.format, "png");
      assert.equal(meta.width, size);
      assert.equal(await decodeQrPng(png), url);
    }
  });
});

describe("görsel işleme", () => {
  it("WebP varyantları üretir ve EXIF/GPS bilgisini siler", async () => {
    const input = await sharp({ create: { width: 1600, height: 1200, channels: 3, background: "#c0622a" } })
      .jpeg()
      .withExif({ IFD0: { Copyright: "Gizli", Artist: "Telefon" } })
      .toBuffer();
    assert.ok((await sharp(input).metadata()).exif);

    const img = await processImage(input, "product", "yemek.jpg");
    assert.deepEqual(
      img.variants.map((v) => v.width),
      [400, 800, 1200],
    );
    assert.match(img.id, /^[a-f0-9]{24}$/);
    assert.match(img.placeholder ?? "", /^data:image\/webp;base64,/);
    for (const v of img.variants) {
      const meta = await sharp(v.data).metadata();
      assert.equal(meta.format, "webp");
      assert.equal(meta.exif, undefined);
    }
  });

  it("çok küçük, bozuk veya desteklenmeyen dosyaları reddeder", async () => {
    const tiny = await sharp({ create: { width: 120, height: 90, channels: 3, background: "#fff" } }).png().toBuffer();
    await assert.rejects(processImage(tiny, "product"), (e) => e instanceof ImageError && /çok küçük/.test(e.message));
    await assert.rejects(processImage(Buffer.from("bu bir görsel değil"), "product"), ImageError);
    await assert.rejects(processImage(Buffer.alloc(0), "product"), ImageError);
    const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600"/></svg>`);
    await assert.rejects(processImage(svg, "product"), /desteklenmiyor/);
  });
});
