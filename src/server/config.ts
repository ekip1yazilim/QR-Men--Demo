import fs from "node:fs";
import path from "node:path";

// Proje kökündeki .env dosyası varsa okunur (ortamda zaten tanımlı değişkenler ezilmez)
const envFile = path.resolve(process.env.APP_ROOT ?? process.cwd(), ".env");
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

/**
 * Ortam değişkenleri (.env.example dosyasına bakın).
 * Gizli bilgiler yalnızca sunucuda okunur; istemciye hiçbir zaman gönderilmez.
 */
const env = process.env;

function bool(v: string | undefined, fallback: boolean) {
  if (v === undefined || v === "") return fallback;
  return ["1", "true", "yes", "evet", "on"].includes(v.toLowerCase());
}

const root = path.resolve(env.APP_ROOT ?? process.cwd());

export const config = {
  root,
  isProd: env.NODE_ENV === "production",
  port: Number(env.PORT ?? 3000),
  host: env.HOST ?? "0.0.0.0",
  dataDir: path.resolve(root, env.DATA_DIR ?? "data"),
  get dbFile() {
    return path.join(this.dataDir, "menu.db");
  },
  publicDir: path.join(root, "dist", "public"),
  manifestFile: path.join(root, "dist", "manifest.json"),
  /** Kalıcı menü adresi için varsayılan (yönetim panelindeki ayar önceliklidir) */
  siteUrl: (env.SITE_URL ?? "").replace(/\/+$/, ""),
  /** Nginx/Caddy gibi bir ters vekil arkasında çalışıyorsa X-Forwarded-* başlıklarına güven */
  trustProxy: bool(env.TRUST_PROXY, false),
  /** "auto": istek HTTPS ise Secure çerez kullanılır */
  cookieSecure: (env.COOKIE_SECURE ?? "auto") as "auto" | "true" | "false",
  sessionDays: Number(env.SESSION_DAYS ?? 7),
  rememberDays: Number(env.REMEMBER_DAYS ?? 30),
  maxUploadBytes: Number(env.MAX_UPLOAD_MB ?? 10) * 1024 * 1024,
};

export type Config = typeof config;
