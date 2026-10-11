/** Paylaşılan (istemci + sunucu) yardımcıların birim testleri */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BADGE_KEYS, categoryIconUrl, CATEGORY_ICON_KEYS, productIcon } from "../../src/shared/catalog";
import { ACCENT_TEXT_CONTRAST, accentTokens, contrastRatio, inkOn, isHexColor, MENU_BG, readableOn } from "../../src/shared/color";
import { foldTurkish, formatPrice, parsePriceInput, searchKey, slugify, telHref, whatsappHref } from "../../src/shared/format";
import { DEFAULT_HOURS, getOpenStatus, groupHours, toMinutes } from "../../src/shared/hours";
import { designInputSchema, fieldErrors, productInputSchema, restaurantInputSchema } from "../../src/shared/schemas";
import type { WeekHours } from "../../src/shared/types";

const TZ = "Europe/Istanbul";
/** İstanbul saatiyle (UTC+3) belirli bir an: 2026-10-12 Pazartesi */
const at = (day: number, hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(Date.UTC(2026, 9, 12 + day, h - 3, m));
};

describe("fiyat biçimlendirme", () => {
  it("kuruşu Türk lirası olarak yazar", () => {
    assert.equal(formatPrice(18000).replace(/\s/g, ""), "₺180,00");
    assert.equal(formatPrice(125050).replace(/\s/g, ""), "₺1.250,50");
    assert.equal(formatPrice(9000, { compact: true }).replace(/\s/g, ""), "₺90");
  });

  it("panelde yazılan fiyatları kuruşa çevirir", () => {
    assert.equal(parsePriceInput("180"), 18000);
    assert.equal(parsePriceInput("180,5"), 18050);
    assert.equal(parsePriceInput("180.50"), 18050);
    assert.equal(parsePriceInput("1.250"), 125000);
    assert.equal(parsePriceInput("1.250,00"), 125000);
    assert.equal(parsePriceInput("₺ 1 250,00"), 125000);
    assert.equal(parsePriceInput(""), null);
    assert.equal(parsePriceInput("abc"), null);
    assert.equal(parsePriceInput("-5"), null);
  });
});

describe("Türkçe metin işlemleri", () => {
  it("Türkçe karakterleri sadeleştirir ve kısa ad üretir", () => {
    assert.equal(foldTurkish("IZGARA Köfte Şiş"), "izgara kofte sis");
    assert.equal(slugify("Şefin Özel Burgeri"), "sefin-ozel-burgeri");
    assert.equal(slugify("Fırında Dana İncik"), "firinda-dana-incik");
    assert.equal(slugify("Tavuk & Pilav"), "tavuk-ve-pilav");
    assert.equal(slugify("!!!"), "urun");
  });

  it("arama anahtarı büyük/küçük harf ve aksandan bağımsızdır", () => {
    assert.equal(searchKey("  Çorba ", "SOĞAN"), "corba sogan");
  });

  it("telefon ve WhatsApp bağlantıları", () => {
    assert.equal(telHref("+90 555 123 45 67"), "tel:+905551234567");
    assert.match(whatsappHref("0555 123 45 67"), /^https:\/\/wa\.me\/905551234567/);
  });
});

describe("çalışma saatleri", () => {
  const hours: WeekHours = DEFAULT_HOURS.map((d, i) =>
    i === 4 ? { closed: false, open: "11:00", close: "02:00" } : i === 6 ? { closed: true, open: "11:00", close: "23:00" } : d,
  ) as WeekHours;

  it("açık / kapalı durumunu ve sonraki açılışı hesaplar", () => {
    assert.deepEqual(getOpenStatus(hours, at(0, "12:30"), TZ), { isOpen: true, title: "Şu an açık", detail: "Kapanış 23:00" });
    assert.deepEqual(getOpenStatus(hours, at(0, "09:00"), TZ), { isOpen: false, title: "Şu an kapalı", detail: "Açılış bugün 11:00" });
    assert.deepEqual(getOpenStatus(hours, at(0, "23:30"), TZ), { isOpen: false, title: "Şu an kapalı", detail: "Açılış yarın 11:00" });
  });

  it("gece yarısını aşan vardiyayı ve kapalı günü doğru ele alır", () => {
    // Cuma 11:00–02:00 → Cumartesi 01:30 hâlâ açık
    assert.equal(getOpenStatus(hours, at(5, "01:30"), TZ).isOpen, true);
    assert.equal(getOpenStatus(hours, at(5, "02:30"), TZ).isOpen, false);
    const sunday = getOpenStatus(hours, at(6, "12:00"), TZ);
    assert.equal(sunday.title, "Bugün kapalı");
    assert.equal(sunday.detail, "Açılış yarın 11:00");
  });

  it("aynı saatli günleri gruplar", () => {
    assert.equal(toMinutes("10:30"), 630);
    const groups = groupHours(DEFAULT_HOURS);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].days.length, 7);
  });
});

