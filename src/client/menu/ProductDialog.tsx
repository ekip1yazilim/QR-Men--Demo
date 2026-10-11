import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { LuCircleAlert, LuX } from "react-icons/lu";
import { BADGE_LABEL } from "../../shared/catalog";
import type { ImageCredit, PublicProduct } from "../../shared/types";
import { CategoryIcon } from "../ui/icons";
import { Img } from "../ui/Img";
import { PhotoFallback, Price, cx, fallbackIcon } from "./ProductCard";

export function CreditLine({ credit, className = "" }: { credit: ImageCredit; className?: string }) {
  return (
    <p className={cx("text-[0.72rem] leading-relaxed text-ink-3", className)}>
      Fotoğraf: {credit.author} ·{" "}
      {credit.licenseUrl ? (
        <a href={credit.licenseUrl} target="_blank" rel="noopener noreferrer license" className="underline underline-offset-2 hover:text-ink-2">
          {credit.license}
        </a>
      ) : (
        credit.license
      )}
      {credit.sourceUrl && (
        <>
          {" · "}
          <a href={credit.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-ink-2">
            Wikimedia Commons
          </a>
        </>
      )}
    </p>
  );
}

interface Props {
  product: PublicProduct | null;
  categoryName: string;
  categoryIcon: string;
  /** Sunucu tarafında açık render edildi mi (paylaşılan ürün bağlantısı) */
  ssrOpen: boolean;
  onClose: () => void;
}

/**
 * Ürün ayrıntıları: telefonda alttan açılan sayfa (aşağı kaydırarak kapanır),
 * geniş ekranda ortalanmış pencere. Yalnızca bilgi gösterir; sipariş veya sepet yoktur.
 */
export function ProductDialog({ product, categoryName, categoryIcon, ssrOpen, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startY: number; dy: number; active: boolean } | null>(null);
  /** Sunucuda açık gelen pencereyi modal moda geçirirken oluşan "close" olayını yok say */
  const ignoreClose = useRef(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (product) {
      let modal = false;
      try {
        modal = dialog.matches(":modal");
      } catch {
        /* eski tarayıcılar */
      }
      if (dialog.open && !modal) {
        ignoreClose.current = true;
        dialog.close();
      }
      if (!dialog.open) dialog.showModal();
      panelRef.current?.scrollTo({ top: 0 });
    } else if (dialog.open) {
      dialog.close();
    }
  }, [product]);

  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.pointerType === "mouse") return;
    const panel = panelRef.current;
    if (!panel || panel.scrollTop > 0) return;
    drag.current = { startY: e.clientY, dy: 0, active: true };
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    const panel = panelRef.current;
    if (!d?.active || !panel) return;
    d.dy = Math.max(0, e.clientY - d.startY);
    if (d.dy > 0) {
      panel.style.transition = "none";
      panel.style.transform = `translateY(${d.dy}px)`;
    }
  };
  const onPointerUp = () => {
    const d = drag.current;
    const panel = panelRef.current;
    drag.current = null;
    if (!d || !panel) return;
    panel.style.transition = "transform .25s cubic-bezier(.32,.72,0,1)";
    if (d.dy > 110) {
      panel.style.transform = "translateY(100%)";
      window.setTimeout(() => {
        panel.style.transform = "";
        panel.style.transition = "";
        onClose();
      }, 200);
    } else {
      panel.style.transform = "";
    }
  };

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby="urun-baslik"
      open={ssrOpen || undefined}
      onClose={() => {
        if (ignoreClose.current) {
          ignoreClose.current = false;
          return;
        }
        if (product) onClose();
      }}
      onClick={(e) => {
        // Arka plana tıklayınca kapat
        if (e.target === ref.current) onClose();
      }}
    >
      {product && (
        <div
          ref={panelRef}
          className="sheet-panel relative rounded-t-3xl bg-surface text-ink shadow-float md:rounded-3xl"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="pointer-events-none absolute inset-x-0 top-2 z-10 flex justify-center md:hidden" aria-hidden="true">
            <span className="h-1.5 w-11 rounded-full bg-white/70 shadow-sm" />
          </div>

          <div className={cx("relative overflow-hidden rounded-t-3xl bg-raised", product.image ? "aspect-[4/3] sm:aspect-[16/10]" : "aspect-[2/1] sm:aspect-[5/2]")}>
            {product.image ? (
              <Img
                image={product.image}
                alt={product.name}
                sizes="(min-width: 768px) 576px, 100vw"
                className={cx("size-full object-cover", product.isSoldOut && "grayscale-[45%]")}
                priority
              />
            ) : (
              <PhotoFallback icon={fallbackIcon(product, categoryIcon)} className="size-full" />
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 z-10 grid size-10 place-items-center rounded-full bg-white/95 text-[#1b1f27] shadow-lift transition-transform hover:scale-105"
            aria-label="Kapat"
          >
            <LuX className="size-5" aria-hidden="true" />
          </button>

          <div className="px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5 sm:px-7 sm:pb-7">
            <p className="flex items-center gap-2 text-[0.8rem] font-medium text-ink-3">
              <CategoryIcon name={categoryIcon} className="size-5" />
              {categoryName}
            </p>
            <div className="mt-2 flex items-start justify-between gap-4">
              <h2 id="urun-baslik" tabIndex={-1} autoFocus className="font-display text-[1.45rem] font-semibold leading-tight text-ink outline-none sm:text-[1.6rem]">
                {product.name}
              </h2>
              {!product.isSoldOut && <Price product={product} className="pt-1 text-[1.2rem] sm:text-[1.3rem]" />}
            </div>

            {product.isSoldOut && (
              <p className="mt-4 flex items-start gap-2.5 rounded-xl bg-raised px-4 py-3 text-sm text-ink-2">
                <LuCircleAlert className="mt-0.5 size-4 shrink-0 text-accent-text" aria-hidden="true" />
                <span>Bu ürün şu an tükendi. Benzer bir seçenek için garsonumuza danışabilirsiniz.</span>
              </p>
            )}

            {product.badges.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-2" aria-label="Ürün özellikleri">
                {product.badges.map((b) => (
                  <li
                    key={b}
                    className={cx(
                      "rounded-full px-3 py-1 text-xs font-semibold",
                      b === "sef" || b === "yeni" ? "bg-tint text-accent-text" : "bg-raised text-ink-2",
                    )}
                  >
                    {BADGE_LABEL[b]}
                  </li>
                ))}
              </ul>
            )}

            {product.description && (
              <div className="mt-5">
                <h3 className="text-[0.8rem] font-semibold uppercase tracking-[0.08em] text-ink-3">İçerik</h3>
                <p className="mt-1.5 whitespace-pre-line text-[0.95rem] leading-relaxed text-ink-2">{product.description}</p>
              </div>
            )}

            {(product.allergens || product.calories !== null) && (
              <dl className="mt-5 divide-y divide-line rounded-xl border border-line text-sm">
                {product.allergens && (
                  <div className="flex gap-4 px-4 py-3">
                    <dt className="w-24 shrink-0 font-medium text-ink-3">Alerjenler</dt>
                    <dd className="text-ink-2">{product.allergens}</dd>
                  </div>
                )}
                {product.calories !== null && (
                  <div className="flex gap-4 px-4 py-3">
                    <dt className="w-24 shrink-0 font-medium text-ink-3">Enerji</dt>
                    <dd className="tabular text-ink-2">{product.calories} kcal</dd>
                  </div>
                )}
              </dl>
            )}

            {product.image?.credit && <CreditLine credit={product.image.credit} className="mt-5" />}
          </div>
        </div>
      )}
    </dialog>
  );
}
