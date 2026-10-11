/**
 * HTTP çekirdeği: Web standardı Request/Response üzerine küçük bir yönlendirici ve yardımcılar.
 * Böylece istek işleyiciler framework'ten bağımsızdır ve kolayca test edilebilir.
 */
import type { Session } from "../auth/session";
import type { ApiErrorBody } from "../../shared/types";

export interface Ctx {
  req: Request;
  url: URL;
  /** Tarayıcının gördüğü kök adres: https://ornek.com */
  origin: string;
  secure: boolean;
  ip: string;
  params: Record<string, string>;
  cookies: Record<string, string>;
  /** requireAuth sonrası dolu */
  session: Session | null;
  /** Yanıta eklenecek Set-Cookie başlıkları */
  setCookies: string[];
}

export type Handler = (ctx: Ctx) => Response | Promise<Response>;
export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface Route {
  method: Method;
  segments: string[];
  handler: Handler;
}

export class Router {
  private routes: Route[] = [];

  add(method: Method, path: string, handler: Handler) {
    this.routes.push({ method, segments: split(path), handler });
    return this;
  }
  get(path: string, h: Handler) {
    return this.add("GET", path, h);
  }
  post(path: string, h: Handler) {
    return this.add("POST", path, h);
  }
  put(path: string, h: Handler) {
    return this.add("PUT", path, h);
  }
  patch(path: string, h: Handler) {
    return this.add("PATCH", path, h);
  }
  delete(path: string, h: Handler) {
    return this.add("DELETE", path, h);
  }

  /** Eşleşen işleyiciyi bulur; yol eşleşip yöntem eşleşmezse `methodNotAllowed` döner. */
  match(method: string, pathname: string): { handler: Handler; params: Record<string, string> } | "405" | null {
    const parts = split(pathname);
    let pathMatched = false;
    for (const r of this.routes) {
      const params = matchSegments(r.segments, parts);
      if (!params) continue;
      pathMatched = true;
      if (r.method === method || (method === "HEAD" && r.method === "GET")) return { handler: r.handler, params };
    }
    return pathMatched ? "405" : null;
  }
}

function split(path: string) {
  return path.split("/").filter(Boolean);
}

function matchSegments(pattern: string[], parts: string[]): Record<string, string> | null {
  const params: Record<string, string> = {};
  for (let i = 0; i < pattern.length; i++) {
    const p = pattern[i];
    if (p === "*") {
      params["*"] = parts.slice(i).map(decodeURIComponent).join("/");
      return params;
    }
    const part = parts[i];
    if (part === undefined) return null;
    if (p.startsWith(":")) {
      try {
        params[p.slice(1)] = decodeURIComponent(part);
      } catch {
        return null;
      }
    } else if (p !== part) return null;
  }
  return parts.length === pattern.length ? params : null;
}

// ---------------------------------------------------------------------------
// Yanıt yardımcıları
// ---------------------------------------------------------------------------

export function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

export function apiError(status: number, error: string, fieldErrors?: Record<string, string>): Response {
  const body: ApiErrorBody = fieldErrors ? { error, fieldErrors } : { error };
  return json(body, status);
}

/** Node Buffer'ını Response gövdesi olarak kullanmak için (çalışma zamanında doğrudan desteklenir) */
export function bytes(buf: Buffer | Uint8Array): BodyInit {
  return buf as unknown as BodyInit;
}

export function html(body: string, status = 200, headers: HeadersInit = {}): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", ...headers },
  });
}

export function text(body: string, status = 200, headers: HeadersInit = {}): Response {
  return new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8", ...headers } });
}

export function redirect(location: string, status: 302 | 303 | 301 | 308 = 303): Response {
  return new Response(null, { status, headers: { location, "cache-control": "no-store" } });
}

// ---------------------------------------------------------------------------
// Çerezler
// ---------------------------------------------------------------------------

export function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (!k || k in out) continue;
    try {
      out[k] = decodeURIComponent(v);
    } catch {
      out[k] = v;
    }
  }
  return out;
}

export function serializeCookie(
  name: string,
  value: string,
  opts: { maxAge?: number; expires?: Date; path?: string; httpOnly?: boolean; secure?: boolean; sameSite?: "Lax" | "Strict" } = {},
): string {
  let c = `${name}=${encodeURIComponent(value)}; Path=${opts.path ?? "/"}`;
  if (opts.expires) c += `; Expires=${opts.expires.toUTCString()}`;
  if (opts.maxAge !== undefined) c += `; Max-Age=${opts.maxAge}`;
  if (opts.httpOnly !== false) c += "; HttpOnly";
  if (opts.secure) c += "; Secure";
  c += `; SameSite=${opts.sameSite ?? "Lax"}`;
  return c;
}

// ---------------------------------------------------------------------------
// Gövde okuma (boyut sınırlı)
// ---------------------------------------------------------------------------

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}

export async function readJson<T = unknown>(req: Request, maxBytes = 512 * 1024): Promise<T> {
  const type = req.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) throw new HttpError(415, "İstek JSON biçiminde olmalıdır.");
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > maxBytes) throw new HttpError(413, "İstek çok büyük.");
  const raw = await req.text();
  if (raw.length > maxBytes) throw new HttpError(413, "İstek çok büyük.");
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new HttpError(400, "İstek gövdesi okunamadı.");
  }
}

export function intParam(value: string | undefined): number | null {
  if (!value || !/^\d{1,10}$/.test(value)) return null;
  const n = Number(value);
  return n > 0 ? n : null;
}

const LINE_SEPARATORS = new RegExp("[" + String.fromCharCode(0x2028) + String.fromCharCode(0x2029) + "]", "g");

/** HTML/JSON içine güvenle gömülecek JSON (</script> kaçışı) */
export function safeJson(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(LINE_SEPARATORS, (c) => "\\u" + c.charCodeAt(0).toString(16));
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
