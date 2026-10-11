import { useEffect, useMemo, useState } from "react";
import { LuChevronRight, LuPencil, LuPlus, LuSearch, LuSearchX, LuStar, LuTrash2, LuUtensils, LuX } from "react-icons/lu";
import { formatPrice } from "../../../shared/format";
import type { Category, Product } from "../../../shared/types";
import { CategoryIcon } from "../../ui/icons";
import { Img } from "../../ui/Img";
import { api, ApiError } from "../lib/api";
import { useDebounced, useResource } from "../lib/hooks";
import { Link, useRouter } from "../lib/router";
import { useFeedback } from "../ui/feedback";
import { Button, ButtonLink, EmptyState, ErrorState, IconButton, PageHeader, Panel, Pill, SkeletonRows } from "../ui/primitives";

const STATUS_OPTIONS = [
  { value: "", label: "Tüm durumlar" },
  { value: "active", label: "Menüde görünenler" },
  { value: "inactive", label: "Gizli (pasif)" },
  { value: "featured", label: "Öne çıkanlar" },
  { value: "soldout", label: "Tükenenler" },
  { value: "noimage", label: "Fotoğrafı olmayanlar" },
];

export function Thumb({ product, icon, size = "size-12" }: { product: Product; icon: string; size?: string }) {
  return (
    <span className={`relative block shrink-0 overflow-hidden rounded-xl bg-raised ring-1 ring-line ${size}`}>
      {product.image ? (
        <Img image={product.image} alt="" sizes="96px" className="size-full object-cover" />
      ) : (
        <span className="grid size-full place-items-center">
          <CategoryIcon name={icon} className="size-[55%]" />
        </span>
      )}
    </span>
  );
}

export function StatusPills({ p }: { p: Product }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {p.isActive ? <Pill tone="green">Menüde</Pill> : <Pill tone="gray">Gizli</Pill>}
      {p.isSoldOut && <Pill tone="red">Tükendi</Pill>}
      {p.isFeatured && (
        <Pill tone="orange" icon={LuStar}>
          Öne çıkan
        </Pill>
      )}
    </div>
  );
}