describe("vurgu rengi", () => {
  it("geçerli renk biçimini denetler", () => {
    assert.ok(isHexColor("#F28C28"));
    assert.ok(!isHexColor("F28C28"));
    assert.ok(!isHexColor("#fff"));
  });

  it("fiyat metni beyaz zeminde okunur kontrastta kalır", () => {
    const t = accentTokens("#F28C28", "light");
    assert.equal(t.accent, "#f28c28");
    assert.ok(contrastRatio(t.accentText, MENU_BG.light) >= ACCENT_TEXT_CONTRAST);
    // Çok açık bir renk de otomatik koyulaştırılır
    const pale = readableOn("#ffe9a8", MENU_BG.light, ACCENT_TEXT_CONTRAST);
    assert.ok(contrastRatio(pale, MENU_BG.light) >= ACCENT_TEXT_CONTRAST);
  });

  it("düğme yazısı için en okunur rengi seçer", () => {
    assert.equal(inkOn("#F28C28"), "#1e1f23");
    assert.equal(inkOn("#1F3B73"), "#ffffff");
  });
});

describe("katalog", () => {
  it("bilinmeyen ikon güvenli varsayılana düşer", () => {
    assert.equal(categoryIconUrl("soup"), "/ikonlar/soup.webp?v=1");
    assert.equal(categoryIconUrl("../../etc/passwd"), "/ikonlar/utensils.webp?v=1");
  });

  it("fotoğrafsız ürünlerde ürün adına uygun ikon seçer", () => {
    const icon = (name: string) => productIcon(foldTurkish(name), "cupsoda");
    assert.equal(icon("Türk Kahvesi"), "coffee");
    assert.equal(icon("Demlik Çay"), "tea");
    assert.equal(icon("Ayran"), "milk");
    assert.equal(icon("Taze Sıkma Portakal Suyu"), "citrus");
    assert.equal(icon("Maden Suyu"), "water");
    assert.equal(icon("Sucuklu Tost"), "sandwich");
    assert.equal(icon("Ev Yapımı Şerbet"), "cupsoda");
    for (const k of ["coffee", "tea", "milk", "citrus", "water", "sandwich"]) assert.ok(CATEGORY_ICON_KEYS.includes(k));
  });
});

describe("doğrulama şemaları", () => {
  const product = { name: "Izgara Köfte", priceCents: 22000, categoryId: 1 };

  it("geçerli ürünü varsayılanlarla tamamlar", () => {
    const r = productInputSchema.parse(product);
    assert.equal(r.description, "");
    assert.deepEqual(r.badges, []);
    assert.equal(r.isActive, true);
    assert.equal(r.imageId, null);
  });

  it("hatalı alanlar için Türkçe mesaj döner", () => {
    const r = productInputSchema.safeParse({ ...product, name: "  ", priceCents: -1, badges: ["bilinmeyen"] });
    assert.ok(!r.success);
    const errors = fieldErrors(r.error);
    assert.ok(errors.name);
    assert.equal(errors.priceCents, "Fiyat negatif olamaz.");
    assert.equal(errors["badges.0"], "Geçersiz etiket.");
    assert.ok(BADGE_KEYS.includes("sef"));
  });

  it("tasarım ayarlarını ve restoran bilgilerini sınırlar", () => {
    assert.ok(designInputSchema.safeParse({ accentColor: "#F28C28", themeMode: "light", fontStyle: "geometrik", showFeatured: true, showSearch: true }).success);
    assert.ok(!designInputSchema.safeParse({ accentColor: "red", themeMode: "light", fontStyle: "geometrik", showFeatured: true, showSearch: true }).success);
    const shape = restaurantInputSchema.shape;
    assert.ok(!shape.heroTitle.safeParse("x".repeat(71)).success);
    assert.equal(shape.brandLabel.parse("  RESTAURANT  "), "RESTAURANT");
  });
});
