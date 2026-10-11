import { useEffect, useState, type ReactNode } from "react";
import type { IconType } from "react-icons";
import {
  LuBookOpen,
  LuExternalLink,
  LuLayers,
  LuLayoutDashboard,
  LuLogOut,
  LuMenu,
  LuPalette,
  LuQrCode,
  LuSettings,
  LuStore,
  LuUtensils,
  LuX,
} from "react-icons/lu";
import type { AdminBoot } from "../../shared/types";
import { EmberMark } from "../ui/icons";
import { Img } from "../ui/Img";
import { Link, useRouter } from "./lib/router";
import { cx } from "./ui/primitives";

export const NAV: { to: string; label: string; icon: IconType; match: (p: string) => boolean }[] = [
  { to: "/yonetim", label: "Genel Bakış", icon: LuLayoutDashboard, match: (p) => p === "/yonetim" },
  { to: "/yonetim/menu", label: "Menü Yönetimi", icon: LuBookOpen, match: (p) => p === "/yonetim/menu" },
  { to: "/yonetim/kategoriler", label: "Kategoriler", icon: LuLayers, match: (p) => p.startsWith("/yonetim/kategoriler") },
  { to: "/yonetim/urunler", label: "Ürünler", icon: LuUtensils, match: (p) => p.startsWith("/yonetim/urunler") },
  { to: "/yonetim/qr-kod", label: "QR Kod Yönetimi", icon: LuQrCode, match: (p) => p.startsWith("/yonetim/qr-kod") },
  { to: "/yonetim/restoran", label: "Restoran Bilgileri", icon: LuStore, match: (p) => p.startsWith("/yonetim/restoran") },
  { to: "/yonetim/tasarim", label: "Tasarım Ayarları", icon: LuPalette, match: (p) => p.startsWith("/yonetim/tasarim") },
  { to: "/yonetim/ayarlar", label: "Genel Ayarlar", icon: LuSettings, match: (p) => p.startsWith("/yonetim/ayarlar") },
];

function Brand({ boot }: { boot: AdminBoot }) {
  return (
    <div className="flex items-center gap-3">
      {boot.logo ? (
        <span className="block size-10 shrink-0 overflow-hidden rounded-xl bg-white p-0.5">
          <Img image={boot.logo} alt="" sizes="40px" noPlaceholder className="size-full object-contain" />
        </span>
      ) : (
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/[0.07] text-ember ring-1 ring-white/10">
          <EmberMark className="size-6" />
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate font-bold text-white">{boot.restaurantName}</p>
        <p className="text-xs text-white/45">Yönetim paneli</p>
      </div>
    </div>
  );
}

function Sidebar({ boot, onNavigate }: { boot: AdminBoot; onNavigate?: () => void }) {
  const { path } = useRouter();
  return (
    <div className="flex h-full flex-col bg-coal px-3 pb-4 pt-5 text-white/75">
      <div className="px-2.5">
        <Brand boot={boot} />
      </div>
      <nav aria-label="Yönetim menüsü" className="mt-8 flex-1 overflow-y-auto">
        <ul className="space-y-0.5">
          {NAV.map((item) => {
            const active = item.match(path);
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "relative flex h-11 items-center gap-3 rounded-xl px-3 text-[0.92rem] font-semibold transition-colors",
                    active ? "bg-white/[0.08] text-white" : "hover:bg-white/[0.04] hover:text-white",
                  )}
                >
                  {active && <span className="absolute inset-y-2.5 left-0 w-[3px] rounded-r-full bg-ember" aria-hidden="true" />}
                  <item.icon className={cx("size-[1.15rem]", active ? "text-ember" : "text-white/50")} aria-hidden="true" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <a
        href={boot.menuUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 flex h-11 items-center gap-3 rounded-xl bg-white/[0.06] px-3 text-sm font-semibold text-white ring-1 ring-white/10 transition-colors hover:bg-white/[0.1]"
      >
        <LuExternalLink className="size-4 text-ember" aria-hidden="true" />
        Menüyü görüntüle
      </a>

      <div className="mt-4 flex items-center gap-3 border-t border-white/10 px-2.5 pt-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/10 text-sm font-bold text-white">
          {boot.user.name.trim().charAt(0).toLocaleUpperCase("tr-TR") || "Y"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{boot.user.name}</p>
          <p className="truncate text-xs text-white/45">{boot.user.email}</p>
        </div>
        <form method="post" action="/yonetim/cikis">
          <input type="hidden" name="csrf" value={boot.csrf} />
          <button
            type="submit"
            aria-label="Çıkış yap"
            title="Çıkış yap"
            className="grid size-9 place-items-center rounded-lg text-white/55 hover:bg-white/10 hover:text-white"
          >
            <LuLogOut className="size-[1.05rem]" aria-hidden="true" />
          </button>
        </form>
      </div>
    </div>
  );
}

export function Layout({ boot, children }: { boot: AdminBoot; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { path } = useRouter();
  const current = NAV.find((n) => n.match(path));

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    document.title = `${current?.label ?? "Yönetim"} | ${boot.restaurantName}`;
  }, [current, boot.restaurantName]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="min-h-dvh lg:pl-[17rem] print:pl-0">
      <a
        href="#icerik"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-lg focus:bg-coal focus:px-4 focus:py-2 focus:text-white"
      >
        İçeriğe geç
      </a>

      <aside className="print-hidden fixed inset-y-0 left-0 z-40 hidden w-[17rem] lg:block">
        <Sidebar boot={boot} />
      </aside>

      {/* Mobil üst çubuk */}
      <header className="print-hidden sticky top-0 z-30 flex h-14 items-center gap-3 bg-coal px-3 text-white lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Menüyü aç"
          aria-expanded={open}
          className="grid size-10 place-items-center rounded-lg hover:bg-white/10"
        >
          <LuMenu className="size-5" aria-hidden="true" />
        </button>
        <p className="min-w-0 flex-1 truncate font-semibold">{current?.label ?? boot.restaurantName}</p>
        <a
          href={boot.menuUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Menüyü görüntüle"
          className="grid size-10 place-items-center rounded-lg text-ember hover:bg-white/10"
        >
          <LuExternalLink className="size-[1.1rem]" aria-hidden="true" />
        </a>
      </header>

      {/* Mobil çekmece */}
      <div className={cx("print-hidden fixed inset-0 z-50 lg:hidden", open ? "" : "pointer-events-none")} aria-hidden={!open}>
        <div
          className={cx("absolute inset-0 bg-black/50 transition-opacity duration-300", open ? "opacity-100" : "opacity-0")}
          onClick={() => setOpen(false)}
        />
        <div
          className={cx(
            "absolute inset-y-0 left-0 w-[min(18rem,85vw)] transition-transform duration-300 ease-[var(--ease-soft)]",
            open ? "translate-x-0" : "-translate-x-full",
          )}
          role="dialog"
          aria-modal="true"
          aria-label="Yönetim menüsü"
          inert={!open}
        >
          <Sidebar boot={boot} onNavigate={() => setOpen(false)} />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Menüyü kapat"
            className="absolute right-3 top-4 grid size-9 place-items-center rounded-lg text-white/70 hover:bg-white/10"
          >
            <LuX className="size-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <main id="icerik" className="mx-auto w-full max-w-[76rem] px-4 pb-16 pt-6 sm:px-8 sm:pt-9 print:max-w-none print:p-0">
        {children}
      </main>
    </div>
  );
}
