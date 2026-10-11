import { useEffect, useMemo, useState } from "react";
import { LuArrowLeft, LuExternalLink, LuTrash2 } from "react-icons/lu";
import { BADGES } from "../../../shared/catalog";
import { accentStyle } from "../../../shared/color";
import { centsToInput, parsePriceInput } from "../../../shared/format";
import { fieldErrors, productInputSchema } from "../../../shared/schemas";
import type { BadgeKey, Category, ImageRef, Product, PublicProduct } from "../../../shared/types";
import { ProductCard } from "../../menu/ProductCard";
import { useBoot } from "../App";
import { api, ApiError } from "../lib/api";
import { useBeforeUnload, useResource } from "../lib/hooks";
import { Link, useRouter } from "../lib/router";
import { useFeedback } from "../ui/feedback";
import { ImageUploader, PriceInput } from "../ui/inputs";
import { Button, ButtonLink, ErrorState, Field, PageHeader, Panel, SaveBar, SkeletonRows, Switch, cx } from "../ui/primitives";

interface FormState {
  name: string;
  description: string;
  price: string;
  categoryId: number | "";
  image: ImageRef | null;
  isActive: boolean;
  isFeatured: boolean;
  isSoldOut: boolean;
  badges: BadgeKey[];
  allergens: string;
  calories: string;
}

function fromProduct(p: Product): FormState {
  return {
    name: p.name,
    description: p.description,
    price: centsToInput(p.priceCents),
    categoryId: p.categoryId,
    image: p.image,
    isActive: p.isActive,
    isFeatured: p.isFeatured,
    isSoldOut: p.isSoldOut,
    badges: p.badges,
    allergens: p.allergens,
    calories: p.calories === null ? "" : String(p.calories),
  };
}

const blank = (categoryId: number | ""): FormState => ({
  name: "",
  description: "",
  price: "",
  categoryId,
  image: null,
  isActive: true,
  isFeatured: false,
  isSoldOut: false,
  badges: [],
  allergens: "",
  calories: "",
});

/** Menüdeki kart önizlemesi için tema değişkenleri */
const PREVIEW_STYLE = Object.fromEntries(accentStyle("#F28C28", "light").split(";").map((kv) => kv.split(":") as [string, string]));

