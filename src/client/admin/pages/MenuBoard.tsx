import { useEffect, useMemo, useState } from "react";
import { LuCheck, LuExternalLink, LuLoaderCircle, LuPencil, LuPlus, LuSearch, LuStar } from "react-icons/lu";
import { centsToInput, formatPrice, parsePriceInput, searchKey } from "../../../shared/format";
import { MAX_PRICE_CENTS } from "../../../shared/schemas";
import type { Category, Product } from "../../../shared/types";
import { CategoryIcon } from "../../ui/icons";
import { useBoot } from "../App";
import { api, ApiError } from "../lib/api";
import { useResource } from "../lib/hooks";
import { Link } from "../lib/router";
import { useFeedback } from "../ui/feedback";
import { DragHandle, SortableList } from "../ui/inputs";
import { ButtonLink, EmptyState, ErrorState, PageHeader, Panel, SkeletonRows, Switch, cx } from "../ui/primitives";
import { Thumb } from "./Products";

type Patch = Partial<Pick<Product, "isActive" | "isFeatured" | "isSoldOut" | "priceCents">>;

function InlinePrice({ product, onSave }: { product: Product; onSave: (cents: number) => Promise<boolean> }) {
  const [value, setValue] = useState(centsToInput(product.priceCents));
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  useEffect(() => setValue(centsToInput(product.priceCents)), [product.priceCents]);

  const commit = async () => {
    const cents = parsePriceInput(value);
    if (cents === null || cents > MAX_PRICE_CENTS) {
      setState("error");
      return;
    }
    if (cents === product.priceCents) {
      setValue(centsToInput(cents));
      setState("idle");
      return;
    }
    setState("saving");
    const ok = await onSave(cents);
    setState(ok ? "saved" : "error");
    if (ok) window.setTimeout(() => setState((s) => (s === "saved" ? "idle" : s)), 1800);
  };

  return (
    <div className="relative w-full max-w-[9.5rem]">
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-ink-3" aria-hidden="true">
        ₺
      </span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        aria-label={`${product.name} fiyatı`}
        aria-invalid={state === "error" || undefined}
        onChange={(e) => {
          setValue(e.target.value);
          if (state === "error") setState("idle");
        }}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setValue(centsToInput(product.priceCents));
            setState("idle");
          }
        }}
        className="field h-10 pl-7 pr-8 text-[0.92rem] font-semibold tabular"
      />
      <span className="absolute right-2.5 top-1/2 -translate-y-1/2" aria-live="polite">
        {state === "saving" && <LuLoaderCircle className="size-4 animate-spin text-ink-3" aria-label="Kaydediliyor" />}
        {state === "saved" && <LuCheck className="size-4 text-ok" aria-label="Kaydedildi" />}
      </span>
    </div>
  );
}

function StarToggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      title={on ? "Öne çıkanlardan kaldır" : "Öne çıkar"}
      onClick={() => onChange(!on)}
      className={cx("grid size-9 place-items-center rounded-lg transition-colors", on ? "bg-ember/15 text-ember-deep" : "text-ink-3 hover:bg-raised hover:text-ink")}
    >
      <LuStar className={cx("size-[1.1rem]", on && "fill-current")} aria-hidden="true" />
    </button>
  );
}

