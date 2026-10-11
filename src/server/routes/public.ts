/** Herkese açık yardımcı uç noktalar: görseller, simgeler, manifest, robots, site haritası, sayaç */
import sharp from "sharp";
import { db } from "../db";
import { apiError, bytes, json, readJson, redirect, text, type Ctx } from "../http/core";
import { MemoryRateLimiter } from "../auth/rateLimit";
import { getVariant } from "../repo/images";
import { getDesign, getGeneral, getRestaurant, getStoredRestaurant, MENU_PATH, resolveBaseUrl } from "../repo/settings";
import { recordMenuView, recordProductView } from "../repo/stats";

// ---------------------------------------------------------------------------
// Görseller: /img/:id/:genislik.webp  (ve sosyal medya önizlemeleri için .jpg)
// ---------------------------------------------------------------------------
const jpgCache = new Map<string, Buffer>();

export async function imageRoute(ctx: Ctx): Promise<Response> {
  const { id, file } = ctx.params;
  const m = /^(\d{2,4})\.(webp|jpg)$/.exec(file ?? "");
  if (!/^[a-f0-9]{24}$/.test(id ?? "") || !m) return text("Görsel bulunamadı.", 404);
  const width = Number(m[1]);
  const format = m[2];
  const etag = `"${id}-${width}-${format}"`;
  const headers = {
    "cache-control": "public, max-age=31536000, immutable",
    etag,
    "content-type": format === "jpg" ? "image/jpeg" : "image/webp",
  };
  if (ctx.req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });

  const variant = getVariant(id, width);
  if (!variant) return text("Görsel bulunamadı.", 404);
  if (format === "webp") return new Response(bytes(variant.data), { headers });

  const key = `${id}:${width}`;
  let jpg = jpgCache.get(key);
  if (!jpg) {
    jpg = await sharp(Buffer.from(variant.data)).flatten({ background: "#ffffff" }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    jpgCache.set(key, jpg);
    if (jpgCache.size > 60) jpgCache.delete(jpgCache.keys().next().value!);
  }
  return new Response(bytes(jpg), { headers });
}

// ---------------------------------------------------------------------------
// Uygulama simgeleri: /simge/:boyut.png (logodan ya da varsayılan işaretten)
// ---------------------------------------------------------------------------
const ICON_SIZES = new Set([32, 64, 180, 192, 512]);
const iconCache = new Map<string, Buffer>();