export function ProductForm({ id }: { id: number | null }) {
  const isNew = id === null;
  const boot = useBoot();
  const { navigate, setBlocker, search } = useRouter();
  const { toast, confirm } = useFeedback();
  const product = useResource<{ product: Product }>(isNew ? null : `/urunler/${id}`);
  const cats = useResource<{ categories: Category[] }>("/kategoriler");
  const categories = cats.data?.categories ?? [];

  const [initial, setInitial] = useState<FormState | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Formu ilk veriyle doldur
  useEffect(() => {
    if (form) return;
    if (isNew && cats.data) {
      const wanted = Number(search.get("kategori"));
      const first = categories.find((c) => c.id === wanted)?.id ?? categories[0]?.id ?? "";
      const f = blank(first);
      setInitial(f);
      setForm(f);
    } else if (!isNew && product.data) {
      const f = fromProduct(product.data.product);
      setInitial(f);
      setForm(f);
    }
  }, [isNew, cats.data, product.data, form, categories, search]);

  const dirty = useMemo(() => !!form && !!initial && JSON.stringify(form) !== JSON.stringify(initial), [form, initial]);
  useBeforeUnload(dirty);
  useEffect(() => {
    setBlocker(
      dirty
        ? () =>
            confirm({
              title: "Kaydedilmemiş değişiklikler var",
              message: "Bu sayfadan ayrılırsanız yaptığınız değişiklikler kaybolacak.",
              confirmLabel: "Kaydetmeden ayrıl",
              cancelLabel: "Sayfada kal",
              tone: "danger",
            })
        : null,
    );
    return () => setBlocker(null);
  }, [dirty, setBlocker, confirm]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => (f ? { ...f, [key]: value } : f));
    if (errors[key as string]) setErrors((e) => ({ ...e, [key as string]: "" }));
  };

  const payload = () => {
    if (!form) return null;
    const priceCents = parsePriceInput(form.price);
    return {
      name: form.name,
      description: form.description,
      priceCents: priceCents ?? Number.NaN,
      categoryId: form.categoryId === "" ? Number.NaN : form.categoryId,
      imageId: form.image?.id ?? null,
      isActive: form.isActive,
      isFeatured: form.isFeatured,
      isSoldOut: form.isSoldOut,
      badges: form.badges,
      allergens: form.allergens,
      calories: form.calories.trim() === "" ? null : Number(form.calories.replace(",", ".")),
    };
  };

  const mapErrors = (e: Record<string, string>) => {
    const out = { ...e };
    if (out.priceCents) {
      out.price = Number.isNaN(payload()?.priceCents) ? "Geçerli bir fiyat girin (ör. 180 veya 180,50)." : out.priceCents;
      delete out.priceCents;
    }
    if (out.imageId) (out.image = out.imageId), delete out.imageId;
    return out;
  };

  const save = async () => {
    const body = payload();
    if (!body) return;
    const parsed = productInputSchema.safeParse(body);
    if (!parsed.success) {
      setErrors(mapErrors(fieldErrors(parsed.error)));
      document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
      return;
    }
    setSaving(true);
    try {
      const res = isNew
        ? await api<{ product: Product }>("POST", "/urunler", parsed.data)
        : await api<{ product: Product }>("PUT", `/urunler/${id}`, parsed.data);
      const f = fromProduct(res.product);
      setInitial(f);
      setForm(f);
      setBlocker(null);
      toast(isNew ? `“${res.product.name}” eklendi ve menüde yayında.` : `“${res.product.name}” kaydedildi. Menü güncellendi.`);
      if (isNew) void navigate(`/yonetim/urunler`, { replace: false });
    } catch (err) {
      if (err instanceof ApiError) {
        if (Object.keys(err.fieldErrors).length) setErrors(mapErrors(err.fieldErrors));
        toast(err.message, "error");
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (isNew || !form) return;
    const ok = await confirm({
      title: `“${initial?.name}” silinsin mi?`,
      message: "Ürün kalıcı olarak silinir. Geçici olarak kaldırmak için “Menüde göster” anahtarını kapatabilirsiniz.",
      confirmLabel: "Ürünü sil",
      tone: "danger",
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await api("DELETE", `/urunler/${id}`);
      setBlocker(null);
      setInitial(form);
      toast(`“${initial?.name}” silindi.`);
      void navigate("/yonetim/urunler");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Ürün silinemedi.", "error");
      setDeleting(false);
    }
  };

  const back = (
    <Link to="/yonetim/urunler" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-2 hover:text-ink">
      <LuArrowLeft className="size-4" aria-hidden="true" /> Ürünler
    </Link>
  );

  if (product.error) return (<>{back}<ErrorState message={product.error.message} onRetry={product.reload} /></>);
  if (cats.error) return (<>{back}<ErrorState message={cats.error.message} onRetry={cats.reload} /></>);
  if (!form) return (<>{back}<SkeletonRows rows={5} className="h-24" /></>);

  if (categories.length === 0) {
    return (
      <>
        {back}
        <Panel>
          <div className="py-8 text-center">
            <p className="font-semibold">Ürün eklemek için önce bir kategori oluşturun.</p>
            <ButtonLink to="/yonetim/kategoriler" variant="primary" className="mt-4">
              Kategorilere git
            </ButtonLink>
          </div>
        </Panel>
      </>
    );
  }

  const cat = categories.find((c) => c.id === form.categoryId);
  const previewPrice = parsePriceInput(form.price);
  const preview: PublicProduct = {
    id: id ?? 0,
    categoryId: Number(form.categoryId) || 0,
    name: form.name.trim() || "Ürün adı",
    slug: "onizleme",
    description: form.description.trim(),
    priceCents: previewPrice ?? 0,
    image: form.image,
    isFeatured: form.isFeatured,
    isSoldOut: form.isSoldOut,
    badges: form.badges,
    allergens: form.allergens,
    calories: null,
  };
  const productSlug = product.data?.product.slug;

  return (
    <>
      {back}
      <PageHeader
        title={isNew ? "Yeni ürün" : initial?.name || "Ürünü düzenle"}
        description={isNew ? "Ürün kaydedildiği anda menüde görünür (Menüde göster açıksa)." : "Değişiklikler kaydedildiği anda yayındaki menüye yansır."}
        actions={
          !isNew && (
            <>
              {productSlug && initial?.isActive && (
                <ButtonLink to={`${boot.menuUrl}?urun=${encodeURIComponent(productSlug)}`} external icon={LuExternalLink}>
                  Menüde gör
                </ButtonLink>
              )}
              <Button variant="ghost" icon={LuTrash2} className="text-bad hover:bg-bad/10 hover:text-bad" loading={deleting} onClick={() => void remove()}>
                Sil
              </Button>
            </>
          )
        }
      />

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]"
      >
        <div className="space-y-5">
          <Panel title="Ürün bilgileri">
            <div className="space-y-5">
              <Field label="Ürün adı" required error={errors.name} counter={{ value: form.name.length, max: 80 }}>
                <input className="field" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Örn. Izgara Köfte" autoFocus={isNew} />
              </Field>
              <Field
                label="Açıklama"
                optional
                error={errors.description}
                counter={{ value: form.description.length, max: 400 }}
                hint="İçerik, porsiyon ve servis şekli. Menüde ürün adının altında iki satır, ayrıntıda tamamı görünür."
              >
                <textarea
                  className="field min-h-28 resize-y"
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="Örn. Dana ve kuzu karışık el yapımı köfte, piyaz ve közlenmiş biber eşliğinde."
                />
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Fiyat" required error={errors.price} hint="Örn. 180 veya 180,50">
                  <PriceInput
                    value={form.price}
                    onChange={(v) => set("price", v)}
                    onBlur={() => {
                      const c = parsePriceInput(form.price);
                      if (c !== null) set("price", centsToInput(c));
                    }}
                  />
                </Field>
                <Field label="Kategori" required error={errors.categoryId}>
                  <select className="field" value={form.categoryId} onChange={(e) => set("categoryId", e.target.value ? Number(e.target.value) : "")}>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.isActive ? "" : " (gizli)"}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>
          </Panel>

          <Panel title="Etiketler ve içerik bilgisi" description="Müşterilerin ürünü seçerken dikkat ettiği bilgiler">
            <div className="space-y-5">
              <fieldset>
                <legend className="mb-2 text-sm font-semibold">Etiketler</legend>
                <div className="flex flex-wrap gap-2">
                  {BADGES.map((b) => {
                    const on = form.badges.includes(b.key);
                    return (
                      <button
                        key={b.key}
                        type="button"
                        aria-pressed={on}
                        title={b.description}
                        onClick={() => set("badges", on ? form.badges.filter((x) => x !== b.key) : [...form.badges, b.key])}
                        className={cx(
                          "h-9 rounded-full px-3.5 text-sm font-semibold transition-colors",
                          on ? "bg-coal text-white" : "bg-surface text-ink-2 ring-1 ring-line hover:text-ink",
                        )}
                      >
                        {b.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              <div className="grid gap-5 sm:grid-cols-[1fr_11rem]">
                <Field label="Alerjenler" optional error={errors.allergens} hint="Örn. Gluten, süt ürünleri, yumurta">
                  <input className="field" value={form.allergens} onChange={(e) => set("allergens", e.target.value)} />
                </Field>
                <Field label="Enerji (kcal)" optional error={errors.calories}>
                  <input className="field tabular" inputMode="numeric" value={form.calories} onChange={(e) => set("calories", e.target.value.replace(/[^\d]/g, ""))} />
                </Field>
              </div>
            </div>
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel title="Fotoğraf">
            <ImageUploader
              kind="product"
              label="Ürün fotoğrafı"
              value={form.image}
              onChange={(img) => set("image", img)}
              error={errors.image}
              hint="Yatay (4:3) ve iyi ışıklı fotoğraflar en iyi sonucu verir. JPG, PNG veya WebP; en fazla 10 MB."
            />
          </Panel>

          <Panel title="Yayın durumu">
            <div className="space-y-5">
              <Switch checked={form.isActive} onChange={(v) => set("isActive", v)} label="Menüde göster" description="Kapalıyken ürün müşterilere görünmez (pasif)." />
              <Switch checked={form.isFeatured} onChange={(v) => set("isFeatured", v)} label="Öne çıkar" description="Menünün üst kısmındaki “Öne çıkanlar” bölümünde gösterilir." />
              <Switch checked={form.isSoldOut} onChange={(v) => set("isSoldOut", v)} label="Tükendi" description="Ürün menüde kalır ama “Tükendi” olarak işaretlenir." />
            </div>
          </Panel>

          <Panel title="Menüde görünümü">
            <div data-surface="menu" data-mode="light" data-font="geometrik" style={PREVIEW_STYLE} className="rounded-xl bg-raised p-4 font-body text-ink" aria-label="Önizleme">
              <ProductCard product={preview} icon={cat?.icon ?? "utensils"} onOpen={(_p, e) => e.preventDefault()} />
            </div>
            {!form.isActive && <p className="mt-2 text-[0.8rem] text-ink-3">Bu ürün şu an gizli; kaydettiğinizde menüde görünmeyecek.</p>}
          </Panel>
        </div>

        <div className="lg:col-span-2">
          <SaveBar
            dirty={dirty}
            saving={saving}
            onSave={() => void save()}
            onReset={isNew ? undefined : () => initial && (setForm(initial), setErrors({}))}
            saveLabel={isNew ? "Ürünü ekle" : "Değişiklikleri kaydet"}
          />
        </div>
      </form>
    </>
  );
}
