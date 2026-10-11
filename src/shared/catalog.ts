import type { BadgeKey } from "./types";

/** Ürün etiketleri: menüde küçük rozetler olarak görünür. */
export const BADGES: { key: BadgeKey; label: string; description: string }[] = [
  { key: "yeni", label: "Yeni", description: "Menüye yeni eklenen ürün" },
  { key: "sef", label: "Şefin önerisi", description: "Şefin öne çıkardığı tarif" },
  { key: "aci", label: "Acılı", description: "Acı biber içerir" },
  { key: "vejetaryen", label: "Vejetaryen", description: "Et ve balık içermez" },
  { key: "vegan", label: "Vegan", description: "Hayvansal ürün içermez" },
  { key: "glutensiz", label: "Glutensiz", description: "Gluten içermez" },
];
export const BADGE_KEYS = BADGES.map((b) => b.key) as [BadgeKey, ...BadgeKey[]];
export const BADGE_LABEL: Record<BadgeKey, string> = Object.fromEntries(BADGES.map((b) => [b.key, b.label])) as Record<
  BadgeKey,
  string
>;

/**
 * Kategori ikonları (anahtar → görünen ad). Renkli görseller public/ikonlar/<anahtar>.webp
 * dosyalarındadır (Microsoft Fluent Emoji, MIT lisansı).
 */
export const CATEGORY_ICONS: { key: string; label: string }[] = [
  { key: "utensils", label: "Tabak ve çatal bıçak" },
  { key: "pan", label: "Ana yemek" },
  { key: "chef", label: "Şefin seçimi" },
  { key: "flame", label: "Ateş / ocakbaşı" },
  { key: "beef", label: "Et / ızgara" },
  { key: "drumstick", label: "Tavuk" },
  { key: "fish", label: "Balık" },
  { key: "ham", label: "Kasap ürünleri" },
  { key: "sandwich", label: "Burger" },
  { key: "pizza", label: "Pizza / pide" },
  { key: "pasta", label: "Makarna" },
  { key: "soup", label: "Çorba / başlangıç" },
  { key: "salad", label: "Salata" },
  { key: "leaf", label: "Yeşillik" },
  { key: "fries", label: "Atıştırmalık" },
  { key: "egg", label: "Kahvaltı" },
  { key: "croissant", label: "Fırın" },
  { key: "wheat", label: "Ekmek / hamur işi" },
  { key: "cake", label: "Pasta" },
  { key: "dessert", label: "Tatlı" },
  { key: "icecream", label: "Dondurma" },
  { key: "cookie", label: "Kurabiye" },
  { key: "cherry", label: "Meyve" },
  { key: "coffee", label: "Kahve" },
  { key: "tea", label: "Çay" },
  { key: "cupsoda", label: "Soğuk içecek" },
  { key: "water", label: "Su" },
  { key: "milk", label: "Süt / ayran" },
  { key: "citrus", label: "Taze sıkma" },
  { key: "wine", label: "Şarap" },
  { key: "beer", label: "Bira" },
  { key: "sparkles", label: "Özel" },
];
export const CATEGORY_ICON_KEYS = CATEGORY_ICONS.map((c) => c.key) as [string, ...string[]];

/** Statik ikon dosyalarının sürümü (dosyalar değişirse artırın; tarayıcı önbelleğini yeniler) */
export const ICON_VERSION = 1;
export function categoryIconUrl(key: string): string {
  const k = CATEGORY_ICON_KEYS.includes(key) ? key : "utensils";
  return `/ikonlar/${k}.webp?v=${ICON_VERSION}`;
}

/**
 * Fotoğrafı olmayan ürünlerde kategori ikonu yerine ürün adına uygun ikon seçer
 * (ör. "Türk Kahvesi" → kahve, "Ayran" → süt). Eşleşme yoksa kategori ikonu kullanılır.
 * Metin Türkçe karakterlerden arındırılmış ve küçük harfli olmalıdır.
 */
const PRODUCT_ICON_HINTS: [RegExp, string][] = [
  [/\b(kahve|espresso|latte|cappuccino|americano|mocha|macchiato|filtre)/, "coffee"],
  [/\b(cay|bitki cayi|ihlamur|adacayi|kusburnu)\b/, "tea"],
  [/\b(ayran|sut|milkshake|kefir|salep)\b/, "milk"],
  [/\b(portakal|limonata|meyve suyu|nar suyu|greyfurt|mandalina)/, "citrus"],
  [/\b(maden suyu|soda|su)\b/, "water"],
  [/\b(kola|gazoz|ice tea|soguk cay|meyveli soda|enerji)/, "cupsoda"],
  [/\b(sarap)/, "wine"],
  [/\b(bira)\b/, "beer"],
  [/\b(dondurma)/, "icecream"],
  [/\b(pasta|cheesecake|kek|tiramisu|brownie)\b/, "cake"],
  [/\b(kurabiye|cookie)/, "cookie"],
  [/\b(kunefe|baklava|sutlac|kazandibi|tatli|puding|profiterol)/, "dessert"],
  [/\b(corba)/, "soup"],
  [/\b(salata)/, "salad"],
  [/\b(pizza|pide|lahmacun)/, "pizza"],
  [/\b(burger|sandvic|tost|wrap)\b/, "sandwich"],
  [/\b(makarna|spagetti|penne|eriste|manti|lazanya)/, "pasta"],
  [/\b(tavuk|kanat|pilic)/, "drumstick"],
  [/\b(balik|levrek|cupra|somon|hamsi|karides|kalamar)/, "fish"],
  [/\b(patates|cips|sogan halkasi)/, "fries"],
  [/\b(yumurta|omlet|menemen|kahvalti)/, "egg"],
  [/\b(kofte|kebap|kebabi|biftek|bonfile|antrikot|pirzola|kuzu|dana)\b/, "beef"],
];

export function productIcon(foldedName: string, fallback: string): string {
  for (const [re, key] of PRODUCT_ICON_HINTS) if (re.test(foldedName)) return key;
  return fallback;
}
