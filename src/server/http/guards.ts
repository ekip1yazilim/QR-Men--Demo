/**
 * Yetkilendirme ve CSRF korumaları.
 * - Sayfalar: oturum yoksa giriş ekranına yönlendirir.
 * - API: oturum yoksa 401; durum değiştiren isteklerde Origin + CSRF belirteci zorunludur.
 */
import { config } from "../config";
import { getSession, SESSION_COOKIE, type Session } from "../auth/session";
import { apiError, redirect, serializeCookie, type Ctx, type Handler } from "./core";

export const ADMIN_PATH = "/yonetim";

export function sessionCookie(ctx: Ctx, token: string, expiresAt: string, remember: boolean): string {
  return serializeCookie(SESSION_COOKIE, token, {
    path: ADMIN_PATH,
    httpOnly: true,
    secure: useSecureCookie(ctx),
    sameSite: "Lax",
    // "Beni hatırla" seçilmediyse tarayıcı kapanınca silinen oturum çerezi
    ...(remember ? { expires: new Date(expiresAt) } : {}),
  });
}

export function clearSessionCookie(ctx: Ctx): string {
  return serializeCookie(SESSION_COOKIE, "", { path: ADMIN_PATH, maxAge: 0, secure: useSecureCookie(ctx) });
}

export function useSecureCookie(ctx: Ctx): boolean {
  if (config.cookieSecure === "true") return true;
  if (config.cookieSecure === "false") return false;
  return ctx.secure;
}

function loadSession(ctx: Ctx): Session | null {
  const session = getSession(ctx.cookies[SESSION_COOKIE]);
  if (session?.renewed && session.remember) {
    ctx.setCookies.push(sessionCookie(ctx, session.token, session.expiresAt, true));
  }
  return session;
}

/** İstek aynı siteden mi geliyor? (Origin, yoksa Referer) */
export function sameOrigin(ctx: Ctx): boolean {
  const origin = ctx.req.headers.get("origin");
  if (origin) return origin === ctx.origin;
  const referer = ctx.req.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).origin === ctx.origin;
    } catch {
      return false;
    }
  }
  // Origin/Referer göndermeyen istemciler: CSRF belirteci yine de kontrol edilir
  return true;
}

/** Yönetim sayfaları için */
export function requirePage(handler: Handler): Handler {
  return (ctx) => {
    const session = loadSession(ctx);
    if (!session) {
      const next = ctx.url.pathname + ctx.url.search;
      return redirect(`${ADMIN_PATH}/giris?sonra=${encodeURIComponent(next)}`, 303);
    }
    ctx.session = session;
    return handler(ctx);
  };
}

/** Yönetim API'si için */
export function requireApi(handler: Handler): Handler {
  return (ctx) => {
    const session = loadSession(ctx);
    if (!session) return apiError(401, "Oturumunuz sona erdi. Lütfen yeniden giriş yapın.");
    const method = ctx.req.method;
    if (method !== "GET" && method !== "HEAD") {
      if (!sameOrigin(ctx)) return apiError(403, "İstek kaynağı doğrulanamadı.");
      const token = ctx.req.headers.get("x-csrf-token");
      if (!token || token !== session.csrf) return apiError(403, "Güvenlik belirteci geçersiz. Sayfayı yenileyip tekrar deneyin.");
    }
    ctx.session = session;
    return handler(ctx);
  };
}
