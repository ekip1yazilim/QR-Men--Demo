/** HTML belge iskeleti ve derlenmiş varlık (asset) listesi */
import fs from "node:fs";
import { config } from "../config";
import { escapeHtml, safeJson } from "../http/core";

interface AssetManifest {
  css: string;
  entries: Record<string, { js: string; preload: string[] }>;
}

let cached: { manifest: AssetManifest; mtime: number } | null = null;

export function getManifest(): AssetManifest {
  let stat: fs.Stats;
  try {
    stat = fs.statSync(config.manifestFile);
  } catch {
    throw new Error("Derlenmiş dosyalar bulunamadı. Önce `npm run build` (veya `npm run dev`) çalıştırın.");
  }
  if (!cached || (!config.isProd && cached.mtime !== stat.mtimeMs)) {
    cached = { manifest: JSON.parse(fs.readFileSync(config.manifestFile, "utf8")), mtime: stat.mtimeMs };
  }
  return cached.manifest;
}

export interface DocumentOptions {
  title: string;
  /** Hazır <meta>/<link> etiketleri (önceden kaçışlanmış) */
  head?: string;
  bodyAttrs?: Record<string, string>;
  body: string;
  /** <script type="application/json" id="..."> olarak gömülecek veri */
  data?: Record<string, unknown>;
  entry: "menu" | "admin" | "login" | null;
  themeColor?: string;
  rootId?: string;
  /** Ön yüklenecek yazı tipi dosyaları (varsayılan: Manrope) */
  fonts?: string[];
}

export function renderDocument(o: DocumentOptions): string {
  const m = getManifest();
  const entry = o.entry ? m.entries[o.entry] : null;
  const attrs = Object.entries(o.bodyAttrs ?? {})
    .map(([k, v]) => ` ${k}="${escapeHtml(v)}"`)
    .join("");
  const data = Object.entries(o.data ?? {})
    .map(([id, value]) => `<script type="application/json" id="${id}">${safeJson(value)}</script>`)
    .join("");
  const fonts = (o.fonts ?? ["/fonts/manrope-latin-v1.woff2"])
    .map((f) => `<link rel="preload" href="${f}" as="font" type="font/woff2" crossorigin>`)
    .join("");

  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${escapeHtml(o.title)}</title>
<meta name="theme-color" content="${escapeHtml(o.themeColor ?? "#1b1c1f")}">
${fonts}
<link rel="stylesheet" href="${m.css}">
${entry ? entry.preload.map((p) => `<link rel="modulepreload" href="${p}">`).join("") : ""}
${entry ? `<script type="module" src="${entry.js}"></script>` : ""}
${o.head ?? ""}
</head>
<body${attrs}>
<div id="${o.rootId ?? "app"}">${o.body}</div>
${data}
</body>
</html>`;
}