export function Products() {
  const { search, navigate } = useRouter();
  const { toast, confirm } = useFeedback();
  const [q, setQ] = useState(search.get("q") ?? "");
  const category = search.get("kategori") ?? "";
  const status = search.get("durum") ?? "";
  const debouncedQ = useDebounced(q.trim(), 250);

  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(window.location.search);
    if (value) params.set(key, value);
    else params.delete(key);
    const qs = params.toString();
    void navigate(`/yonetim/urunler${qs ? `?${qs}` : ""}`, { replace: true });
  };

  useEffect(() => {
    if ((search.get("q") ?? "") !== debouncedQ) setParam("q", debouncedQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);

  const query = new URLSearchParams();
  if (debouncedQ) query.set("q", debouncedQ);
  if (category) query.set("kategori", category);
  if (status) query.set("durum", status);
  const products = useResource<{ products: Product[] }>(`/urunler?${query.toString()}`);
  const cats = useResource<{ categories: Category[] }>("/kategoriler");
  const catMap = useMemo(() => new Map((cats.data?.categories ?? []).map((c) => [c.id, c])), [cats.data]);
  const filtered = !!(debouncedQ || category || status);
  const list = products.data?.products ?? [];

  const remove = async (p: Product) => {
    const ok = await confirm({
      title: `“${p.name}” silinsin mi?`,
      message: "Ürün menüden ve yönetim panelinden kalıcı olarak silinir. Sadece geçici olarak kaldırmak istiyorsanız ürünü gizleyebilirsiniz.",
      confirmLabel: "Ürünü sil",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await api("DELETE", `/urunler/${p.id}`);
      products.setData({ products: list.filter((x) => x.id !== p.id) });
      toast(`“${p.name}” silindi.`);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Ürün silinemedi.", "error");
    }
  };

  const noCategories = cats.data && cats.data.categories.length === 0;

  return (
    <>
      <PageHeader
        title="Ürünler"
        description="Menüdeki tüm ürünleri ekleyin, düzenleyin, gizleyin veya silin."
        actions={
          <ButtonLink to="/yonetim/urunler/yeni" variant="primary" icon={LuPlus}>
            Yeni ürün
          </ButtonLink>
        }
      />

      <div className="mb-4 grid gap-2.5 sm:grid-cols-[1fr_13rem_13rem]">
        <div className="relative">
          <LuSearch className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
          <input
            type="search"
            className="field h-11 pl-10"
            placeholder="Ürün adı veya açıklama ara"
            aria-label="Ürün ara"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select className="field h-11" aria-label="Kategoriye göre filtrele" value={category} onChange={(e) => setParam("kategori", e.target.value)}>
          <option value="">Tüm kategoriler</option>
          {(cats.data?.categories ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select className="field h-11" aria-label="Duruma göre filtrele" value={status} onChange={(e) => setParam("durum", e.target.value)}>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {products.loading && !products.data ? (
        <SkeletonRows rows={7} className="h-[4.5rem]" />
      ) : products.error ? (
        <ErrorState message={products.error.message} onRetry={products.reload} />
      ) : list.length === 0 ? (
        <Panel>
          {filtered ? (
            <EmptyState
              icon={LuSearchX}
              title="Filtreyle eşleşen ürün yok"
              text="Arama kelimesini veya filtreleri değiştirmeyi deneyin."
              action={
                <Button
                  icon={LuX}
                  onClick={() => {
                    setQ("");
                    void navigate("/yonetim/urunler", { replace: true });
                  }}
                >
                  Filtreleri temizle
                </Button>
              }
            />
          ) : noCategories ? (
            <EmptyState
              icon={LuUtensils}
              title="Önce bir kategori oluşturun"
              text="Her ürün bir kategoriye bağlıdır. Örneğin “Izgaralar” kategorisini oluşturup ürünlerinizi ekleyebilirsiniz."
              action={<ButtonLink to="/yonetim/kategoriler" variant="primary">Kategorilere git</ButtonLink>}
            />
          ) : (
            <EmptyState
              icon={LuUtensils}
              title="Henüz ürün yok"
              text="İlk ürününüzü ekleyin; fotoğrafı, açıklaması ve fiyatıyla menüde hemen görünür."
              action={<ButtonLink to="/yonetim/urunler/yeni" variant="primary" icon={LuPlus}>İlk ürünü ekle</ButtonLink>}
            />
          )}
        </Panel>
      ) : (
        <>
          <p className="mb-2.5 text-sm text-ink-3" aria-live="polite">
            {list.length} ürün {filtered ? "listeleniyor" : "toplam"}
          </p>

          {/* Masaüstü tablo */}
          <Panel padded={false} className="hidden overflow-hidden md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-xs font-semibold text-ink-3">
                <tr>
                  <th className="px-5 py-3 font-semibold">Ürün</th>
                  <th className="px-3 py-3 font-semibold">Kategori</th>
                  <th className="px-3 py-3 text-right font-semibold">Fiyat</th>
                  <th className="px-3 py-3 font-semibold">Durum</th>
                  <th className="px-5 py-3 text-right font-semibold">
                    <span className="sr-only">İşlemler</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.map((p) => {
                  const c = catMap.get(p.categoryId);
                  return (
                    <tr key={p.id} className="transition-colors hover:bg-raised/60">
                      <td className="px-5 py-3">
                        <Link to={`/yonetim/urunler/${p.id}`} className="flex items-center gap-3.5">
                          <Thumb product={p} icon={c?.icon ?? "utensils"} />
                          <span className="min-w-0">
                            <span className="block font-semibold text-ink">{p.name}</span>
                            <span className="line-clamp-1 max-w-md text-[0.8rem] text-ink-3">{p.description || "Açıklama eklenmemiş"}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-ink-2">{c?.name ?? "—"}</td>
                      <td className="px-3 py-3 text-right font-semibold tabular text-ink">{formatPrice(p.priceCents)}</td>
                      <td className="px-3 py-3">
                        <StatusPills p={p} />
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-0.5">
                          <IconButton icon={LuPencil} label={`${p.name} ürününü düzenle`} onClick={() => void navigate(`/yonetim/urunler/${p.id}`)} />
                          <IconButton icon={LuTrash2} tone="danger" label={`${p.name} ürününü sil`} onClick={() => void remove(p)} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Panel>

          {/* Mobil liste */}
          <ul className="space-y-2.5 md:hidden">
            {list.map((p) => {
              const c = catMap.get(p.categoryId);
              return (
                <li key={p.id}>
                  <Link to={`/yonetim/urunler/${p.id}`} className="flex items-center gap-3 rounded-2xl bg-surface p-3 ring-1 ring-line">
                    <Thumb product={p} icon={c?.icon ?? "utensils"} size="size-16" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate font-semibold text-ink">{p.name}</span>
                        <span className="shrink-0 text-sm font-semibold tabular">{formatPrice(p.priceCents)}</span>
                      </span>
                      <span className="mb-1.5 block text-xs text-ink-3">{c?.name}</span>
                      <StatusPills p={p} />
                    </span>
                    <LuChevronRight className="size-4 shrink-0 text-ink-3" aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}
