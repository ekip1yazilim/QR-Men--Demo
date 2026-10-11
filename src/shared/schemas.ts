/**
 * Doğrulama şemaları — hem yönetim panelinde (anlık geri bildirim) hem sunucuda
 * (asıl güvence) aynı kurallar kullanılır.
 */
import { z } from "zod";
import { BADGE_KEYS, CATEGORY_ICON_KEYS } from "./catalog";
import { isHexColor } from "./color";

const trimmed = (max: number, label: string) =>
  z
    .string({ invalid_type_error: `${label} geçersiz.` })
    .transform((s) => s.trim())
    .pipe(z.string().max(max, `${label} en fazla ${max} karakter olabilir.`));

const required = (max: number, label: string) =>
  z
    .string({ required_error: `${label} zorunludur.`, invalid_type_error: `${label} geçersiz.` })
    .transform((s) => s.trim())
    .pipe(z.string().min(1, `${label} zorunludur.`).max(max, `${label} en fazla ${max} karakter olabilir.`));

const optionalUrl = (label: string) =>
  trimmed(300, label).refine((v) => v === "" || /^https?:\/\/[^\s]+\.[^\s]+/i.test(v), {
    message: `${label} https:// ile başlayan geçerli bir bağlantı olmalıdır.`,
  });

const phone = (label: string) =>
  trimmed(30, label).refine((v) => v === "" || (/^[+\d][\d\s()\-]{6,}$/.test(v) && v.replace(/\D/g, "").length >= 7), {
    message: `${label} geçerli bir telefon numarası olmalıdır (ör. +90 555 123 45 67).`,
  });

const imageId = z
  .string()
  .regex(/^[a-f0-9]{24}$/, "Görsel kimliği geçersiz.")
  .nullable();

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Saat SS:DD biçiminde olmalıdır.");

export const dayHoursSchema = z.object({ closed: z.boolean(), open: time, close: time });
export const weekHoursSchema = z.array(dayHoursSchema).length(7, "Haftanın 7 günü için saat girilmelidir.");

// ---------------------------------------------------------------------------
// Kategori
// ---------------------------------------------------------------------------
export const categoryInputSchema = z.object({
  name: required(60, "Kategori adı"),
  description: trimmed(200, "Açıklama").default(""),
  icon: z.enum(CATEGORY_ICON_KEYS, { errorMap: () => ({ message: "Geçerli bir ikon seçin." }) }),
  isActive: z.boolean().default(true),
});
export type CategoryInput = z.infer<typeof categoryInputSchema>;

export const reorderSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(1000),
});

export const categoryDeleteSchema = z.object({
  /** Kategorideki ürünler: başka kategoriye taşınır ya da silinir */
  strategy: z.enum(["move", "delete"]).default("move"),
  targetCategoryId: z.number().int().positive().nullable().default(null),
});

// ---------------------------------------------------------------------------
// Ürün
// ---------------------------------------------------------------------------
export const MAX_PRICE_CENTS = 100_000_000; // 1.000.000 ₺

export const productInputSchema = z.object({
  name: required(80, "Ürün adı"),
  description: trimmed(400, "Açıklama").default(""),
  priceCents: z
    .number({ required_error: "Fiyat zorunludur.", invalid_type_error: "Geçerli bir fiyat girin (ör. 180 veya 180,50)." })
    .int("Fiyat en fazla 2 ondalık basamak içerebilir.")
    .min(0, "Fiyat negatif olamaz.")
    .max(MAX_PRICE_CENTS, "Fiyat çok yüksek."),
  categoryId: z
    .number({ required_error: "Kategori seçin.", invalid_type_error: "Kategori seçin." })
    .int()
    .positive("Kategori seçin."),
  imageId: imageId.default(null),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  isSoldOut: z.boolean().default(false),
  badges: z.array(z.enum(BADGE_KEYS, { errorMap: () => ({ message: "Geçersiz etiket." }) })).max(BADGE_KEYS.length).default([]),
  allergens: trimmed(200, "Alerjen bilgisi").default(""),
  calories: z
    .number({ invalid_type_error: "Kalori sayı olmalıdır." })
    .int("Kalori tam sayı olmalıdır.")
    .min(0, "Kalori negatif olamaz.")
    .max(10000, "Kalori değeri çok yüksek.")
    .nullable()
    .default(null),
});
export type ProductInput = z.infer<typeof productInputSchema>;

