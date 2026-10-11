/**
 * Ürün kartları (referans görseldeki gibi): üstte yemek fotoğrafı, altında ad, açıklama,
 * turuncu fiyat ve ok. Fotoğrafı olmayan ürünler için gri kutu yerine sıcak renkli bir
 * zemin üzerinde kategori ikonu ya da kompakt satır kartı kullanılır.
 */
import type { MouseEvent } from "react";
import { LuChevronRight } from "react-icons/lu";
import { BADGE_LABEL, productIcon } from "../../shared/catalog";
import { foldTurkish, formatPrice } from "../../shared/format";
import type { BadgeKey, PublicProduct } from "../../shared/types";
import { CategoryIcon } from "../ui/icons";
import { Img } from "../ui/Img";

export type OpenHandler = (p: PublicProduct, e: MouseEvent) => void;

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function Price({ product, className = "" }: { product: PublicProduct; className?: string }) {
  if (product.isSoldOut) {
    return (
      <span className={cx("shrink-0 font-semibold text-ink-3", className)}>
        Tükendi<span className="sr-only">, fiyatı {formatPrice(product.priceCents)}</span>
      </span>
    );
  }
  return <span className={cx("shrink-0 font-semibold tabular text-accent-text", className)}>{formatPrice(product.priceCents)}</span>;
}

/** Fotoğrafın üzerindeki küçük etiketler (en fazla iki) */
function PhotoBadges({ product }: { product: PublicProduct }) {
  if (product.isSoldOut) {
    return <span className="absolute left-2.5 top-2.5 rounded-full bg-black/70 px-2.5 py-1 text-[0.7rem] font-semibold text-white">Tükendi</span>;
  }
  const order: BadgeKey[] = ["sef", "yeni", "aci", "vegan", "vejetaryen", "glutensiz"];
  const shown = order.filter((b) => product.badges.includes(b)).slice(0, 2);
  if (!shown.length) return null;
  return (
    <span className="absolute left-2.5 top-2.5 flex flex-wrap gap-1.5">
      {shown.map((b) => (
        <span
          key={b}
          className={cx(
            "rounded-full px-2 py-0.5 text-[0.68rem] font-semibold shadow-sm backdrop-blur-sm",
            b === "sef" || b === "yeni" ? "bg-accent text-accent-ink" : "bg-white/90 text-[#1b1f27]",
          )}
        >
          {BADGE_LABEL[b]}
        </span>
      ))}
    </span>
  );
}

/** Fotoğrafsız ürün için ikon: önce ürün adına uygun ikon, yoksa kategori ikonu */
export function fallbackIcon(p: PublicProduct, categoryIcon: string): string {
  return productIcon(foldTurkish(p.name), categoryIcon);
}

export function PhotoFallback({ icon, className = "" }: { icon: string; className?: string }) {
  return (
    <div className={cx("photo-fallback grid place-items-center", className)} aria-hidden="true">
      <CategoryIcon name={icon} className="size-[34%] max-h-24 drop-shadow-[0_8px_14px_rgb(0_0_0/0.18)]" />
    </div>
  );
}

function Chevron() {
  return (
    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-raised text-ink-3 transition-colors group-hover:bg-accent group-hover:text-accent-ink" aria-hidden="true">
      <LuChevronRight className="size-4" />
    </span>
  );
}

interface CardProps {
  product: PublicProduct;
  icon: string;
  onOpen: OpenHandler;
  /** featured: öne çıkanlar (telefonda geniş yatay kart); grid: kategori ızgarası */
  layout?: "featured" | "grid";
  priority?: boolean;
}

function ariaLabel(p: PublicProduct) {
  return `${p.name}, ${p.isSoldOut ? "tükendi" : formatPrice(p.priceCents)}. Ayrıntıları göster`;
}

