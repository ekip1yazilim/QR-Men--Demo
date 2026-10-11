/** Derlenmiş statik dosyalar (JS, CSS, fontlar, ikonlar) — önceden sıkıştırılmış .br/.gz sürümleriyle */
import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config";
import type { Ctx } from "../http/core";

const TYPES: Record<string, string> = {
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webp": "image/webp",
};

export async function serveStatic(ctx: Ctx, opts: { immutable: boolean }): Promise<Response | null> {
  const rel = decodeURIComponent(ctx.url.pathname).replace(/^\/+/, "");
  const file = path.resolve(config.publicDir, rel);
  // Dizin dışına çıkma girişimlerini engelle
  if (!file.startsWith(config.publicDir + path.sep)) return null;
  const ext = path.extname(file);
  const type = TYPES[ext];
  if (!type) return null;

  const accept = ctx.req.headers.get("accept-encoding") ?? "";
  const candidates: { file: string; encoding?: string }[] = [];
  if (/\bbr\b/.test(accept)) candidates.push({ file: file + ".br", encoding: "br" });
  if (/\bgzip\b/.test(accept)) candidates.push({ file: file + ".gz", encoding: "gzip" });
  candidates.push({ file });

  for (const c of candidates) {
    try {
      const stat = await fs.stat(c.file);
      if (!stat.isFile()) continue;
      const etag = `"${stat.size.toString(36)}-${Math.floor(stat.mtimeMs).toString(36)}${c.encoding ? "-" + c.encoding : ""}"`;
      const headers: Record<string, string> = {
        "content-type": type,
        "cache-control": opts.immutable && config.isProd ? "public, max-age=31536000, immutable" : "public, max-age=0, must-revalidate",
        etag,
        vary: "Accept-Encoding",
        "x-precompressed": c.encoding ? "1" : "0",
      };
      if (c.encoding) headers["content-encoding"] = c.encoding;
      if (ctx.req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
      const data = await fs.readFile(c.file);
      return new Response(ctx.req.method === "HEAD" ? null : data, { status: 200, headers });
    } catch {
      continue;
    }
  }
  return null;
}
