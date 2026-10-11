/**
 * Derleme betiği
 * - İstemci paketleri (menü + yönetim paneli) → dist/public/assets (hash'li adlar)
 * - Tailwind CSS 4 (derleme API'si ile) → dist/public/assets/app-[hash].css
 * - Sunucu paketi → dist/server.mjs (+ dist/admin.mjs, dist/seed.mjs komutları)
 * - public/ klasörü → dist/public
 * - .br / .gz önceden sıkıştırılmış kopyalar
 *
 * Kullanım:  npm run build            (üretim)
 *            tsx scripts/build.ts --dev (geliştirme: küçültme yok, kaynak haritası var)
 */
import * as esbuild from "esbuild";
import { compile } from "tailwindcss";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";
import { promisify } from "node:util";

const brotli = promisify(zlib.brotliCompress);
const gzip = promisify(zlib.gzip);

export const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "src");
const OUT = path.join(ROOT, "dist");
const PUBLIC_OUT = path.join(OUT, "public");
const ASSETS_OUT = path.join(PUBLIC_OUT, "assets");

/** Tarayıcı hedefleri: iOS 15+ Safari ve son 3-4 yılın Android Chrome sürümleri */
const BROWSER_TARGETS = ["chrome100", "edge100", "firefox100", "safari15.4", "ios15.4"];

export interface AssetManifest {
  css: string;
  entries: Record<string, { js: string; preload: string[] }>;
  builtAt: string;
}

async function walk(dir: string, exts: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full, exts)));
    else if (exts.some((e) => entry.name.endsWith(e))) out.push(full);
  }
  return out;
}

/** Kaynak dosyalarından Tailwind sınıf adaylarını çıkarır (oxide tarayıcısının sade bir karşılığı). */
export function extractCandidates(content: string, into: Set<string>) {
  for (const raw of content.split(/[\s"'`]+/)) {
    if (!raw || raw.length > 120) continue;
    into.add(raw);
    // Baştaki/sondaki JS noktalama işaretlerini temizlenmiş varyantlar da ekle
    const trimmed = raw.replace(/^[{(\[,;]+/, "").replace(/[},;]+$/, "");
    if (trimmed !== raw) into.add(trimmed);
    if (trimmed.endsWith(")") && !trimmed.includes("(")) into.add(trimmed.slice(0, -1));
  }
}

function hash(content: string | Buffer) {
  return createHash("sha256").update(content).digest("hex").slice(0, 10);
}

export async function buildCss(dev = false): Promise<string> {
  const entry = path.join(SRC, "styles", "app.css");
  const input = await fs.readFile(entry, "utf8");
  const tailwindDir = await fs.realpath(path.join(ROOT, "node_modules", "tailwindcss"));

  const compiler = await compile(input, {
    base: path.dirname(entry),
    from: entry,
    loadStylesheet: async (id, base) => {
      let file: string;
      if (id === "tailwindcss") file = path.join(tailwindDir, "index.css");
      else if (id.startsWith("tailwindcss/")) file = path.join(tailwindDir, id.slice("tailwindcss/".length));
      else file = path.resolve(base, id);
      return { path: file, base: path.dirname(file), content: await fs.readFile(file, "utf8") };
    },
  });

  const candidates = new Set<string>();
  const files = await walk(SRC, [".ts", ".tsx"]);
  for (const f of files) extractCandidates(await fs.readFile(f, "utf8"), candidates);
  const css = compiler.build([...candidates]);

  const result = await esbuild.transform(css, {
    loader: "css",
    minify: !dev,
    target: BROWSER_TARGETS,
    legalComments: "none",
  });
  return result.code;
}

async function emptyDir(dir: string) {
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
}

async function precompress(dir: string) {
  const files = await walk(dir, [".js", ".css", ".svg", ".json", ".txt", ".webmanifest"]);
  await Promise.all(
    files.map(async (f) => {
      const buf = await fs.readFile(f);
      if (buf.length < 1024) return;
      const [br, gz] = await Promise.all([
        brotli(buf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } }),
        gzip(buf, { level: 9 }),
      ]);
      await Promise.all([fs.writeFile(f + ".br", br), fs.writeFile(f + ".gz", gz)]);
    }),
  );
}

export async function buildClient(dev = false): Promise<AssetManifest> {
  await emptyDir(ASSETS_OUT);

  const result = await esbuild.build({
    entryPoints: {
      menu: path.join(SRC, "client", "menu", "entry.tsx"),
      admin: path.join(SRC, "client", "admin", "entry.tsx"),
      login: path.join(SRC, "client", "login", "entry.tsx"),
    },
    bundle: true,
    splitting: true,
    format: "esm",
    outdir: ASSETS_OUT,
    entryNames: "[name]-[hash]",
    chunkNames: "chunk-[hash]",
    minify: !dev,
    sourcemap: dev ? "linked" : false,
    target: BROWSER_TARGETS,
    jsx: "automatic",
    metafile: true,
    legalComments: "none",
    define: { "process.env.NODE_ENV": JSON.stringify(dev ? "development" : "production") },
    logLevel: "warning",
  });

  const entries: AssetManifest["entries"] = {};
  for (const [out, meta] of Object.entries(result.metafile.outputs)) {
    if (!meta.entryPoint || !out.endsWith(".js")) continue;
    const name = path.basename(out).split("-")[0];
    entries[name] = {
      js: "/assets/" + path.basename(out),
      preload: meta.imports.filter((i) => i.kind === "import-statement").map((i) => "/assets/" + path.basename(i.path)),
    };
  }

  const css = await buildCss(dev);
  const cssName = `app-${hash(css)}.css`;
  await fs.writeFile(path.join(ASSETS_OUT, cssName), css);

  const manifest: AssetManifest = { css: "/assets/" + cssName, entries, builtAt: new Date().toISOString() };
  await fs.writeFile(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
  if (!dev) await precompress(ASSETS_OUT);
  return manifest;
}

export async function copyPublic() {
  const src = path.join(ROOT, "public");
  await fs.mkdir(PUBLIC_OUT, { recursive: true });
  await fs.cp(src, PUBLIC_OUT, { recursive: true });
}

export async function buildServer() {
  // Sunucu + sunucuda çalıştırılacak yönetim komutları (npm run admin / npm run seed)
  await esbuild.build({
    entryPoints: {
      server: path.join(SRC, "server", "index.ts"),
      admin: path.join(ROOT, "scripts", "admin.ts"),
      seed: path.join(ROOT, "scripts", "seed.ts"),
    },
    outdir: OUT,
    outExtension: { ".js": ".mjs" },
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    packages: "external",
    jsx: "automatic",
    sourcemap: true,
    legalComments: "none",
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    logLevel: "warning",
  });
}

async function main() {
  const dev = process.argv.includes("--dev");
  const started = Date.now();
  if (!dev) await emptyDir(OUT);
  await copyPublic();
  const manifest = await buildClient(dev);
  if (!dev) {
    await buildServer();
    await precompress(path.join(PUBLIC_OUT));
  }
  const sizes = await Promise.all(
    [manifest.css, ...Object.values(manifest.entries).map((e) => e.js)].map(async (p) => {
      const stat = await fs.stat(path.join(PUBLIC_OUT, p));
      return `${p} (${(stat.size / 1024).toFixed(1)} KB)`;
    }),
  );
  console.log(`✔ Derleme tamamlandı (${Date.now() - started} ms)\n  ${sizes.join("\n  ")}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
