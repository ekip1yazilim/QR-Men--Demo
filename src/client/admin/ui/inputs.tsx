/** Özel giriş bileşenleri: görsel yükleyici, fiyat alanı, sıralanabilir liste, ikon seçici */
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as RPointerEvent, type ReactNode } from "react";
import { LuGripVertical, LuImagePlus, LuRefreshCw, LuTrash2 } from "react-icons/lu";
import { CATEGORY_ICONS } from "../../../shared/catalog";
import type { ImageKind, ImageRef } from "../../../shared/types";
import { CategoryIcon } from "../../ui/icons";
import { Img } from "../../ui/Img";
import { ApiError, MAX_UPLOAD_MB, uploadImage } from "../lib/api";
import { cx } from "./primitives";

// ---------------------------------------------------------------------------
// Görsel yükleyici
// ---------------------------------------------------------------------------
interface UploaderProps {
  kind: ImageKind;
  value: ImageRef | null;
  onChange: (v: ImageRef | null) => void;
  label: string;
  hint?: string;
  error?: string;
  aspect?: "square" | "photo" | "wide";
}

export function ImageUploader({ kind, value, onChange, label, hint, error, aspect = "photo" }: UploaderProps) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [over, setOver] = useState(false);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const pick = () => input.current?.click();

  const handle = async (file: File | undefined) => {
    if (!file) return;
    setLocalError(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    setProgress(0);
    try {
      const ref = await uploadImage(file, kind, setProgress);
      onChange(ref);
    } catch (err) {
      setLocalError(err instanceof ApiError ? err.message : "Görsel yüklenemedi.");
    } finally {
      setProgress(null);
      setPreview(null);
      if (input.current) input.current.value = "";
    }
  };

  const frame = aspect === "square" ? "aspect-square max-w-[11rem]" : aspect === "wide" ? "aspect-[16/7]" : "aspect-[4/3]";
  const shownError = localError ?? error;
  const hasImage = !!value || !!preview;

  return (
    <div>
      <p className="mb-1.5 text-sm font-semibold text-ink">{label}</p>
      <div
        className={cx(
          "group relative w-full overflow-hidden rounded-2xl transition-colors",
          frame,
          hasImage ? "bg-raised ring-1 ring-line" : "border-2 border-dashed",
          !hasImage && (over ? "border-ember bg-ember/5" : "border-line bg-raised hover:border-ink-3"),
          kind === "logo" && hasImage && "bg-white",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void handle(e.dataTransfer.files[0]);
        }}
      >
        {preview ? (
          <img src={preview} alt="" className={cx("size-full", kind === "logo" ? "object-contain p-3" : "object-cover")} />
        ) : value ? (
          <Img
            image={value}
            alt={label}
            sizes="400px"
            noPlaceholder={kind === "logo"}
            className={cx("size-full", kind === "logo" ? "object-contain p-3" : "object-cover")}
          />
        ) : (
          <button type="button" onClick={pick} className="flex size-full flex-col items-center justify-center gap-2 px-4 text-center">
            <LuImagePlus className="size-7 text-ink-3" aria-hidden="true" />
            <span className="text-sm font-semibold text-ink">Görsel seçin</span>
            <span className="text-xs text-ink-3">veya buraya sürükleyip bırakın</span>
          </button>
        )}

        {progress !== null && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-coal/60 text-white backdrop-blur-[2px]">
            <span className="text-sm font-semibold">{progress < 100 ? `Yükleniyor… %${progress}` : "İşleniyor…"}</span>
            <div className="h-1.5 w-2/3 overflow-hidden rounded-full bg-white/25">
              <div className="h-full rounded-full bg-ember transition-[width] duration-200" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
      </div>

      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="sr-only"
        tabIndex={-1}
        aria-label={`${label} dosyası seç`}
        onChange={(e) => void handle(e.target.files?.[0])}
      />

      {hasImage && progress === null && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={pick}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-surface px-3 text-[0.8rem] font-semibold text-ink ring-1 ring-line hover:bg-raised"
          >
            <LuRefreshCw className="size-3.5" aria-hidden="true" /> Değiştir
          </button>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[0.8rem] font-semibold text-bad hover:bg-bad/10"
          >
            <LuTrash2 className="size-3.5" aria-hidden="true" /> Kaldır
          </button>
        </div>
      )}
      {shownError ? (
        <p className="mt-1.5 text-[0.8rem] font-medium text-bad" role="alert">
          {shownError}
        </p>
      ) : (
        <p className="mt-1.5 text-[0.8rem] text-ink-3">{hint ?? `JPG, PNG veya WebP; en fazla ${MAX_UPLOAD_MB} MB.`}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fiyat alanı
// ---------------------------------------------------------------------------
export function PriceInput({
  value,
  onChange,
  onBlur,
  className,
  ...aria
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  className?: string;
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  "aria-label"?: string;
}) {
  return (
    <div className={cx("relative", className)}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-semibold text-ink-3" aria-hidden="true">
        ₺
      </span>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0,00"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className="field pl-8 tabular"
        {...aria}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sıralanabilir liste (fare, dokunmatik ve klavye)
// ---------------------------------------------------------------------------
export interface HandleProps {
  onPointerDown: (e: RPointerEvent<HTMLElement>) => void;
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
  "data-handle": string;
}

interface SortableProps<T> {
  items: T[];
  getId: (item: T) => number;
  onReorder: (ids: number[]) => void;
  renderItem: (item: T, handle: HandleProps, state: { dragging: boolean; index: number }) => ReactNode;
  className?: string;
  itemClassName?: string;
}

interface DragState {
  id: number;
  from: number;
  over: number;
  startY: number;
  startScroll: number;
  dy: number;
  tops: number[];
  heights: number[];
  gap: number;
}

export function SortableList<T>({ items, getId, onReorder, renderItem, className, itemClassName }: SortableProps<T>) {
  const rows = useRef(new Map<number, HTMLLIElement>());
  const drag = useRef<DragState | null>(null);
  const [, force] = useState(0);
  const rerender = () => force((n) => n + 1);
  const scrollTimer = useRef<number | null>(null);
  const lastY = useRef(0);

  const move = (from: number, to: number) => {
    const ids = items.map(getId);
    const [m] = ids.splice(from, 1);
    ids.splice(to, 0, m);
    onReorder(ids);
  };

  const update = () => {
    const d = drag.current;
    if (!d) return;
    d.dy = lastY.current + window.scrollY - (d.startY + d.startScroll);
    const center = d.tops[d.from] + d.heights[d.from] / 2 + d.dy;
    let over = 0;
    for (let i = 0; i < d.tops.length; i++) {
      if (i === d.from) continue;
      if (d.tops[i] + d.heights[i] / 2 < center) over++;
    }
    d.over = over;
    rerender();
  };

  const autoScroll = () => {
    if (!drag.current) return;
    const y = lastY.current;
    const edge = 80;
    let speed = 0;
    if (y < edge) speed = -Math.ceil((edge - y) / 6);
    else if (y > window.innerHeight - edge) speed = Math.ceil((y - (window.innerHeight - edge)) / 6);
    if (speed) {
      window.scrollBy(0, speed);
      update();
    }
    scrollTimer.current = window.requestAnimationFrame(autoScroll);
  };

  const end = () => {
    const d = drag.current;
    drag.current = null;
    if (scrollTimer.current) window.cancelAnimationFrame(scrollTimer.current);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", end);
    window.removeEventListener("pointercancel", end);
    document.body.style.userSelect = "";
    rerender();
    if (d && d.over !== d.from) move(d.from, d.over);
  };

  const onMove = (e: PointerEvent) => {
    lastY.current = e.clientY;
    update();
  };

  const start = (e: RPointerEvent<HTMLElement>, index: number) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const els = items.map((it) => rows.current.get(getId(it)));
    if (els.some((el) => !el)) return;
    const rects = els.map((el) => el!.getBoundingClientRect());
    drag.current = {
      id: getId(items[index]),
      from: index,
      over: index,
      startY: e.clientY,
      startScroll: window.scrollY,
      dy: 0,
      tops: rects.map((r) => r.top + window.scrollY),
      heights: rects.map((r) => r.height),
      gap: rects.length > 1 ? Math.max(0, rects[1].top - rects[0].bottom) : 0,
    };
    lastY.current = e.clientY;
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    scrollTimer.current = window.requestAnimationFrame(autoScroll);
    rerender();
  };

  const onKey = (e: KeyboardEvent<HTMLElement>, index: number) => {
    const delta = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
    if (!delta) return;
    e.preventDefault();
    const to = index + delta;
    if (to < 0 || to >= items.length) return;
    const id = getId(items[index]);
    move(index, to);
    window.requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-handle="${id}"]`)?.focus());
  };

  useEffect(() => () => end(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const d = drag.current;
  return (
    <ul className={className}>
      {items.map((item, index) => {
        const id = getId(item);
        let transform: string | undefined;
        const dragging = d?.id === id;
        if (d) {
          const shift = d.heights[d.from] + d.gap;
          if (dragging) transform = `translateY(${d.dy}px)`;
          else if (d.from < d.over && index > d.from && index <= d.over) transform = `translateY(${-shift}px)`;
          else if (d.from > d.over && index >= d.over && index < d.from) transform = `translateY(${shift}px)`;
        }
        return (
          <li
            key={id}
            ref={(el) => {
              if (el) rows.current.set(id, el);
              else rows.current.delete(id);
            }}
            className={cx(itemClassName, dragging && "relative z-10 shadow-float", d && !dragging && "transition-transform duration-200")}
            style={{ transform }}
          >
            {renderItem(
              item,
              {
                onPointerDown: (e) => start(e, index),
                onKeyDown: (e) => onKey(e, index),
                "data-handle": String(id),
              },
              { dragging, index },
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function DragHandle({ handle, label }: { handle: HandleProps; label: string }) {
  return (
    <button
      type="button"
      {...handle}
      aria-label={`${label} — sıralamak için sürükleyin ya da ok tuşlarını kullanın`}
      title="Sürükleyerek sıralayın"
      className="grid size-9 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-ink-3 hover:bg-raised hover:text-ink active:cursor-grabbing"
    >
      <LuGripVertical className="size-[1.1rem]" aria-hidden="true" />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Kategori ikonu seçici
// ---------------------------------------------------------------------------
export function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div role="radiogroup" aria-label="Kategori ikonu" className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
      {CATEGORY_ICONS.map((icon) => {
        const active = icon.key === value;
        return (
          <button
            key={icon.key}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={icon.label}
            title={icon.label}
            onClick={() => onChange(icon.key)}
            className={cx(
              "grid aspect-square place-items-center rounded-xl transition-colors",
              active ? "bg-ember/15 ring-2 ring-ember" : "bg-raised ring-1 ring-line hover:bg-surface",
            )}
          >
            <CategoryIcon name={icon.key} className="size-7" />
          </button>
        );
      })}
    </div>
  );
}