/** Hızlı düzenleme (Menü Yönetimi ekranı) */
export const productPatchSchema = z
  .object({
    isActive: z.boolean(),
    isFeatured: z.boolean(),
    isSoldOut: z.boolean(),
    priceCents: productInputSchema.shape.priceCents,
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Değiştirilecek alan yok.");

export const productReorderSchema = z.object({
  categoryId: z.number().int().positive(),
  ids: z.array(z.number().int().positive()).min(1).max(2000),
});

// ---------------------------------------------------------------------------
// Restoran bilgileri
// ---------------------------------------------------------------------------
export const restaurantInputSchema = z.object({
  name: required(60, "Restoran adı"),
  brandLabel: trimmed(24, "Logo alt yazısı").default(""),
  heroTitle: trimmed(70, "Kapak başlığı").default(""),
  tagline: trimmed(160, "Kapak açıklaması").default(""),
  description: trimmed(500, "Hakkımızda metni").default(""),
  phone: phone("Telefon"),
  whatsapp: phone("WhatsApp numarası"),
  email: trimmed(120, "E-posta").refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v), {
    message: "Geçerli bir e-posta adresi girin.",
  }),
  address: trimmed(240, "Adres"),
  mapsUrl: optionalUrl("Harita bağlantısı"),
  instagram: trimmed(120, "Instagram").refine(
    (v) => v === "" || /^@?[a-z0-9._]{1,30}$/i.test(v) || /^https:\/\/(www\.)?instagram\.com\/[^\s]+$/i.test(v),
    { message: "Instagram kullanıcı adı (@lezzetduragi) ya da profil bağlantısı girin." },
  ),
  hours: weekHoursSchema,
  hoursNote: trimmed(140, "Çalışma saatleri notu").default(""),
  footerNote: trimmed(160, "Alt bilgi notu").default(""),
  logoImageId: imageId,
  coverImageId: imageId,
});
export type RestaurantInput = z.infer<typeof restaurantInputSchema>;

// ---------------------------------------------------------------------------
// Tasarım
// ---------------------------------------------------------------------------
export const designInputSchema = z.object({
  accentColor: z.string().refine(isHexColor, "Renk #RRGGBB biçiminde olmalıdır."),
  themeMode: z.enum(["dark", "light"]),
  fontStyle: z.enum(["klasik", "modern", "geometrik"]),
  showFeatured: z.boolean(),
  showSearch: z.boolean(),
});
export type DesignInput = z.infer<typeof designInputSchema>;

// ---------------------------------------------------------------------------
// Genel ayarlar
// ---------------------------------------------------------------------------
function isValidTimeZone(tz: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const generalInputSchema = z.object({
  siteUrl: trimmed(200, "Site adresi")
    .transform((v) => v.replace(/\/+$/, ""))
    .refine((v) => v === "" || /^https?:\/\/[a-z0-9.-]+(:\d+)?$/i.test(v), {
      message: "Site adresi yalnızca alan adını içermelidir (ör. https://lezzetduragi.com).",
    }),
  timezone: z.string().refine(isValidTimeZone, "Geçerli bir saat dilimi seçin."),
  seoTitle: trimmed(70, "Arama motoru başlığı").default(""),
  seoDescription: trimmed(170, "Arama motoru açıklaması").default(""),
  menuPublished: z.boolean(),
  unpublishedMessage: trimmed(200, "Bilgilendirme mesajı").default(""),
});
export type GeneralInput = z.infer<typeof generalInputSchema>;

// ---------------------------------------------------------------------------
// Hesap
// ---------------------------------------------------------------------------
export const PASSWORD_MIN = 10;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, "E-posta adresinizi girin.").max(120),
  password: z.string().min(1, "Şifrenizi girin.").max(200),
});

export const accountInputSchema = z.object({
  name: required(60, "Ad soyad"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(120)
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, "Geçerli bir e-posta adresi girin."),
});

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Mevcut şifrenizi girin."),
    newPassword: z
      .string()
      .min(PASSWORD_MIN, `Yeni şifre en az ${PASSWORD_MIN} karakter olmalıdır.`)
      .max(200, "Şifre çok uzun.")
      .refine((v) => /[a-zA-ZçğıöşüÇĞİÖŞÜ]/.test(v) && /\d/.test(v), "Yeni şifre en az bir harf ve bir rakam içermelidir."),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ["confirmPassword"], message: "Şifreler eşleşmiyor." });

/** zod hatalarını { alan: mesaj } nesnesine çevirir (ilk hata). */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
