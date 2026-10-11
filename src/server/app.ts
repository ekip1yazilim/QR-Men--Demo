/**
 * Uygulama: yönlendirme tablosu, güvenlik başlıkları ve hata yönetimi.
 * `handle()` saf bir Request → Response işlevidir; testlerde doğrudan çağrılabilir.
 */
import { randomUUID } from "node:crypto";
import { config } from "./config";
import { apiError, HttpError, html, parseCookies, redirect, Router, type Ctx } from "./http/core";
import { ADMIN_PATH, requireApi, requirePage } from "./http/guards";
import * as admin from "./routes/admin";
import { adminShell } from "./routes/adminShell";
import { loginPage, loginSubmit, logout } from "./routes/auth";
import { menuPage, menuPreviewPage } from "./routes/menu";
import * as pub from "./routes/public";
import { serveStatic } from "./routes/static";
import { MENU_PATH } from "./repo/settings";

const A = `${ADMIN_PATH}/api`;

/** Derlemede sürümlenen (değişmeyen) statik klasörler */
const STATIC_PREFIXES = ["/assets/", "/fonts/", "/ikonlar/"];

export function buildRouter(): Router {
  const r = new Router();

  // Herkese açık
  r.get("/", () => redirect(MENU_PATH, 302));
  r.get(MENU_PATH, menuPage);
  r.get("/img/:id/:file", pub.imageRoute);
  r.get("/simge/:file", pub.iconRoute);
  r.get("/favicon.ico", pub.faviconRoute);
  r.get("/manifest.webmanifest", pub.manifestRoute);
  r.get("/robots.txt", pub.robotsRoute);
  r.get("/sitemap.xml", pub.sitemapRoute);
  r.post("/api/goruntulenme", pub.trackRoute);
  r.get("/saglik", pub.healthRoute);

  // Giriş / çıkış
  r.get(`${ADMIN_PATH}/giris`, loginPage);
  r.post(`${ADMIN_PATH}/giris`, loginSubmit);
  r.post(`${ADMIN_PATH}/cikis`, logout);

  // Yönetim API'si
  r.get(`${A}/ozet`, requireApi(admin.summary));

  r.get(`${A}/kategoriler`, requireApi(admin.categoriesList));
  r.post(`${A}/kategoriler`, requireApi(admin.categoryCreate));
  r.put(`${A}/kategoriler/sirala`, requireApi(admin.categoriesReorder));
  r.put(`${A}/kategoriler/:id`, requireApi(admin.categoryUpdate));
  r.patch(`${A}/kategoriler/:id`, requireApi(admin.categoryPatch));
  r.delete(`${A}/kategoriler/:id`, requireApi(admin.categoryDelete));

  r.get(`${A}/urunler`, requireApi(admin.productsList));
  r.post(`${A}/urunler`, requireApi(admin.productCreate));
  r.put(`${A}/urunler/sirala`, requireApi(admin.productsReorder));
  r.get(`${A}/urunler/:id`, requireApi(admin.productGet));
  r.put(`${A}/urunler/:id`, requireApi(admin.productUpdate));
  r.patch(`${A}/urunler/:id`, requireApi(admin.productPatch));
  r.delete(`${A}/urunler/:id`, requireApi(admin.productDelete));

  r.post(`${A}/gorseller`, requireApi(admin.imageUpload));

  r.get(`${A}/restoran`, requireApi(admin.restaurantGet));
  r.put(`${A}/restoran`, requireApi(admin.restaurantSave));
  r.get(`${A}/tasarim`, requireApi(admin.designGet));
  r.put(`${A}/tasarim`, requireApi(admin.designSave));
  r.get(`${A}/ayarlar`, requireApi(admin.settingsGet));
  r.put(`${A}/ayarlar`, requireApi(admin.settingsSave));
  r.put(`${A}/hesap`, requireApi(admin.accountSave));
  r.put(`${A}/hesap/sifre`, requireApi(admin.passwordChange));
  r.post(`${A}/oturumlar/kapat`, requireApi(admin.sessionsRevoke));

  r.get(`${A}/qr`, requireApi(admin.qrInfo));
  r.get(`${A}/qr.png`, requireApi(admin.qrPngRoute));
  r.get(`${A}/qr.svg`, requireApi(admin.qrSvgRoute));
  r.get(`${A}/yedek`, requireApi(admin.backupDownload));

  // Tasarım önizlemesi (menünün kaydedilmemiş ayarlarla görünümü)
  r.get(`${ADMIN_PATH}/onizleme`, requirePage(menuPreviewPage));

  // Yönetim paneli sayfaları (istemci tarafı yönlendirme)
  r.get(ADMIN_PATH, requirePage(adminShell));
  r.get(`${ADMIN_PATH}/*`, requirePage(adminShell));

  return r;
}

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-src 'self'",
  "frame-ancestors 'self'",
  "form-action 'self'",
  "base-uri 'none'",
  "object-src 'none'",
  "manifest-src 'self'",
].join("; ");

