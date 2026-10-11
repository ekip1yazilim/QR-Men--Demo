/**
 * Sunucu giriş noktası: Node.js http sunucusu ↔ Web Request/Response köprüsü,
 * dinamik yanıtlar için sıkıştırma, açılış görevleri ve düzgün kapanış.
 */
import http from "node:http";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import zlib from "node:zlib";
import { config } from "./config";
import { db, openDb } from "./db";
import { createApp } from "./app";
import { cleanupImages } from "./routes/admin";
import { countUsers } from "./repo/users";

const COMPRESSIBLE = /^(text\/|application\/(json|javascript|xml|manifest\+json)|image\/svg\+xml)/;

function toWebRequest(req: http.IncomingMessage): Request {
  const host = req.headers.host ?? `localhost:${config.port}`;
  const url = `http://${host}${req.url ?? "/"}`;
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) v.forEach((x) => headers.append(k, x));
    else headers.set(k, v);
  }
  const method = req.method ?? "GET";
  const hasBody = method !== "GET" && method !== "HEAD";
  return new Request(url, {
    method,
    headers,
    body: hasBody ? (Readable.toWeb(req) as ReadableStream) : undefined,
    // @ts-expect-error Node'a özgü: akış gövdesi için gerekli
    duplex: hasBody ? "half" : undefined,
  });
}

async function writeResponse(req: http.IncomingMessage, res: http.ServerResponse, response: Response) {
  const headers: Record<string, string | string[]> = {};
  response.headers.forEach((value, key) => {
    if (key === "set-cookie") return;
    headers[key] = value;
  });
  const cookies = response.headers.getSetCookie();
  if (cookies.length) headers["set-cookie"] = cookies;

  const type = response.headers.get("content-type") ?? "";
  const accept = String(req.headers["accept-encoding"] ?? "");
  const canCompress =
    response.body &&
    !response.headers.has("content-encoding") &&
    !response.headers.has("content-length") &&
    COMPRESSIBLE.test(type) &&
    req.method !== "HEAD";

  if (canCompress && /\bbr\b/.test(accept)) {
    headers["content-encoding"] = "br";
    headers["vary"] = "Accept-Encoding";
    res.writeHead(response.status, headers);
    await pipeline(
      Readable.fromWeb(response.body as never),
      zlib.createBrotliCompress({ params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } }),
      res,
    );
    return;
  }
  if (canCompress && /\bgzip\b/.test(accept)) {
    headers["content-encoding"] = "gzip";
    headers["vary"] = "Accept-Encoding";
    res.writeHead(response.status, headers);
    await pipeline(Readable.fromWeb(response.body as never), zlib.createGzip({ level: 6 }), res);
    return;
  }
  res.writeHead(response.status, headers);
  if (!response.body || req.method === "HEAD") {
    res.end();
    return;
  }
  await pipeline(Readable.fromWeb(response.body as never), res);
}

function main() {
  openDb(config.dbFile);
  const app = createApp();

  if (countUsers() === 0) {
    console.warn(
      "\n⚠  Henüz yönetici hesabı yok. Oluşturmak için:  npm run admin -- olustur\n   (ya da örnek verilerle başlamak için:  npm run seed)\n",
    );
  }

  try {
    const removed = cleanupImages();
    if (removed) console.log(`Kullanılmayan ${removed} görsel temizlendi.`);
  } catch (err) {
    console.error("Görsel temizliği başarısız:", err);
  }
  const daily = setInterval(() => {
    try {
      cleanupImages();
    } catch {
      /* bir sonraki turda tekrar denenir */
    }
  }, 24 * 3600_000);
  daily.unref();

  const server = http.createServer(async (req, res) => {
    const started = Date.now();
    try {
      const request = toWebRequest(req);
      const response = await app.handle(request, {
        ip: req.socket.remoteAddress ?? "",
        encrypted: "encrypted" in req.socket && !!req.socket.encrypted,
      });
      await writeResponse(req, res, response);
    } catch (err) {
      console.error("İstek işlenemedi:", err);
      if (!res.headersSent) res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      res.end("Sunucu hatası");
    } finally {
      if (!config.isProd && !req.url?.startsWith("/assets/") && !req.url?.startsWith("/fonts/") && !req.url?.startsWith("/ikonlar/")) {
        console.log(`${req.method} ${req.url} → ${res.statusCode} (${Date.now() - started} ms)`);
      }
    }
  });
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;
  server.requestTimeout = 60_000;

  server.listen(config.port, config.host, () => {
    console.log(`✔ Dijital menü çalışıyor: http://localhost:${config.port}/menu`);
    console.log(`  Yönetim paneli:        http://localhost:${config.port}/yonetim`);
    console.log(`  Veri klasörü:          ${config.dataDir}`);
  });

  const shutdown = (signal: string) => {
    console.log(`${signal} alındı, sunucu kapatılıyor…`);
    server.close(() => {
      try {
        db().close();
      } catch {
        /* zaten kapalı */
      }
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main();
