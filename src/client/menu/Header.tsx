/** Menünün üst çubuğu: referanstaki lacivert-antrasit çubuk, logo, gezinme bağlantıları ve araçlar */
import { LuBookOpen, LuHouse, LuMenu, LuMessageCircle, LuSearch, LuSlidersHorizontal } from "react-icons/lu";
import type { RestaurantInfo } from "../../shared/types";
import { EmberMark } from "../ui/icons";
import { Img } from "../ui/Img";
import { cx } from "./ProductCard";

export function BrandMark({ restaurant, size = "md" }: { restaurant: RestaurantInfo; size?: "md" | "lg" }) {
  const big = size === "lg";
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      {restaurant.logo ? (
        <span className={cx("block shrink-0 overflow-hidden rounded-lg bg-white p-0.5", big ? "size-14" : "size-10")}>
          <Img image={restaurant.logo} alt="" sizes="56px" noPlaceholder className="size-full object-contain" />
        </span>
      ) : (
        <EmberMark className={cx("shrink-0 text-accent", big ? "size-14" : "size-9 md:size-10")} />
      )}
      <span className="min-w-0 leading-none">
        <span className={cx("block truncate font-display font-semibold tracking-[-0.01em] text-white", big ? "text-2xl" : "text-[1.05rem] md:text-[1.15rem]")}>
          {restaurant.name}
        </span>
        {restaurant.brandLabel && (
          <span className={cx("mt-1 block truncate font-medium uppercase text-accent", big ? "text-xs tracking-[0.34em]" : "text-[0.6rem] tracking-[0.32em] md:text-[0.62rem]")}>
            {restaurant.brandLabel}
          </span>
        )}
      </span>
    </span>
  );
}

export type HeaderSection = "home" | "menu" | "contact";

interface Props {
  restaurant: RestaurantInfo;
  active: HeaderSection;
  filterCount: number;
  showSearch: boolean;
  onHome: () => void;
  onMenu: () => void;
  onContact: () => void;
  onSearch: () => void;
  onCategories: () => void;
  onFilters: () => void;
}

function NavLink({ label, icon: Icon, active, onClick, href }: { label: string; icon: typeof LuHouse; active: boolean; onClick: () => void; href: string }) {
  return (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      aria-current={active ? "page" : undefined}
      className={cx(
        "inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors",
        active ? "text-accent" : "text-white/80 hover:bg-white/[0.06] hover:text-white",
      )}
    >
      <Icon className="size-[1.05rem]" aria-hidden="true" />
      {label}
    </a>
  );
}

function IconBtn({ label, onClick, children, badge }: { label: string; onClick: () => void; children: React.ReactNode; badge?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={badge ? `${label} (${badge} etkin)` : label}
      className="relative grid size-10 place-items-center rounded-lg text-white/85 transition-colors hover:bg-white/[0.08] hover:text-white"
    >
      {children}
      {!!badge && (
        <span className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-accent text-[0.6rem] font-bold text-accent-ink" aria-hidden="true">
          {badge}
        </span>
      )}
    </button>
  );
}

export function MenuHeader(p: Props) {
  return (
    <header className="menu-header sticky top-0 z-40 shadow-[0_1px_0_rgb(255_255_255/0.04),0_8px_24px_-16px_rgb(0_0_0/0.6)]">
      <div className="mx-auto flex h-16 w-full max-w-[80rem] items-center gap-2 px-4 sm:px-6 md:h-[4.5rem] lg:px-8">
        <span className="-ml-2 hidden md:block">
          <IconBtn label="Kategoriler" onClick={p.onCategories}>
            <LuMenu className="size-[1.3rem]" aria-hidden="true" />
          </IconBtn>
        </span>
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            p.onHome();
          }}
          className="min-w-0 md:ml-1"
          aria-label={`${p.restaurant.name} — sayfanın başı`}
        >
          <BrandMark restaurant={p.restaurant} />
        </a>

        <nav aria-label="Sayfa bölümleri" className="ml-auto hidden items-center gap-1 md:flex lg:gap-3">
          <NavLink label="Ana Sayfa" icon={LuHouse} href="#" active={p.active === "home"} onClick={p.onHome} />
          <NavLink label="Menü" icon={LuBookOpen} href="#menu" active={p.active === "menu"} onClick={p.onMenu} />
          <NavLink label="İletişim" icon={LuMessageCircle} href="#iletisim" active={p.active === "contact"} onClick={p.onContact} />
        </nav>

        <div className="ml-auto flex items-center gap-0.5 md:ml-6">
          {p.showSearch && (
            <span className="hidden md:block">
              <IconBtn label="Menüde ara" onClick={p.onSearch}>
                <LuSearch className="size-[1.15rem]" aria-hidden="true" />
              </IconBtn>
            </span>
          )}
          <IconBtn label="Filtrele" onClick={p.onFilters} badge={p.filterCount}>
            <LuSlidersHorizontal className="size-[1.15rem]" aria-hidden="true" />
          </IconBtn>
        </div>
      </div>
    </header>
  );
}
