/** Biçimlendirme yardımcıları — Türkçe yerel ayarlarla. */

const priceFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const priceFormatterWhole = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** 18000 → "₺180,00"; tam sayılarda kısa biçim için `compact` */
export function formatPrice(cents: number, opts: { compact?: boolean } = {}): string {
  const value = cents / 100;
  if (opts.compact && Number.isInteger(value)) return priceFormatterWhole.format(value);
  return priceFormatter.format(value);
}

/** Yönetim panelindeki fiyat alanı için: 18050 → "180,50" */
export function centsToInput(cents: number): string {
  return (cents / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });
}

/**
 * Kullanıcının yazdığı fiyatı kuruşa çevirir. Kabul edilen biçimler:
 * "180", "180,5", "180,50", "180.50", "1.250", "1.250,00", "₺ 1 250,00"
 * Geçersizse null döner.
 */
export function parsePriceInput(raw: string): number | null {
  let s = String(raw ?? "")
    .replace(/[₺\s ]/g, "")
    .replace(/TL$/i, "")
    .trim();
  if (!s) return null;
  if (!/^[0-9.,]+$/.test(s)) return null;

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    // Hangisi sonda ise ondalık ayırıcıdır
    if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (lastComma >= 0) {
    if ((s.match(/,/g) ?? []).length > 1) return null;
    s = s.replace(",", ".");
  } else if (lastDot >= 0) {
    const dots = (s.match(/\./g) ?? []).length;
    const decimals = s.length - lastDot - 1;
    // "1.250" ve "12.500.000" binlik ayırıcı; "180.5" / "180.50" ondalık
    if (dots > 1 || decimals === 3) {
      if (!/^\d{1,3}(\.\d{3})+$/.test(s)) return null;
      s = s.replace(/\./g, "");
    }
  }
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  const cents = Number(whole) * 100 + Number((frac + "00").slice(0, 2));
  return Number.isSafeInteger(cents) ? cents : null;
}

const TR_MAP: Record<string, string> = { ç: "c", ğ: "g", ı: "i", i: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" };

/** Türkçe karakterleri sadeleştirip küçük harfe çevirir: "Izgara Köfte" → "izgara kofte" */
export function foldTurkish(input: string): string {
  return input
    .toLocaleLowerCase("tr-TR")
    .replace(/[çğıöşüâîû]/g, (ch) => TR_MAP[ch] ?? ch)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "");
}

/** URL dostu kısa ad: "Şefin Özel Burgeri" → "sefin-ozel-burgeri" */
export function slugify(input: string): string {
  const slug = foldTurkish(input)
    .replace(/&/g, " ve ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72)
    .replace(/-+$/g, "");
  return slug || "urun";
}

/** Arama için normalize edilmiş metin */
export function searchKey(...parts: string[]): string {
  return foldTurkish(parts.join(" ")).replace(/\s+/g, " ").trim();
}

const relativeFormatter = new Intl.RelativeTimeFormat("tr-TR", { numeric: "auto" });

/** "3 dakika önce", "dün" gibi göreli zaman */
export function formatRelative(iso: string, now: number = Date.now()): string {
  const diff = (new Date(iso).getTime() - now) / 1000;
  const abs = Math.abs(diff);
  if (abs < 45) return "az önce";
  if (abs < 3600) return relativeFormatter.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return relativeFormatter.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 7) return relativeFormatter.format(Math.round(diff / 86400), "day");
  return formatDate(iso);
}

export function formatDate(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone }).format(new Date(iso));
}

export function formatDateTime(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date(iso));
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("tr-TR").format(n);
}

/** Telefonu tıklanabilir bağlantı için sadeleştirir: "+90 (555) 123 45 67" → "+905551234567" */
export function telHref(phone: string): string {
  return "tel:" + phone.replace(/[^\d+]/g, "");
}

/** WhatsApp numarasını wa.me bağlantısına çevirir (Türkiye için başında 0 olan numaraları düzeltir). */
export function whatsappHref(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = "90" + digits.slice(1);
  if (digits.length === 10 && digits.startsWith("5")) digits = "90" + digits;
  return `https://wa.me/${digits}`;
}

/** Instagram kullanıcı adı veya bağlantısından profil URL'si üretir. */
export function instagramHref(value: string): string {
  const v = value.trim();
  if (/^https?:\/\//i.test(v)) return v;
  return `https://www.instagram.com/${v.replace(/^@/, "")}/`;
}

export function instagramHandle(value: string): string {
  const v = value.trim();
  const m = v.match(/instagram\.com\/([^/?#]+)/i);
  return "@" + (m ? m[1] : v.replace(/^@/, ""));
}
