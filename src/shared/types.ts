/** Uygulama genelinde paylaşılan veri tipleri (sunucu + istemci). */

export type ThemeMode = "dark" | "light";
export type FontStyle = "klasik" | "modern" | "geometrik";
export type BadgeKey = "yeni" | "sef" | "aci" | "vejetaryen" | "vegan" | "glutensiz";
export type ImageKind = "product" | "cover" | "logo";

/** Lisanslı (ör. Wikimedia Commons) fotoğraflar için kaynak bilgisi; restoranın kendi yüklediği görsellerde boştur. */
export interface ImageCredit {
  author: string;
  license: string;
  licenseUrl: string;
  sourceUrl: string;
}

export interface ImageRef {
  id: string;
  width: number;
  height: number;
  /** Mevcut genişlik varyantları (px) */
  widths: number[];
  /** Bulanık önizleme (data URL) */
  placeholder: string | null;
  credit: ImageCredit | null;
}

/** Saatler "HH:MM" biçimindedir. Kapanış açılıştan küçükse gece yarısını geçer (ör. 11:00–01:00). */
export interface DayHours {
  closed: boolean;
  open: string;
  close: string;
}
/** 7 eleman: Pazartesi (0) … Pazar (6) */
export type WeekHours = DayHours[];

export interface RestaurantInfo {
  name: string;
  /** Logonun altındaki küçük yazı (ör. "RESTAURANT", "OCAKBAŞI") */
  brandLabel: string;
  /** Kapak fotoğrafının üzerindeki büyük başlık */
  heroTitle: string;
  /** Kapak başlığının altındaki kısa açıklama */
  tagline: string;
  description: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  mapsUrl: string;
  instagram: string;
  hours: WeekHours;
  hoursNote: string;
  /** Menünün altında görünen not (ör. "Tüm fiyatlarımıza KDV dahildir.") */
  footerNote: string;
  logo: ImageRef | null;
  cover: ImageRef | null;
}

export interface DesignSettings {
  accentColor: string;
  themeMode: ThemeMode;
  fontStyle: FontStyle;
  showFeatured: boolean;
  showSearch: boolean;
}

export interface GeneralSettings {
  siteUrl: string;
  timezone: string;
  seoTitle: string;
  seoDescription: string;
  menuPublished: boolean;
  unpublishedMessage: string;
  /** Menüdeki "Gizlilik ve çerezler" metni; boşsa varsayılan metin gösterilir */
  privacyNotice: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string;
  icon: string;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
  activeProductCount: number;
}

export interface Product {
  id: number;
  categoryId: number;
  name: string;
  slug: string;
  description: string;
  priceCents: number;
  image: ImageRef | null;
  isActive: boolean;
  isFeatured: boolean;
  isSoldOut: boolean;
  badges: BadgeKey[];
  allergens: string;
  calories: number | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface PublicProduct {
  id: number;
  categoryId: number;
  name: string;
  slug: string;
  description: string;
  priceCents: number;
  image: ImageRef | null;
  isFeatured: boolean;
  isSoldOut: boolean;
  badges: BadgeKey[];
  allergens: string;
  calories: number | null;
}

export interface PublicCategory {
  id: number;
  name: string;
  slug: string;
  description: string;
  icon: string;
  products: PublicProduct[];
}

export interface PublicMenu {
  restaurant: RestaurantInfo;
  design: DesignSettings;
  categories: PublicCategory[];
  featured: PublicProduct[];
  timezone: string;
  menuUrl: string;
  /** Sunucunun sayfayı ürettiği an (ISO). Hydration sırasında açık/kapalı durumu tutarlı kalsın diye. */
  generatedAt: string;
  /** Yönetim panelindeki canlı önizleme */
  preview: boolean;
  /** Gizlilik ve çerez bilgisi (özel metin ya da varsayılan) */
  privacyNotice: string;
}

export interface ActivityItem {
  id: number;
  action: string;
  entity: string;
  entityId: string | null;
  summary: string;
  userName: string | null;
  createdAt: string;
}

export interface DashboardSummary {
  totals: {
    products: number;
    activeProducts: number;
    inactiveProducts: number;
    soldOutProducts: number;
    featuredProducts: number;
    categories: number;
    activeCategories: number;
    productsWithoutImage: number;
  };
  views: { day: string; views: number }[];
  viewsTotal: number;
  topProducts: { id: number; name: string; views: number }[];
  activity: ActivityItem[];
  menuUrl: string;
  menuPublished: boolean;
  siteUrlConfigured: boolean;
}

export interface SessionUser {
  id: number;
  name: string;
  email: string;
}

export interface AdminBoot {
  user: SessionUser;
  csrf: string;
  restaurantName: string;
  logo: ImageRef | null;
  menuUrl: string;
}

export interface ApiErrorBody {
  error: string;
  fieldErrors?: Record<string, string>;
}
