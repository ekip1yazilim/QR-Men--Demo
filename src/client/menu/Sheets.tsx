/** Menüdeki alt sayfalar: kategoriler, filtreler ve fotoğraf kaynakları */
import { useEffect, useId, useRef, type ReactNode } from "react";
import { LuCheck, LuChevronRight, LuMapPin, LuX } from "react-icons/lu";
import { BADGES } from "../../shared/catalog";
import type { BadgeKey, ImageCredit, PublicCategory } from "../../shared/types";
import { AllItemsMark, CategoryIcon } from "../ui/icons";
import { cx } from "./ProductCard";

function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="sheet sheet-sm"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className="sheet-panel rounded-t-3xl bg-surface text-ink shadow-float md:rounded-3xl">
          <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-line bg-surface px-5 py-4">
            <h2 id={titleId} className="font-display text-lg font-semibold">
              {title}
            </h2>
            <button type="button" onClick={onClose} aria-label="Kapat" className="-mr-1.5 grid size-9 place-items-center rounded-full text-ink-3 hover:bg-raised hover:text-ink">
              <LuX className="size-5" aria-hidden="true" />
            </button>
          </div>
          <div className="px-3 py-3">{children}</div>
          {footer && <div className="sticky bottom-0 border-t border-line bg-surface px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div>}
          {!footer && <div className="h-[max(0.5rem,env(safe-area-inset-bottom))]" />}
        </div>
      )}
    </dialog>
  );
}

export function CategorySheet({
  open,
  onClose,
  categories,
  active,
  totalCount,
  onSelect,
  onContact,
}: {
  open: boolean;
  onClose: () => void;
  categories: PublicCategory[];
  active: string;
  totalCount: number;
  onSelect: (view: string) => void;
  onContact: () => void;
}) {
  const row = (key: string, label: string, count: number, icon: ReactNode) => {
    const isActive = active === key;
    return (
      <li key={key}>
        <button
          type="button"
          onClick={() => onSelect(key)}
          aria-current={isActive ? "true" : undefined}
          className={cx("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors", isActive ? "bg-tint" : "hover:bg-raised")}
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-raised">{icon}</span>
          <span className={cx("flex-1 font-medium", isActive ? "text-accent-text" : "text-ink")}>{label}</span>
          <span className="text-sm text-ink-3 tabular">{count}</span>
          <LuChevronRight className="size-4 text-ink-3" aria-hidden="true" />
        </button>
      </li>
    );
  };
  return (
    <Sheet open={open} onClose={onClose} title="Kategoriler">
      <ul className="space-y-0.5">
        {row("tumu", "Tüm Ürünler", totalCount, <AllItemsMark className="size-6 text-accent" />)}
        {categories.map((c) => row(c.slug, c.name, c.products.length, <CategoryIcon name={c.icon} className="size-7" />))}
      </ul>
      <button
        type="button"
        onClick={onContact}
        className="mt-2 flex w-full items-center gap-3 rounded-xl border-t border-line px-3 pb-1 pt-4 text-left text-sm font-medium text-ink-2 hover:text-ink"
      >
        <LuMapPin className="size-4 text-accent-text" aria-hidden="true" />
        İletişim ve çalışma saatleri
      </button>
    </Sheet>
  );
}

export interface MenuFilters {
  badges: BadgeKey[];
  hideSoldOut: boolean;
}

export function FilterSheet({
  open,
  onClose,
  filters,
  onChange,
  resultCount,
}: {
  open: boolean;
  onClose: () => void;
  filters: MenuFilters;
  onChange: (f: MenuFilters) => void;
  resultCount: number;
}) {
  const toggle = (b: BadgeKey) =>
    onChange({ ...filters, badges: filters.badges.includes(b) ? filters.badges.filter((x) => x !== b) : [...filters.badges, b] });
  const any = filters.badges.length > 0 || filters.hideSoldOut;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Filtrele"
      footer={
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={!any}
            onClick={() => onChange({ badges: [], hideSoldOut: false })}
            className="h-11 rounded-xl px-4 text-sm font-semibold text-ink-2 hover:bg-raised disabled:opacity-40"
          >
            Temizle
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-11 flex-1 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink transition-[filter] hover:brightness-105"
          >
            {resultCount} ürünü göster
          </button>
        </div>
      }
    >
      <div className="px-2 pb-2">
        <p className="text-sm text-ink-3">Yalnızca seçtiğiniz özelliklerin hepsine sahip ürünler listelenir.</p>
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Ürün özellikleri">
          {BADGES.map((b) => {
            const on = filters.badges.includes(b.key);
            return (
              <button
                key={b.key}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(b.key)}
                className={cx(
                  "inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors",
                  on ? "bg-accent text-accent-ink" : "bg-raised text-ink-2 hover:text-ink",
                )}
              >
                {on && <LuCheck className="size-4" aria-hidden="true" />}
                {b.label}
              </button>
            );
          })}
        </div>
        <label className="mt-5 flex cursor-pointer items-center justify-between gap-4 rounded-xl bg-raised px-4 py-3">
          <span className="text-sm font-medium text-ink">Tükenen ürünleri gizle</span>
          <input
            type="checkbox"
            checked={filters.hideSoldOut}
            onChange={(e) => onChange({ ...filters, hideSoldOut: e.target.checked })}
            className="size-5 accent-[var(--c-accent)]"
          />
        </label>
      </div>
    </Sheet>
  );
}

export function CreditsSheet({ open, onClose, items }: { open: boolean; onClose: () => void; items: { label: string; credit: ImageCredit }[] }) {
  return (
    <Sheet open={open} onClose={onClose} title="Fotoğraf kaynakları">
      <div className="px-2 pb-2">
        <p className="text-sm text-ink-3">Menüdeki örnek fotoğraflar Wikimedia Commons'tan, belirtilen lisanslarla kullanılmıştır. Fotoğraflar kırpılmış ve yeniden boyutlandırılmıştır.</p>
        <ul className="mt-4 divide-y divide-line text-sm">
          {items.map(({ label, credit }) => (
            <li key={label} className="py-2.5">
              <p className="font-medium text-ink">{label}</p>
              <p className="mt-0.5 text-ink-3">
                {credit.author} ·{" "}
                {credit.licenseUrl ? (
                  <a href={credit.licenseUrl} target="_blank" rel="noopener noreferrer license" className="underline underline-offset-2">
                    {credit.license}
                  </a>
                ) : (
                  credit.license
                )}
                {credit.sourceUrl && (
                  <>
                    {" · "}
                    <a href={credit.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                      Kaynak
                    </a>
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </Sheet>
  );
}