function defaultMarkSvg(size: number, accent: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 48 48">
    <rect width="48" height="48" rx="10" fill="#132131"/>
    <g transform="translate(9.6 7.2) scale(0.6)">
      <path d="M24 4c1.6 6.2-1.8 9.4-4.6 12.6C16.6 19.8 14 23 14 28.2 14 34.6 18.6 40 24 40s10-5.4 10-11.8c0-4-1.8-6.8-3.6-9.2-.5 2.6-1.9 4.6-4 5.6.9-6.4-.6-14.6-2.4-20.6Z" fill="${accent}"/>
      <path d="M24 40c-2.9 0-5.2-2.6-5.2-5.8 0-3.6 2.7-5.4 4.3-8.2.9 2.3 3.1 3.6 3.6 6.4.2-1 .2-2 .1-3 1.6 1.4 2.4 3.1 2.4 4.8 0 3.2-2.3 5.8-5.2 5.8Z" fill="#ffd3a6"/>
      <rect x="9" y="42" width="30" height="2.6" rx="1.3" fill="${accent}" opacity=".55"/>
    </g></svg>`;
}

export async function iconRoute(ctx: Ctx): Promise<Response> {
  const size = Number((ctx.params.file ?? "").replace(/\.png$/, ""));
  if (!ICON_SIZES.has(size)) return text("Bulunamadı.", 404);
  const stored = getStoredRestaurant();
  const accent = getDesign().accentColor;
  const key = `${stored.logoImageId ?? "varsayilan"}:${accent}:${size}`;
  let png = iconCache.get(key);
  if (!png) {
    if (stored.logoImageId) {
      const variant = getVariant(stored.logoImageId, size);
      const inner = Math.round(size * 0.8);
      const logo = variant
        ? await sharp(Buffer.from(variant.data)).resize(inner, inner, { fit: "contain", background: "#ffffff00" }).png().toBuffer()
        : null;
      png = await sharp({ create: { width: size, height: size, channels: 4, background: "#ffffff" } })
        .composite(logo ? [{ input: logo, gravity: "center" }] : [])
        .png()
        .toBuffer();
    } else {
      png = await sharp(Buffer.from(defaultMarkSvg(size, accent))).png().toBuffer();
    }
    iconCache.set(key, png);
    if (iconCache.size > 40) iconCache.delete(iconCache.keys().next().value!);
  }
  return new Response(bytes(png), { headers: { "content-type": "image/png", "cache-control": "public, max-age=86400" } });
}

export function faviconRoute(): Response {
  return redirect("/simge/64.png", 302);
}

// ---------------------------------------------------------------------------
// Manifest, robots.txt, sitemap.xml
// ---------------------------------------------------------------------------
export function manifestRoute(): Response {
  const r = getRestaurant();
  const mode = getDesign().themeMode;
  const color = mode === "light" ? "#ffffff" : "#1b1c1f";
  return new Response(
    JSON.stringify({
      name: `${r.name} Menü`,
      short_name: r.name.slice(0, 12),
      lang: "tr",
      start_url: MENU_PATH,
      scope: "/",
      display: "browser",
      background_color: color,
      theme_color: "#132131",
      icons: [
        { src: "/simge/192.png", sizes: "192x192", type: "image/png" },
        { src: "/simge/512.png", sizes: "512x512", type: "image/png" },
      ],
    }),
    { headers: { "content-type": "application/manifest+json; charset=utf-8", "cache-control": "public, max-age=3600" } },
  );
}

export function robotsRoute(ctx: Ctx): Response {
  const { base } = resolveBaseUrl(ctx.origin);
  return text(`User-agent: *\nAllow: /\nDisallow: /yonetim\nDisallow: /api/\n\nSitemap: ${base}/sitemap.xml\n`, 200, {
    "cache-control": "public, max-age=3600",
  });
}

export function sitemapRoute(ctx: Ctx): Response {
  const { base } = resolveBaseUrl(ctx.origin);
  const lastmod =
    db().get<{ v: string | null }>(
      "SELECT max(v) AS v FROM (SELECT max(updated_at) AS v FROM products UNION ALL SELECT max(updated_at) FROM categories UNION ALL SELECT max(updated_at) FROM settings)",
    )?.v ?? new Date().toISOString();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${base}${MENU_PATH}</loc><lastmod>${lastmod.slice(0, 10)}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>
</urlset>
`;
  return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" } });
}

// ---------------------------------------------------------------------------
// Anonim görüntülenme sayacı
// ---------------------------------------------------------------------------
const trackLimiter = new MemoryRateLimiter(60, 60_000);
const BOT_UA = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|preview|headless|lighthouse/i;

export async function trackRoute(ctx: Ctx): Promise<Response> {
  const ua = ctx.req.headers.get("user-agent") ?? "";
  if (BOT_UA.test(ua) || !trackLimiter.allow(ctx.ip)) return new Response(null, { status: 204 });
  let body: { tur?: string; id?: unknown };
  try {
    body = await readJson(ctx.req, 1024);
  } catch {
    return apiError(400, "Geçersiz istek.");
  }
  const tz = getGeneral().timezone;
  if (body.tur === "menu") recordMenuView(tz);
  else if (body.tur === "urun" && typeof body.id === "number" && Number.isInteger(body.id)) recordProductView(body.id, tz);
  return new Response(null, { status: 204 });
}

export function healthRoute(): Response {
  db().get("SELECT 1");
  return json({ durum: "ok", zaman: new Date().toISOString() });
}
