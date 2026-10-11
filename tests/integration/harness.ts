/**
 * Entegrasyon testi düzeneği: geçici bir klasörde boş veritabanıyla uygulamayı açar ve
 * istekleri doğrudan `app.handle()` üzerinden gönderir (gerçek HTTP sunucusu gerekmez).
 * Ortam değişkenleri, yapılandırma modülü yüklenmeden ÖNCE ayarlanmalıdır; bu yüzden
 * uygulama modülleri dinamik olarak içe aktarılır.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "dijital-menu-test-"));
const repo = path.resolve(import.meta.dirname, "../..");

// Derleme çıktısı yerine küçük bir varlık listesi (SSR yalnızca dosya adlarına ihtiyaç duyar)
fs.mkdirSync(path.join(ROOT, "dist", "public", "ikonlar"), { recursive: true });
fs.writeFileSync(
  path.join(ROOT, "dist", "manifest.json"),
  JSON.stringify({
    css: "/assets/app-test.css",
    entries: Object.fromEntries(["menu", "admin", "login"].map((e) => [e, { js: `/assets/${e}-test.js`, preload: [] }])),
  }),
);
fs.copyFileSync(path.join(repo, "public", "ikonlar", "soup.webp"), path.join(ROOT, "dist", "public", "ikonlar", "soup.webp"));

Object.assign(process.env, {
  APP_ROOT: ROOT,
  DATA_DIR: path.join(ROOT, "data"),
  NODE_ENV: "test",
  SITE_URL: "",
  TRUST_PROXY: "false",
  COOKIE_SECURE: "auto",
});

const { config } = await import("../../src/server/config");
const { openDb } = await import("../../src/server/db");
openDb(config.dbFile);
const { createApp } = await import("../../src/server/app");
const { hashPassword } = await import("../../src/server/auth/password");
const { createUser } = await import("../../src/server/repo/users");

export const app = createApp();
export const ORIGIN = "http://menu.test";
export const ADMIN = { email: "yonetici@ornek.com", password: "TestSifresi2026!" };
createUser(ADMIN.email, "Test Yöneticisi", await hashPassword(ADMIN.password));

export interface Sent {
  status: number;
  headers: Headers;
  text: string;
  bytes: Buffer;
  json: <T = any>() => T;
}

/** Çerezleri saklayan basit tarayıcı benzeri istemci */
export class Client {
  cookies = new Map<string, string>();
  csrf = "";
  constructor(public ip = "203.0.113.10") {}

  async send(
    method: string,
    url: string,
    opts: { json?: unknown; form?: Record<string, string>; body?: BodyInit; headers?: Record<string, string>; origin?: string | null } = {},
  ): Promise<Sent> {
    const headers = new Headers(opts.headers);
    if (this.cookies.size) headers.set("cookie", [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "));
    if (method !== "GET" && method !== "HEAD" && opts.origin !== null) headers.set("origin", opts.origin ?? ORIGIN);
    if (this.csrf && !["GET", "HEAD"].includes(method)) headers.set("x-csrf-token", this.csrf);
    let body = opts.body;
    if (opts.json !== undefined) {
      body = JSON.stringify(opts.json);
      headers.set("content-type", "application/json");
    } else if (opts.form) {
      body = new URLSearchParams(opts.form).toString();
      headers.set("content-type", "application/x-www-form-urlencoded");
    }
    if (typeof body === "string" && !headers.has("content-length")) headers.set("content-length", String(Buffer.byteLength(body)));
    const res = await app.handle(new Request(ORIGIN + url, { method, headers, body }), { ip: this.ip });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      const name = pair.slice(0, i);
      const value = pair.slice(i + 1);
      if (!value || /max-age=0/i.test(c)) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    const bytes = Buffer.from(await res.arrayBuffer());
    const text = bytes.toString("utf8");
    return { status: res.status, headers: res.headers, text, bytes, json: () => JSON.parse(text) };
  }

  get(url: string) {
    return this.send("GET", url);
  }

  /** Giriş yapar ve CSRF belirtecini panel kabuğundan okur */
  async login(email = ADMIN.email, password = ADMIN.password) {
    const res = await this.send("POST", "/yonetim/giris", { form: { email, password, sonra: "/yonetim" } });
    if (res.status !== 303) return res;
    const shell = await this.get("/yonetim");
    this.csrf = embedded<{ csrf: string }>(shell.text, "yonetim-veri").csrf;
    return res;
  }
}

/** SSR sayfasına gömülü <script type="application/json" id="..."> verisini okur */
export function embedded<T = any>(html: string, id: string): T {
  const m = new RegExp(`<script type="application/json" id="${id}">([\\s\\S]*?)</script>`).exec(html);
  if (!m) throw new Error(`Gömülü veri bulunamadı: ${id}`);
  return JSON.parse(m[1]) as T;
}

/** Çok parçalı (multipart) görsel yükleme gövdesi; content-length ile birlikte */
export async function multipart(file: Buffer, name: string, type: string): Promise<{ body: Uint8Array<ArrayBuffer>; headers: Record<string, string> }> {
  const form = new FormData();
  form.append("dosya", new Blob([new Uint8Array(file)], { type }), name);
  const req = new Request("http://x", { method: "POST", body: form });
  const body = new Uint8Array(await req.arrayBuffer());
  return { body, headers: { "content-type": req.headers.get("content-type")!, "content-length": String(body.length) } };
}
