/**
 * Tek dosyalık HTML önizleme
 *
 * Çalışan sunucudaki müşteri menüsünü; verileri, CSS'i, JavaScript'i, fotoğrafları, ikonları ve
 * yazı tiplerini içine gömerek internet bağlantısı gerektirmeyen tek bir .html dosyasına dönüştürür.
 * Dosya, gerçek menü kodunun aynısıyla çalışır (kategori sekmeleri, arama, filtre, ürün detayı).
 * İnceleme/sunum içindir; canlı menü her zaman sunucudan açılır.
 *
 * Kullanım (sunucu açıkken):
 *   npm run onizleme
 *   npm run onizleme -- --adres http://localhost:3000 --koyu --cikti dist/menu-koyu.html
 */
import * as esbuild from "esbuild";
import fs from "node:fs/promises";
import path from "node:path";
import { accentStyle } from "../src/shared/color";
import type { ImageRef, PublicMenu } from "../src/shared/types";

const ROOT = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const arg = (name: string, fallback: string) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const base = arg("--adres", "http://localhost:3000").replace(/\/+$/, "");
const dark = args.includes("--koyu");
const out = path.resolve(arg("--cikti", path.join("dist", dark ? "menu-onizleme-koyu.html" : "menu-onizleme.html")));

async function get(url: string): Promise<Response> {
  const res = await fetch(base + url).catch((err) => {
    throw new Error(`${base} adresine ulaşılamadı. Önce sunucuyu başlatın (npm start). (${err.message})`);
  });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res;
}

const dataUri = (mime: string, buf: Buffer | ArrayBuffer) => `data:${mime};base64,${Buffer.from(buf as ArrayBuffer).toString("base64")}`;

/** Gömülü JSON / betik içeriğinde </script> kapanışını engeller */
const safe = (s: string) => s.replace(/<\/(script)/gi, "<\\/$1").replace(/<!--/g, "<\\!--");