function securityHeaders(res: Response, ctx: Ctx) {
  const h = res.headers;
  const type = h.get("content-type") ?? "";
  if (type.startsWith("text/html")) {
    h.set("content-security-policy", CSP);
    h.set("permissions-policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  }
  h.set("x-content-type-options", "nosniff");
  h.set("referrer-policy", "strict-origin-when-cross-origin");
  h.set("x-frame-options", "SAMEORIGIN");
  h.set("cross-origin-opener-policy", "same-origin");
  if (ctx.secure) h.set("strict-transport-security", "max-age=31536000; includeSubDomains");
}

export interface RequestInfo {
  ip: string;
  /** Soket doğrudan TLS mi (genelde hayır; HTTPS ters vekilde sonlanır) */
  encrypted?: boolean;
}

function publicOrigin(req: Request, info: RequestInfo): { origin: string; secure: boolean } {
  const url = new URL(req.url);
  let proto = info.encrypted ? "https" : url.protocol.replace(":", "");
  let host = req.headers.get("host") ?? url.host;
  if (config.trustProxy) {
    const fp = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const fh = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    if (fp === "https" || fp === "http") proto = fp;
    if (fh) host = fh;
  }
  return { origin: `${proto}://${host}`, secure: proto === "https" };
}

function clientIp(req: Request, info: RequestInfo): string {
  if (config.trustProxy) {
    const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (fwd) return fwd;
    const real = req.headers.get("x-real-ip");
    if (real) return real;
  }
  return info.ip;
}

const NOT_FOUND_HTML = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sayfa bulunamadı</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#132131;color:#f5f3ef;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;text-align:center;padding:24px}a{display:inline-block;margin-top:20px;background:#f28c28;color:#1e1f23;font-weight:700;padding:12px 22px;border-radius:999px;text-decoration:none}p{color:#bac2cc}</style></head>
<body><main><h1>Aradığınız sayfa bulunamadı</h1><p>Bağlantı değişmiş ya da kaldırılmış olabilir.</p><a href="/menu">Menüye git</a></main></body></html>`;

export function createApp() {
  const router = buildRouter();

  async function handle(req: Request, info: RequestInfo): Promise<Response> {
    const url = new URL(req.url);
    const { origin, secure } = publicOrigin(req, info);
    const ctx: Ctx = {
      req,
      url,
      origin,
      secure,
      ip: clientIp(req, info),
      params: {},
      cookies: parseCookies(req.headers.get("cookie")),
      session: null,
      setCookies: [],
    };

    let res: Response;
    try {
      if ((req.method === "GET" || req.method === "HEAD") && STATIC_PREFIXES.some((p) => url.pathname.startsWith(p))) {
        res = (await serveStatic(ctx, { immutable: true })) ?? html(NOT_FOUND_HTML, 404);
        securityHeaders(res, ctx);
        return res;
      }
      // Sondaki eğik çizgiyi kaldır (/menu/ → /menu)
      if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
        return redirect(url.pathname.replace(/\/+$/, "") + url.search, 308);
      }
      const match = router.match(req.method, url.pathname);
      if (match === "405") {
        res = url.pathname.startsWith(A) ? apiError(405, "Bu işlem desteklenmiyor.") : html("İzin verilmeyen yöntem.", 405);
      } else if (!match) {
        res = url.pathname.startsWith(A) ? apiError(404, "Kaynak bulunamadı.") : html(NOT_FOUND_HTML, 404);
      } else {
        ctx.params = match.params;
        res = await match.handler(ctx);
      }
    } catch (err) {
      if (err instanceof HttpError) {
        res = apiError(err.status, err.message, err.fieldErrors);
      } else {
        const id = randomUUID().slice(0, 8);
        console.error(`[hata ${id}] ${req.method} ${url.pathname}`, err);
        res = url.pathname.startsWith(A)
          ? apiError(500, `Beklenmeyen bir hata oluştu (kod: ${id}). Lütfen tekrar deneyin.`)
          : html(`<!doctype html><meta charset="utf-8"><title>Hata</title><p style="font-family:system-ui;padding:2rem">Beklenmeyen bir hata oluştu (kod: ${id}).</p>`, 500);
      }
    }
    for (const c of ctx.setCookies) res.headers.append("set-cookie", c);
    if (req.method === "HEAD") res = new Response(null, { status: res.status, headers: res.headers });
    securityHeaders(res, ctx);
    return res;
  }

  return { handle };
}
