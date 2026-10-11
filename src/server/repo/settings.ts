/**
 * Restoran, tasarım ve genel ayarlar. Anahtar/değer tablosunda JSON olarak tutulur;
 * okunurken varsayılanlarla birleştirilir, böylece yeni alanlar eklendiğinde eski kayıtlar bozulmaz.
 */
import { db, nowIso } from "../db";
import { DEFAULT_HOURS } from "../../shared/hours";
import { dayHoursSchema } from "../../shared/schemas";
import type { DesignSettings, GeneralSettings, RestaurantInfo, WeekHours } from "../../shared/types";
import { getImageRef } from "./images";
import { config } from "../config";

export interface StoredRestaurant extends Omit<RestaurantInfo, "logo" | "cover"> {
  logoImageId: string | null;
  coverImageId: string | null;
}

export const DEFAULT_RESTAURANT: StoredRestaurant = {
  name: "Restoranınız",
  brandLabel: "RESTAURANT",
  heroTitle: "",
  tagline: "",
  description: "",
  phone: "",
  whatsapp: "",
  email: "",
  address: "",
  mapsUrl: "",
  instagram: "",
  hours: DEFAULT_HOURS,
  hoursNote: "",
  footerNote: "Tüm fiyatlarımıza KDV dahildir.",
  logoImageId: null,
  coverImageId: null,
};

export const DEFAULT_DESIGN: DesignSettings = {
  accentColor: "#F28C28",
  themeMode: "light",
  fontStyle: "geometrik",
  showFeatured: true,
  showSearch: true,
};

export const DEFAULT_GENERAL: GeneralSettings = {
  siteUrl: "",
  timezone: "Europe/Istanbul",
  seoTitle: "",
  seoDescription: "",
  menuPublished: true,
  unpublishedMessage: "Menümüzü sizin için güncelliyoruz. Lütfen birazdan tekrar deneyin.",
};

function read<T extends object>(key: string, defaults: T): T {
  const row = db().get<{ value: string }>("SELECT value FROM settings WHERE key = ?", key);
  if (!row) return { ...defaults };
  try {
    const parsed = JSON.parse(row.value) as Partial<T>;
    const merged = { ...defaults } as T;
    for (const k of Object.keys(defaults) as (keyof T)[]) {
      if (parsed[k] !== undefined && typeof parsed[k] === typeof defaults[k]) merged[k] = parsed[k] as T[keyof T];
      else if (parsed[k] === null || (defaults[k] === null && parsed[k] !== undefined)) merged[k] = parsed[k] as T[keyof T];
    }
    return merged;
  } catch {
    return { ...defaults };
  }
}

function write(key: string, value: object) {
  db().run(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    key,
    JSON.stringify(value),
    nowIso(),
  );
}

function sanitizeHours(hours: unknown): WeekHours {
  if (!Array.isArray(hours) || hours.length !== 7) return DEFAULT_HOURS;
  return hours.map((h, i) => (dayHoursSchema.safeParse(h).success ? h : DEFAULT_HOURS[i])) as WeekHours;
}

export function getStoredRestaurant(): StoredRestaurant {
  const r = read("restaurant", DEFAULT_RESTAURANT);
  r.hours = sanitizeHours(r.hours);
  return r;
}

export function getRestaurant(): RestaurantInfo {
  const { logoImageId, coverImageId, ...rest } = getStoredRestaurant();
  return {
    ...rest,
    logo: logoImageId ? getImageRef(logoImageId) : null,
    cover: coverImageId ? getImageRef(coverImageId) : null,
  };
}

export function saveRestaurant(value: StoredRestaurant) {
  write("restaurant", value);
}

export function getDesign(): DesignSettings {
  return read("design", DEFAULT_DESIGN);
}

export function saveDesign(value: DesignSettings) {
  write("design", value);
}

export function getGeneral(): GeneralSettings {
  return read("general", DEFAULT_GENERAL);
}

export function saveGeneral(value: GeneralSettings) {
  write("general", value);
}

/**
 * Kalıcı menü bağlantısının taban adresi.
 * Öncelik: Genel Ayarlar → SITE_URL ortam değişkeni → isteğin geldiği adres.
 */
export function resolveBaseUrl(requestOrigin: string): { base: string; configured: boolean } {
  const fromSettings = getGeneral().siteUrl;
  if (fromSettings) return { base: fromSettings, configured: true };
  if (config.siteUrl) return { base: config.siteUrl, configured: true };
  return { base: requestOrigin, configured: false };
}

export const MENU_PATH = "/menu";
