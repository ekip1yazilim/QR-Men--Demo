import { useState } from "react";
import { LuEye, LuEyeOff, LuLoaderCircle, LuLockKeyhole, LuTriangleAlert, LuCircleCheck } from "react-icons/lu";
import type { ImageRef } from "../../shared/types";
import { EmberMark } from "../ui/icons";
import { Img } from "../ui/Img";

export interface LoginProps {
  restaurantName: string;
  logo: ImageRef | null;
  email: string;
  next: string;
  error: string | null;
  notice: string | null;
  locked: boolean;
}

export function LoginPage({ restaurantName, logo, email, next, error, notice, locked }: LoginProps) {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="ember-field relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="ember-grain absolute inset-0" aria-hidden="true" />
        <div className="relative flex items-center gap-3 text-white">
          <span className="grid size-11 place-items-center rounded-xl bg-white/10 text-ember ring-1 ring-white/15">
            <EmberMark className="size-7" />
          </span>
          <span className="text-sm font-semibold tracking-wide text-white/80">EKİP1 Dijital Menü</span>
        </div>
        <div className="relative max-w-md text-white">
          <h2 className="[font-family:Fraunces,Georgia,serif] text-5xl font-semibold leading-[1.05]">Menünüz, her zaman güncel.</h2>
          <p className="mt-5 text-lg leading-relaxed text-white/75">
            Fiyatı değiştirin, tükenen ürünü işaretleyin; masadaki QR kod anında yeni menüyü gösterir.
          </p>
        </div>
        <p className="relative text-sm text-white/50">Yalnızca yetkili restoran yöneticileri içindir.</p>
      </aside>

      <main className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-[24rem]">
          <div className="flex items-center gap-3">
            {logo ? (
              <span className="block size-12 overflow-hidden rounded-xl bg-white p-1 ring-1 ring-line">
                <Img image={logo} alt="" sizes="48px" noPlaceholder className="size-full object-contain" />
              </span>
            ) : (
              <span className="grid size-12 place-items-center rounded-xl bg-coal text-ember">
                <EmberMark className="size-7" />
              </span>
            )}
            <div>
              <p className="text-sm text-ink-3">Yönetim paneli</p>
              <p className="font-semibold text-ink">{restaurantName}</p>
            </div>
          </div>

          <h1 className="mt-10 text-[1.75rem] font-bold tracking-tight">Giriş yapın</h1>
          <p className="mt-1.5 text-ink-2">Menünüzü düzenlemek için yönetici hesabınızla giriş yapın.</p>

          {notice && (
            <p role="status" className="mt-6 flex items-start gap-2.5 rounded-xl bg-ok/10 px-4 py-3 text-sm text-ok">
              <LuCircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {notice}
            </p>
          )}
          {error && (
            <p role="alert" className="mt-6 flex items-start gap-2.5 rounded-xl bg-bad/10 px-4 py-3 text-sm text-bad">
              <LuTriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}

          <form method="post" action="/yonetim/giris" className="mt-8 space-y-5" onSubmit={() => setBusy(true)} noValidate={false}>
            <input type="hidden" name="sonra" value={next} />
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-semibold">
                E-posta
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                inputMode="email"
                required
                defaultValue={email}
                autoFocus={!email}
                className="field h-12"
                aria-invalid={error ? true : undefined}
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-semibold">
                Şifre
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  autoFocus={!!email}
                  className="field h-12 pr-12"
                  aria-invalid={error ? true : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-ink-3 hover:bg-raised hover:text-ink"
                  aria-label={show ? "Şifreyi gizle" : "Şifreyi göster"}
                  aria-pressed={show}
                >
                  {show ? <LuEyeOff className="size-[1.1rem]" /> : <LuEye className="size-[1.1rem]" />}
                </button>
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-3 text-sm text-ink-2">
              <input type="checkbox" name="hatirla" value="1" className="size-[1.1rem] accent-[#1e1f23]" />
              Bu cihazda oturumum açık kalsın (30 gün)
            </label>
            <button
              type="submit"
              disabled={busy || locked}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-coal font-semibold text-white transition-colors hover:bg-coal-3 disabled:opacity-60"
            >
              {busy ? <LuLoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : <LuLockKeyhole className="size-4" aria-hidden="true" />}
              {busy ? "Giriş yapılıyor…" : "Giriş yap"}
            </button>
          </form>
          <p className="mt-8 text-sm leading-relaxed text-ink-3">
            Şifrenizi unuttuysanız sunucu üzerinde <code className="rounded bg-raised px-1.5 py-0.5 text-[0.8rem]">npm run admin -- sifre</code>{" "}
            komutuyla yeni şifre belirlenebilir.
          </p>
        </div>
      </main>
    </div>
  );
}
