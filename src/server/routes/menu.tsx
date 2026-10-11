/**
 * Müşteri menüsü: sunucuda React ile işlenir (SSR), tarayıcıda hydrate edilir.
 * QR okutulduğunda doğrudan bu sayfa açılır. Sipariş/sepet akışı yoktur.
 *
 * Sorgu parametreleri:
 *   ?urun=<kısa-ad>       ürün detayını açık getirir (paylaşılabilir bağlantı)
 *   ?kategori=<kısa-ad>   ilgili kategori sekmesini seçili getirir
 *
 * Tasarım önizlemesi /yonetim/onizleme adresindedir (oturum gerektirir; oturum çerezi
 * yalnızca /yonetim yolunda gönderildiği için önizleme de bu yolun altında sunulur).
 */
import { renderToString } from "react-dom/server";
import { MenuApp, MenuUnavailable, resolveView, type MenuAppProps } from "../../client/menu/MenuApp";
import { accentStyle } from "../../shared/color";
import { designInputSchema } from "../../shared/schemas";
import type { DesignSettings, FontStyle, ImageRef, PublicMenu } from "../../shared/types";
import { escapeHtml, html, type Ctx } from "../http/core";
import { renderDocument } from "../render/document";
import { getGeneral, MENU_PATH } from "../repo/settings";
import { buildPublicMenu } from "../services/menu";

/** Yazı tipi seçimine göre ekranın üst kısmında hemen gereken dosyalar */
const FONT_PRELOADS: Record<FontStyle, string[]> = {
  geometrik: ["/fonts/poppins-latin-400-v1.woff2", "/fonts/poppins-latin-600-v1.woff2", "/fonts/poppins-latin-700-v1.woff2"],
  klasik: ["/fonts/fraunces-latin-v1.woff2", "/fonts/poppins-latin-400-v1.woff2"],
  modern: ["/fonts/manrope-latin-v1.woff2"],
};

/** Önizleme isteğindeki tasarım değerleri (geçersizse yok sayılır) */
function previewDesign(q: URLSearchParams): Partial<DesignSettings> {
  const candidate = {
    accentColor: q.get("renk") ?? "",
    themeMode: q.get("mod") ?? "",
    fontStyle: q.get("yazi") ?? "",
    showFeatured: q.get("onecikan") !== "0",
    showSearch: q.get("arama") !== "0",
  };
  const out: Partial<DesignSettings> = {};
  const shape = designInputSchema.shape;
  if (shape.accentColor.safeParse(candidate.accentColor).success) out.accentColor = candidate.accentColor.toUpperCase();
  const mode = shape.themeMode.safeParse(candidate.themeMode);
  if (mode.success) out.themeMode = mode.data;
  const font = shape.fontStyle.safeParse(candidate.fontStyle);
  if (font.success) out.fontStyle = font.data;
  if (q.has("onecikan")) out.showFeatured = candidate.showFeatured;
  if (q.has("arama")) out.showSearch = candidate.showSearch;
  return out;
}

/** Sosyal medya önizlemesi için en uygun JPEG varyantı */
function ogImage(base: string, image: ImageRef | null): string {
  if (!image || image.widths.length === 0) return `${base}/simge/512.png`;
  const fit = [...image.widths].filter((w) => w <= 1200).pop() ?? image.widths[0];
  return `${base}/img/${image.id}/${fit}.jpg`;
}

function metaTags(o: { title: string; description: string; url: string; image: string; noindex: boolean }): string {
  const e = escapeHtml;
  return [
    `<meta name="description" content="${e(o.description)}">`,
    o.noindex ? `<meta name="robots" content="noindex, nofollow">` : `<link rel="canonical" href="${e(o.url)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:locale" content="tr_TR">`,
    `<meta property="og:title" content="${e(o.title)}">`,
    `<meta property="og:description" content="${e(o.description)}">`,
    `<meta property="og:url" content="${e(o.url)}">`,
    `<meta property="og:image" content="${e(o.image)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<link rel="icon" type="image/png" sizes="32x32" href="/simge/32.png">`,
    `<link rel="icon" type="image/png" sizes="64x64" href="/simge/64.png">`,
    `<link rel="apple-touch-icon" href="/simge/180.png">`,
    `<link rel="manifest" href="/manifest.webmanifest">`,
  ].join("\n");
}

function bodyAttrs(data: PublicMenu): Record<string, string> {
  return {
    "data-surface": "menu",
    "data-mode": data.design.themeMode,
    "data-font": data.design.fontStyle,
    style: accentStyle(data.design.accentColor, data.design.themeMode),
  };
}

/** Herkese açık menü (QR kodun açtığı sayfa) */
export function menuPage(ctx: Ctx): Response {
  return renderMenu(ctx, false);
}

/** Yönetim → Tasarım Ayarları canlı önizlemesi (requirePage ile korunur, kaydetmeden gösterir) */
export function menuPreviewPage(ctx: Ctx): Response {
  return renderMenu(ctx, true);
}

function renderMenu(ctx: Ctx, isAdmin: boolean): Response {
  const q = ctx.url.searchParams;
  const data = buildPublicMenu(ctx.origin, isAdmin ? { preview: true, design: previewDesign(q) } : {});
  const general = getGeneral();
  const r = data.restaurant;
  const base = data.menuUrl.slice(0, -MENU_PATH.length);
  const headers = { "cache-control": isAdmin ? "no-store" : "no-cache" };

  if (!general.menuPublished && !isAdmin) {
    const body = renderToString(<MenuUnavailable data={data} message={general.unpublishedMessage} />);
    return html(
      renderDocument({
        title: `${r.name} | Menü`,
        head: `<meta name="robots" content="noindex">\n<link rel="icon" type="image/png" href="/simge/64.png">`,
        bodyAttrs: bodyAttrs(data),
        body,
        entry: null,
        themeColor: "#132131",
        fonts: FONT_PRELOADS[data.design.fontStyle],
      }),
      503,
      { ...headers, "retry-after": "600" },
    );
  }

  const slug = q.get("urun");
  let product = null as PublicMenu["categories"][number]["products"][number] | null;
  if (slug) {
    for (const c of data.categories) {
      product = c.products.find((p) => p.slug === slug) ?? null;
      if (product) break;
    }
  }

  const props: MenuAppProps = {
    data,
    initialSlug: product ? product.slug : null,
    missingProduct: !!slug && !product,
    initialView: resolveView(q.get("kategori"), data),
  };
  const body = renderToString(<MenuApp {...props} />);

  const baseTitle = general.seoTitle || `${r.name} | Dijital Menü`;
  const baseDescription =
    general.seoDescription || r.tagline || r.description.split("\n")[0] || `${r.name} menüsü: güncel ürünler, fiyatlar, içerik ve alerjen bilgileri.`;
  const title = product ? `${product.name} | ${r.name}` : baseTitle;
  const description = product ? product.description || baseDescription : baseDescription;
  const url = product ? `${data.menuUrl}?urun=${encodeURIComponent(product.slug)}` : data.menuUrl;

  return html(
    renderDocument({
      title,
      head: metaTags({
        title,
        description: description.slice(0, 200),
        url,
        image: ogImage(base, product?.image ?? r.cover),
        noindex: data.preview,
      }),
      bodyAttrs: bodyAttrs(data),
      body,
      data: { "menu-veri": props },
      entry: "menu",
      themeColor: "#132131",
      fonts: FONT_PRELOADS[data.design.fontStyle],
    }),
    200,
    headers,
  );
}
