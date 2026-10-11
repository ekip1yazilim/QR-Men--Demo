/** Telefon alt gezinme çubuğu (referanstaki gibi). Sipariş/sepet yoktur: Ana Sayfa · Menü · Ara · İletişim */
import { FaWhatsapp } from "react-icons/fa";
import { LuBookOpen, LuHouse, LuPhone, LuSearch } from "react-icons/lu";
import type { IconType } from "react-icons";
import { whatsappHref } from "../../shared/format";
import { cx } from "./ProductCard";

export type BottomTab = "home" | "menu" | "search" | "contact";

function Item({ label, icon: Icon, active, onClick }: { label: string; icon: IconType; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cx("flex flex-1 flex-col items-center justify-center gap-1 pt-1 text-[0.7rem] font-medium transition-colors", active ? "text-accent-text" : "text-ink-3")}
    >
      <Icon className="size-[1.35rem]" aria-hidden="true" />
      {label}
    </button>
  );
}

export function BottomNav({
  active,
  showSearch,
  onHome,
  onMenu,
  onSearch,
  onContact,
}: {
  active: BottomTab;
  showSearch: boolean;
  onHome: () => void;
  onMenu: () => void;
  onSearch: () => void;
  onContact: () => void;
}) {
  return (
    <nav
      aria-label="Hızlı gezinme"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-18px_rgb(16_24_40/0.35)] backdrop-blur-md md:hidden"
    >
      <div className="flex h-16">
        <Item label="Ana Sayfa" icon={LuHouse} active={active === "home"} onClick={onHome} />
        <Item label="Menü" icon={LuBookOpen} active={active === "menu"} onClick={onMenu} />
        {showSearch && <Item label="Ara" icon={LuSearch} active={active === "search"} onClick={onSearch} />}
        <Item label="İletişim" icon={LuPhone} active={active === "contact"} onClick={onContact} />
      </div>
    </nav>
  );
}

/** Sağ alttaki WhatsApp düğmesi (referanstaki yeşil daire) — yalnızca iletişim içindir */
export function WhatsAppButton({ phone }: { phone: string }) {
  return (
    <a
      href={whatsappHref(phone)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="WhatsApp ile bize yazın"
      title="WhatsApp ile bize yazın"
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+5rem)] right-4 z-30 grid size-[3.25rem] place-items-center rounded-full bg-whatsapp text-white shadow-[0_10px_24px_-8px_rgb(37_211_102/0.6)] transition-transform hover:scale-105 max-md:hidden md:bottom-6 md:right-6 md:size-14"
    >
      <FaWhatsapp className="size-7" aria-hidden="true" />
    </a>
  );
}
