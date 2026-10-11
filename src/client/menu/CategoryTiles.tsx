/** Referanstaki yatay kategori kutucukları: renkli ikon dairesi + etiket; seçili kutucuk turuncu tonlu */
import { useEffect, useRef } from "react";
import type { PublicCategory } from "../../shared/types";
import { AllItemsMark, CategoryIcon } from "../ui/icons";
import { cx } from "./ProductCard";
import { prefersReducedMotion } from "./hooks";

export const ALL_VIEW = "tumu";
export const FEATURED_VIEW = "one-cikanlar";

interface Props {
  categories: PublicCategory[];
  active: string | null;
  onSelect: (view: string) => void;
}

function Tile({ label, active, onClick, children, id }: { label: string; active: boolean; onClick: () => void; children: React.ReactNode; id: string }) {
  return (
    <a
      href={id === ALL_VIEW ? "?" : `?kategori=${encodeURIComponent(id)}`}
      data-tile={id}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        onClick();
      }}
      aria-current={active ? "true" : undefined}
      className={cx(
        "group flex h-full min-w-0 flex-col items-center justify-center gap-2.5 rounded-xl border px-2 py-3.5 text-center transition-[background-color,border-color,box-shadow] duration-200 md:py-3.5",
        active
          ? "border-transparent bg-tint shadow-[0_1px_2px_rgb(16_24_40/0.04)]"
          : "border-line bg-surface shadow-[0_1px_2px_rgb(16_24_40/0.03)] hover:border-[color-mix(in_srgb,var(--c-accent)_35%,var(--c-line))] hover:shadow-card",
      )}
    >
      <span
        className={cx(
          "grid size-12 place-items-center rounded-full transition-transform duration-300 group-hover:scale-105 md:size-12",
          active ? "bg-surface/70" : "bg-raised",
        )}
      >
        {children}
      </span>
      <span className={cx("block w-full truncate text-[0.8rem] md:text-[0.82rem]", active ? "font-semibold text-accent-text" : "font-medium text-ink-2")}>{label}</span>
    </a>
  );
}

export function CategoryTiles({ categories, active, onSelect }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scroller.current?.querySelector<HTMLElement>(`[data-tile="${active}"]`);
    const box = scroller.current;
    if (!el || !box || box.scrollWidth <= box.clientWidth) return;
    const left = el.offsetLeft - box.clientWidth / 2 + el.clientWidth / 2;
    box.scrollTo({ left, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [active]);

  return (
    <nav aria-label="Menü kategorileri" id="kategoriler" className="scroll-mt-24">
      <div ref={scroller} className="no-scrollbar -mx-4 overflow-x-auto px-4 py-1 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
        <div className="tile-row">
          <Tile id={ALL_VIEW} label="Tüm Ürünler" active={active === ALL_VIEW} onClick={() => onSelect(ALL_VIEW)}>
            <AllItemsMark className="size-7 text-accent" />
          </Tile>
          {categories.map((c) => (
            <Tile key={c.id} id={c.slug} label={c.name} active={active === c.slug} onClick={() => onSelect(c.slug)}>
              <CategoryIcon name={c.icon} className="size-8 md:size-[2.1rem]" />
            </Tile>
          ))}
        </div>
      </div>
    </nav>
  );
}