export function MenuBoard() {
  const boot = useBoot();
  const { toast } = useFeedback();
  const cats = useResource<{ categories: Category[] }>("/kategoriler");
  const prods = useResource<{ products: Product[] }>("/urunler");
  const [q, setQ] = useState("");
  const products = prods.data?.products ?? [];
  const categories = cats.data?.categories ?? [];

  const grouped = useMemo(() => {
    const needle = searchKey(q);
    return categories.map((c) => ({
      category: c,
      products: products.filter((p) => p.categoryId === c.id && (!needle || searchKey(p.name, p.description).includes(needle))),
    }));
  }, [categories, products, q]);

  const patch = async (p: Product, change: Patch, message: string): Promise<boolean> => {
    const prev = products;
    prods.setData({ products: products.map((x) => (x.id === p.id ? { ...x, ...change } : x)) });
    try {
      const res = await api<{ product: Product }>("PATCH", `/urunler/${p.id}`, change);
      prods.setData((d) => (d ? { products: d.products.map((x) => (x.id === p.id ? res.product : x)) } : d));
      toast(message);
      return true;
    } catch (err) {
      prods.setData({ products: prev });
      toast(err instanceof ApiError ? err.message : "Değişiklik kaydedilemedi.", "error");
      return false;
    }
  };

  const toggleCategory = async (c: Category, isActive: boolean) => {
    cats.setData({ categories: categories.map((x) => (x.id === c.id ? { ...x, isActive } : x)) });
    try {
      await api("PATCH", `/kategoriler/${c.id}`, { isActive });
      toast(isActive ? `“${c.name}” menüde gösteriliyor.` : `“${c.name}” ve ürünleri menüden gizlendi.`);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Kaydedilemedi.", "error");
      void cats.reload();
    }
  };

  const reorder = async (categoryId: number, ids: number[]) => {
    const byId = new Map(products.map((p) => [p.id, p]));
    const others = products.filter((p) => p.categoryId !== categoryId);
    const sorted = ids.map((id, i) => ({ ...byId.get(id)!, sortOrder: i }));
    prods.setData({ products: [...others, ...sorted] });
    try {
      await api("PUT", "/urunler/sirala", { categoryId, ids });
      toast("Ürün sıralaması kaydedildi.");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Sıralama kaydedilemedi.", "error");
      void prods.reload();
    }
  };

  const loading = (cats.loading && !cats.data) || (prods.loading && !prods.data);
  const error = cats.error ?? prods.error;

  return (
    <>
      <PageHeader
        title="Menü Yönetimi"
        description="Fiyatları ve ürün durumlarını tek ekrandan güncelleyin. Her değişiklik anında yayındaki menüye yansır."
        actions={
          <>
            <ButtonLink to={boot.menuUrl} external icon={LuExternalLink}>
              Menüyü önizle
            </ButtonLink>
            <ButtonLink to="/yonetim/urunler/yeni" variant="primary" icon={LuPlus}>
              Yeni ürün
            </ButtonLink>
          </>
        }
      />

      {loading ? (
        <SkeletonRows rows={6} className="h-20" />
      ) : error ? (
        <ErrorState
          message={error.message}
          onRetry={() => {
            void cats.reload();
            void prods.reload();
          }}
        />
      ) : categories.length === 0 ? (
        <Panel>
          <EmptyState
            icon={LuPlus}
            title="Menünüz henüz boş"
            text="Önce kategorileri oluşturun, ardından ürünleri ekleyin."
            action={<ButtonLink to="/yonetim/kategoriler" variant="primary">Kategori oluştur</ButtonLink>}
          />
        </Panel>
      ) : (
        <>
          <div className="relative mb-5 max-w-md">
            <LuSearch className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
            <input type="search" className="field h-11 pl-10" placeholder="Menüde ürün bul" aria-label="Menüde ürün bul" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {q && <p className="-mt-3 mb-4 text-sm text-ink-3">Arama sırasında sürükleyerek sıralama kapalıdır.</p>}

          <div className="space-y-5">
            {grouped
              .filter((g) => !q || g.products.length > 0)
              .map(({ category: c, products: list }) => (
                <Panel
                  key={c.id}
                  padded={false}
                  title={
                    <span className="flex items-center gap-2.5">
                      <CategoryIcon name={c.icon} className="size-6" />
                      {c.name}
                      <span className="text-sm font-medium text-ink-3">{list.length} ürün</span>
                    </span>
                  }
                  actions={
                    <div className="flex items-center gap-3">
                      <span className={cx("text-sm font-semibold", c.isActive ? "text-ok" : "text-ink-3")}>{c.isActive ? "Menüde" : "Gizli"}</span>
                      <Switch size="sm" hideLabel label={`${c.name} kategorisi menüde görünsün`} checked={c.isActive} onChange={(v) => void toggleCategory(c, v)} />
                      <ButtonLink to={`/yonetim/urunler/yeni?kategori=${c.id}`} size="sm" icon={LuPlus}>
                        Ürün ekle
                      </ButtonLink>
                    </div>
                  }
                >
                  {list.length === 0 ? (
                    <p className="px-6 py-6 text-sm text-ink-3">
                      Bu kategoride ürün yok.{" "}
                      <Link to={`/yonetim/urunler/yeni?kategori=${c.id}`} className="font-semibold text-ink underline underline-offset-2">
                        İlk ürünü ekleyin
                      </Link>
                    </p>
                  ) : (
                    <>
                      <div className="hidden grid-cols-[2.25rem_minmax(0,1fr)_9.5rem_4.5rem_4.5rem_4.5rem_2.25rem] items-center gap-3 border-b border-line px-4 py-2.5 text-xs font-semibold text-ink-3 md:grid">
                        <span />
                        <span>Ürün</span>
                        <span>Fiyat</span>
                        <span className="text-center">Menüde</span>
                        <span className="text-center">Öne çıkan</span>
                        <span className="text-center">Tükendi</span>
                        <span />
                      </div>
                      <SortableList
                        items={list}
                        getId={(p) => p.id}
                        onReorder={(ids) => (q ? undefined : void reorder(c.id, ids))}
                        className="divide-y divide-line"
                        itemClassName="bg-surface"
                        renderItem={(p, handle) => (
                          <div
                            className={cx(
                              "grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2.5 px-4 py-3 md:grid-cols-[2.25rem_minmax(0,1fr)_9.5rem_4.5rem_4.5rem_4.5rem_2.25rem]",
                              !p.isActive && "bg-raised/50",
                            )}
                          >
                            {q ? <span /> : <DragHandle handle={handle} label={p.name} />}
                            <Link to={`/yonetim/urunler/${p.id}`} className="flex min-w-0 items-center gap-3">
                              <Thumb product={p} icon={c.icon} size="size-11" />
                              <span className="min-w-0">
                                <span className={cx("block truncate font-semibold", p.isActive ? "text-ink" : "text-ink-3")}>{p.name}</span>
                                <span className="block truncate text-xs text-ink-3">
                                  {!p.isActive ? "Menüde gizli" : p.isSoldOut ? "Tükendi olarak görünüyor" : formatPrice(p.priceCents)}
                                </span>
                              </span>
                            </Link>
                            <span className="md:hidden">
                              <Link
                                to={`/yonetim/urunler/${p.id}`}
                                aria-label={`${p.name} ürününü düzenle`}
                                className="grid size-9 place-items-center rounded-lg text-ink-3 hover:bg-raised hover:text-ink"
                              >
                                <LuPencil className="size-[1.05rem]" aria-hidden="true" />
                              </Link>
                            </span>

                            <div className="col-span-3 flex flex-wrap items-center gap-x-5 gap-y-2 pl-12 md:contents md:pl-0">
                              <InlinePrice
                                product={p}
                                onSave={(cents) => patch(p, { priceCents: cents }, `“${p.name}” fiyatı ${formatPrice(cents)} olarak güncellendi.`)}
                              />
                              <label className="flex items-center gap-2 text-xs font-semibold text-ink-2 md:justify-center">
                                <span className="md:sr-only">Menüde</span>
                                <Switch
                                  size="sm"
                                  hideLabel
                                  label={`${p.name} menüde görünsün`}
                                  checked={p.isActive}
                                  onChange={(v) => void patch(p, { isActive: v }, v ? `“${p.name}” menüde gösteriliyor.` : `“${p.name}” menüden gizlendi.`)}
                                />
                              </label>
                              <span className="flex items-center gap-1 text-xs font-semibold text-ink-2 md:justify-center">
                                <span className="md:sr-only">Öne çıkan</span>
                                <StarToggle
                                  on={p.isFeatured}
                                  label={`${p.name} öne çıkan`}
                                  onChange={(v) => void patch(p, { isFeatured: v }, v ? `“${p.name}” öne çıkarıldı.` : `“${p.name}” öne çıkanlardan kaldırıldı.`)}
                                />
                              </span>
                              <label className="flex items-center gap-2 text-xs font-semibold text-ink-2 md:justify-center">
                                <span className="md:sr-only">Tükendi</span>
                                <Switch
                                  size="sm"
                                  hideLabel
                                  label={`${p.name} tükendi`}
                                  checked={p.isSoldOut}
                                  onChange={(v) => void patch(p, { isSoldOut: v }, v ? `“${p.name}” tükendi olarak işaretlendi.` : `“${p.name}” yeniden satışta.`)}
                                />
                              </label>
                              <span className="hidden md:block">
                                <Link
                                  to={`/yonetim/urunler/${p.id}`}
                                  aria-label={`${p.name} ürününü düzenle`}
                                  className="grid size-9 place-items-center rounded-lg text-ink-3 hover:bg-raised hover:text-ink"
                                >
                                  <LuPencil className="size-[1.05rem]" aria-hidden="true" />
                                </Link>
                              </span>
                            </div>
                          </div>
                        )}
                      />
                    </>
                  )}
                </Panel>
              ))}
          </div>
        </>
      )}
    </>
  );
}