/** Fotoğraflı ürün kartı */
export function ProductCard({ product: p, icon, onOpen, layout = "grid", priority }: CardProps) {
  const featured = layout === "featured";
  return (
    <a
      href={`?urun=${encodeURIComponent(p.slug)}`}
      onClick={(e) => onOpen(p, e)}
      aria-label={ariaLabel(p)}
      data-urun={p.slug}
      className={cx(
        "group flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-card transition-[box-shadow,transform] duration-300 ease-[var(--ease-soft)]",
        "hover:-translate-y-0.5 hover:shadow-card-hover",
      )}
    >
      <div className={cx("relative overflow-hidden bg-raised", featured ? "aspect-[12/5] md:aspect-[16/9]" : "aspect-[4/3] sm:aspect-[16/9]")}>
        {p.image ? (
          <Img
            image={p.image}
            alt=""
            priority={priority}
            sizes={featured ? "(min-width: 1024px) 300px, (min-width: 768px) 45vw, 85vw" : "(min-width: 1024px) 300px, (min-width: 768px) 33vw, 50vw"}
            className={cx("size-full object-cover transition-transform duration-700 ease-[var(--ease-soft)] group-hover:scale-[1.04]", p.isSoldOut && "grayscale-[45%]")}
          />
        ) : (
          <PhotoFallback icon={fallbackIcon(p, icon)} className="size-full" />
        )}
        <PhotoBadges product={p} />
      </div>
      <div className={cx("flex flex-1 flex-col", featured ? "p-4" : "p-3 sm:p-4")}>
        <h3 className={cx("font-display font-semibold leading-snug text-ink", featured ? "text-base" : "line-clamp-2 text-[0.9rem] sm:line-clamp-1 sm:text-[0.95rem]")}>{p.name}</h3>
        {p.description && (
          <p className={cx("mt-1 line-clamp-2 leading-relaxed text-ink-3", featured ? "text-[0.82rem]" : "text-[0.75rem] sm:text-[0.8rem]")}>{p.description}</p>
        )}
        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <Price product={p} className={featured ? "text-base" : "text-[0.9rem] sm:text-[0.95rem]"} />
          <Chevron />
        </div>
      </div>
    </a>
  );
}

/** Fotoğrafı olmayan ürünler için kompakt satır kartı (ör. çay, ayran) */
export function CompactCard({ product: p, icon, onOpen }: CardProps) {
  return (
    <a
      href={`?urun=${encodeURIComponent(p.slug)}`}
      onClick={(e) => onOpen(p, e)}
      aria-label={ariaLabel(p)}
      data-urun={p.slug}
      className={cx(
        "group flex items-center gap-3.5 rounded-xl border border-line bg-surface p-3 shadow-card transition-shadow duration-300 hover:shadow-card-hover sm:p-3.5",
        p.isSoldOut && "opacity-70",
      )}
    >
      <span className="photo-fallback grid size-12 shrink-0 place-items-center rounded-full sm:size-[3.25rem]" aria-hidden="true">
        <CategoryIcon name={fallbackIcon(p, icon)} className="size-7" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-[0.95rem] font-semibold text-ink">{p.name}</span>
        {p.description && <span className="block truncate text-[0.8rem] text-ink-3">{p.description}</span>}
      </span>
      <Price product={p} className="text-[0.95rem]" />
      <Chevron />
    </a>
  );
}

/** Kategori içeriği: önce fotoğraflı kartlar, ardından fotoğrafsız ürünler kompakt satırlar hâlinde */
export function ProductGrid({ products, icon, onOpen, iconFor }: { products: PublicProduct[]; icon: string; onOpen: OpenHandler; iconFor?: (p: PublicProduct) => string }) {
  const withPhoto = products.filter((p) => p.image);
  const withoutPhoto = products.filter((p) => !p.image);
  return (
    <>
      {withPhoto.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4 lg:gap-6">
          {withPhoto.map((p) => (
            <li key={p.id}>
              <ProductCard product={p} icon={iconFor?.(p) ?? icon} onOpen={onOpen} />
            </li>
          ))}
        </ul>
      )}
      {withoutPhoto.length > 0 && (
        <ul className={cx("grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4", withPhoto.length > 0 && "mt-4 sm:mt-5")}>
          {withoutPhoto.map((p) => (
            <li key={p.id}>
              <CompactCard product={p} icon={iconFor?.(p) ?? icon} onOpen={onOpen} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