async function main() {
  // 1) Sunucuda işlenmiş menü sayfası: veriler, gövde öznitelikleri ve stil dosyası
  const page = await (await get("/menu")).text();
  const json = /<script type="application\/json" id="menu-veri">([\s\S]*?)<\/script>/.exec(page)?.[1];
  if (!json) throw new Error("Menü verisi bulunamadı. Menü yayında mı?");
  const props = JSON.parse(json) as { data: PublicMenu; initialSlug: string | null; missingProduct: boolean; initialView: string };
  props.initialSlug = null;
  props.missingProduct = false;
  props.initialView = "tumu";
  const design = props.data.design;
  if (dark) design.themeMode = "dark";

  const cssHref = /<link rel="stylesheet" href="([^"]+)"/.exec(page)?.[1];
  if (!cssHref) throw new Error("Stil dosyası bulunamadı.");
  let css = await (await get(cssHref)).text();

  // 2) Seçili yazı tipinin dosyaları
  const fontFiles: Record<string, RegExp> = { geometrik: /poppins/, klasik: /fraunces|poppins/, modern: /manrope/ };
  const wanted = fontFiles[design.fontStyle] ?? /poppins/;
  const fontDir = path.join(ROOT, "public", "fonts");
  for (const file of await fs.readdir(fontDir)) {
    if (!file.endsWith(".woff2") || !wanted.test(file)) continue;
    css = css.split(`/fonts/${file}`).join(dataUri("font/woff2", await fs.readFile(path.join(fontDir, file))));
  }

  // 3) Fotoğraflar (her görsel için ~800 px WebP) ve kategori ikonları
  const images = new Map<string, ImageRef>();
  const r = props.data.restaurant;
  for (const img of [r.cover, r.logo, ...props.data.categories.flatMap((c) => c.products.map((p) => p.image))]) if (img) images.set(img.id, img);
  const gorsel: Record<string, string> = {};
  for (const img of images.values()) {
    const width = img.widths.find((w) => w >= 800) ?? img.widths[img.widths.length - 1];
    gorsel[img.id] = dataUri("image/webp", await (await get(`/img/${img.id}/${width}.webp`)).arrayBuffer());
  }
  const ikon: Record<string, string> = {};
  const iconDir = path.join(ROOT, "public", "ikonlar");
  for (const file of await fs.readdir(iconDir)) {
    if (file.endsWith(".webp")) ikon[file.replace(/\.webp$/, "")] = dataUri("image/webp", await fs.readFile(path.join(iconDir, file)));
  }

  // 4) Menü uygulaması: aynı kaynak kod, yalnızca görsel adresleri gömülü veriden okunur ve sayaç kapatılır
  const patches: { file: RegExp; from: string; to: string }[] = [
    {
      file: /client[\\/]ui[\\/]Img\.tsx$/,
      from: "return `/img/${image.id}/${best}.webp`;",
      to: "void best; return (globalThis as any).__ONIZLEME__.gorsel[image.id] ?? image.placeholder ?? \"\";",
    },
    { file: /client[\\/]ui[\\/]Img\.tsx$/, from: "return image.widths.map((w) => `/img/${image.id}/${w}.webp ${w}w`).join(\", \");", to: 'return "";' },
    { file: /shared[\\/]catalog\.ts$/, from: "return `/ikonlar/${k}.webp?v=${ICON_VERSION}`;", to: "return (globalThis as any).__ONIZLEME__.ikon[k] ?? \"\";" },
    {
      file: /client[\\/]menu[\\/]hooks\.ts$/,
      from: 'export function track(kind: "menu" | "product", productId?: number) {',
      to: 'export function track(kind: "menu" | "product", productId?: number) {\n  if ((globalThis as any).__ONIZLEME__) return;',
    },
  ];
  const applied = new Set<number>();
  const result = await esbuild.build({
    stdin: {
      contents: `
        import { createRoot } from "react-dom/client";
        import { MenuApp } from "../src/client/menu/MenuApp";
        const props = JSON.parse(document.getElementById("menu-veri")!.textContent || "{}");
        createRoot(document.getElementById("app")!).render(<MenuApp {...props} />);
      `,
      loader: "tsx",
      resolveDir: path.join(ROOT, "scripts"),
      sourcefile: "onizleme-giris.tsx",
    },
    bundle: true,
    write: false,
    format: "iife",
    minify: true,
    jsx: "automatic",
    target: ["chrome100", "edge100", "firefox100", "safari15.4"],
    define: { "process.env.NODE_ENV": '"production"' },
    legalComments: "none",
    plugins: [
      {
        name: "onizleme-yamalari",
        setup(build) {
          build.onLoad({ filter: /src[\\/](client[\\/]ui[\\/]Img\.tsx|shared[\\/]catalog\.ts|client[\\/]menu[\\/]hooks\.ts)$/ }, async (a) => {
            let code = await fs.readFile(a.path, "utf8");
            patches.forEach((p, i) => {
              if (p.file.test(a.path) && code.includes(p.from)) {
                code = code.replace(p.from, p.to);
                applied.add(i);
              }
            });
            return { contents: code, loader: a.path.endsWith(".tsx") ? "tsx" : "ts" };
          });
        },
      },
    ],
  });
  if (applied.size !== patches.length) throw new Error("Kaynak kod değişmiş; önizleme yamaları uygulanamadı (scripts/snapshot.ts).");
  const js = result.outputFiles[0].text;

  // 5) Tek dosya
  const style = accentStyle(design.accentColor, design.themeMode);
  const title = `${r.name} | Dijital Menü (önizleme)`;
  // Yerel dosyada (file://) adres çubuğu değiştirilemeyebilir; menü yine de çalışsın
  const historyGuard = `["pushState","replaceState"].forEach(function(m){var o=history[m].bind(history);history[m]=function(s,t,u){try{return o(s,t,u)}catch(e){return o(s,t)}}});`;
  const html = `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</title>
<meta name="theme-color" content="#132131">
<style>${css}</style>
</head>
<body data-surface="menu" data-mode="${design.themeMode}" data-font="${design.fontStyle}" style="${style}">
<div id="app"></div>
<script type="application/json" id="menu-veri">${safe(JSON.stringify(props))}</script>
<script>window.__ONIZLEME__=${safe(JSON.stringify({ gorsel, ikon }))};${historyGuard}</script>
<script>${safe(js)}</script>
</body>
</html>
`;
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, html);
  console.log(`✔ ${path.relative(process.cwd(), out)} (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(1)} MB) — ${images.size} fotoğraf, ${Object.keys(ikon).length} ikon`);
}

main().catch((err) => {
  console.error(`✘ ${err.message}`);
  process.exit(1);
});
