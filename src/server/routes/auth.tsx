/** Yönetim paneli giriş / çıkış */
import { renderToString } from "react-dom/server";
import { LoginPage, type LoginProps } from "../../client/login/LoginPage";
import { loginSchema } from "../../shared/schemas";
import { burnTime, verifyPassword } from "../auth/password";
import { clearFailures, lockRemaining, registerFailure } from "../auth/rateLimit";
import { createSession, destroySession, getSession, SESSION_COOKIE } from "../auth/session";
import { html, redirect, type Ctx } from "../http/core";
import { ADMIN_PATH, clearSessionCookie, sameOrigin, sessionCookie } from "../http/guards";
import { renderDocument } from "../render/document";
import { logActivity } from "../repo/activity";
import { getRestaurant } from "../repo/settings";
import { findUserByEmail, touchLogin } from "../repo/users";

/** Yalnızca panel içi göreli adreslere yönlendir (açık yönlendirme açığını önler) */
export function safeNext(value: string | null | undefined): string {
  const v = value ?? "";
  if (!v.startsWith(ADMIN_PATH) || v.startsWith("//") || v.includes("\\") || v.startsWith(`${ADMIN_PATH}/giris`)) return ADMIN_PATH;
  return v;
}

function renderLogin(ctx: Ctx, props: Omit<LoginProps, "restaurantName" | "logo">, status = 200): Response {
  const r = getRestaurant();
  const full: LoginProps = { ...props, restaurantName: r.name, logo: r.logo };
  const body = renderToString(<LoginPage {...full} />);
  return html(
    renderDocument({
      title: `Giriş | ${r.name} Yönetim Paneli`,
      head: `<meta name="robots" content="noindex, nofollow"><link rel="icon" type="image/png" href="/simge/64.png">`,
      bodyAttrs: { "data-surface": "admin" },
      body,
      data: { "giris-veri": full },
      entry: "login",
      themeColor: "#f3f3f1",
    }),
    status,
    { "cache-control": "no-store" },
  );
}

export function loginPage(ctx: Ctx): Response {
  if (getSession(ctx.cookies[SESSION_COOKIE])) return redirect(safeNext(ctx.url.searchParams.get("sonra")), 303);
  const q = ctx.url.searchParams;
  const notice = q.has("cikis") ? "Oturumunuz kapatıldı." : q.has("sifre") ? "Şifreniz değiştirildi. Yeni şifrenizle giriş yapın." : null;
  return renderLogin(ctx, { email: "", next: safeNext(q.get("sonra")), error: null, notice, locked: false });
}

export async function loginSubmit(ctx: Ctx): Promise<Response> {
  if (!sameOrigin(ctx)) return renderLogin(ctx, { email: "", next: ADMIN_PATH, error: "İstek doğrulanamadı. Sayfayı yenileyip tekrar deneyin.", notice: null, locked: false }, 403);
  if (Number(ctx.req.headers.get("content-length") ?? 0) > 8 * 1024) return html("İstek çok büyük.", 413);

  let form: FormData;
  try {
    form = await ctx.req.formData();
  } catch {
    return renderLogin(ctx, { email: "", next: ADMIN_PATH, error: "Form okunamadı. Tekrar deneyin.", notice: null, locked: false }, 400);
  }
  const next = safeNext(String(form.get("sonra") ?? ""));
  const parsed = loginSchema.safeParse({ email: String(form.get("email") ?? ""), password: String(form.get("password") ?? "") });
  if (!parsed.success) {
    return renderLogin(ctx, { email: String(form.get("email") ?? "").slice(0, 120), next, error: "E-posta ve şifrenizi girin.", notice: null, locked: false }, 400);
  }
  const { email, password } = parsed.data;
  const keys = [`ip:${ctx.ip}`, `email:${email}`];

  const wait = lockRemaining(keys);
  if (wait > 0) {
    const minutes = Math.ceil(wait / 60_000);
    return renderLogin(
      ctx,
      { email, next, error: `Çok fazla hatalı deneme yapıldı. Güvenliğiniz için ${minutes} dakika sonra tekrar deneyin.`, notice: null, locked: true },
      429,
    );
  }

  const user = findUserByEmail(email);
  let ok = false;
  if (user) ok = await verifyPassword(password, user.password_hash);
  else await burnTime(password);

  if (!user || !ok) {
    registerFailure(keys);
    return renderLogin(ctx, { email, next, error: "E-posta adresi veya şifre hatalı.", notice: null, locked: false }, 401);
  }

  clearFailures(keys);
  destroySession(ctx.cookies[SESSION_COOKIE]); // oturum sabitleme saldırısına karşı eski oturumu kapat
  const remember = form.get("hatirla") === "1";
  const session = createSession(user.id, { remember, ip: ctx.ip, userAgent: ctx.req.headers.get("user-agent") ?? "" });
  touchLogin(user.id);
  logActivity(user.id, "login", "oturum", null, "Yönetim paneline giriş yapıldı");

  const res = redirect(next, 303);
  res.headers.append("set-cookie", sessionCookie(ctx, session.token, session.expiresAt, remember));
  return res;
}

export async function logout(ctx: Ctx): Promise<Response> {
  const token = ctx.cookies[SESSION_COOKIE];
  const session = getSession(token);
  if (session) {
    let csrf = "";
    try {
      csrf = String((await ctx.req.formData()).get("csrf") ?? "");
    } catch {
      /* boş */
    }
    if (!sameOrigin(ctx) || csrf !== session.csrf) return redirect(ADMIN_PATH, 303);
    destroySession(token);
  }
  const res = redirect(`${ADMIN_PATH}/giris?cikis=1`, 303);
  res.headers.append("set-cookie", clearSessionCookie(ctx));
  return res;
}
