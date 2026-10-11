/**
 * Kategori ikonları: Microsoft Fluent Emoji 3D (MIT lisansı) — public/ikonlar/<anahtar>.webp
 * Arayüz ikonları ayrıca Lucide (react-icons/lu, ISC lisansı) ile çizilir.
 */
import { categoryIconUrl } from "../../shared/catalog";

export function CategoryIcon({ name, className, size }: { name: string; className?: string; size?: number }) {
  return (
    <img
      src={categoryIconUrl(name)}
      alt=""
      aria-hidden="true"
      width={size ?? 128}
      height={size ?? 128}
      decoding="async"
      draggable={false}
      className={["shrink-0 select-none object-contain", className].filter(Boolean).join(" ")}
      style={size ? { width: size, height: size } : undefined}
    />
  );
}

/** Restoranın logosu yokken kullanılan marka işareti: köz ve alev */
export function EmberMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true" focusable="false">
      <path
        d="M24 4c1.6 6.2-1.8 9.4-4.6 12.6C16.6 19.8 14 23 14 28.2 14 34.6 18.6 40 24 40s10-5.4 10-11.8c0-4-1.8-6.8-3.6-9.2-.5 2.6-1.9 4.6-4 5.6.9-6.4-.6-14.6-2.4-20.6Z"
        fill="currentColor"
      />
      <path d="M24 40c-2.9 0-5.2-2.6-5.2-5.8 0-3.6 2.7-5.4 4.3-8.2.9 2.3 3.1 3.6 3.6 6.4.2-1 .2-2 .1-3 1.6 1.4 2.4 3.1 2.4 4.8 0 3.2-2.3 5.8-5.2 5.8Z" fill="#ffd3a6" opacity=".9" />
      <rect x="9" y="42" width="30" height="2.6" rx="1.3" fill="currentColor" opacity=".55" />
    </svg>
  );
}

/** "Tüm Ürünler" kutucuğu: dört dolu kare (referanstaki turuncu ızgara ikonu) */
export function AllItemsMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <rect x="3" y="3" width="8" height="8" rx="2" fill="currentColor" />
      <rect x="13" y="3" width="8" height="8" rx="2" fill="currentColor" />
      <rect x="3" y="13" width="8" height="8" rx="2" fill="currentColor" />
      <rect x="13" y="13" width="8" height="8" rx="2" fill="currentColor" opacity=".55" />
    </svg>
  );
}
