import { useState } from "react";
import { LuLayers, LuPencil, LuPlus, LuTrash2 } from "react-icons/lu";
import { categoryInputSchema, fieldErrors } from "../../../shared/schemas";
import type { Category } from "../../../shared/types";
import { CategoryIcon } from "../../ui/icons";
import { api, ApiError } from "../lib/api";
import { useResource } from "../lib/hooks";
import { Link } from "../lib/router";
import { Modal, useFeedback } from "../ui/feedback";
import { DragHandle, IconPicker, SortableList } from "../ui/inputs";
import { Button, EmptyState, ErrorState, Field, IconButton, PageHeader, Panel, Pill, SkeletonRows, Switch } from "../ui/primitives";

interface FormState {
  name: string;
  description: string;
  icon: string;
  isActive: boolean;
}
const EMPTY: FormState = { name: "", description: "", icon: "utensils", isActive: true };

function CategoryModal({
  editing,
  onClose,
  onSaved,
}: {
  editing: Category | "new" | null;
  onClose: () => void;
  onSaved: (c: Category, created: boolean) => void;
}) {
  const isNew = editing === "new";
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [lastKey, setLastKey] = useState<string | null>(null);

  // Pencere her açıldığında formu doldur
  const key = editing === null ? null : editing === "new" ? "new" : String(editing.id);
  if (key !== lastKey) {
    setLastKey(key);
    setErrors({});
    setForm(editing && editing !== "new" ? { name: editing.name, description: editing.description, icon: editing.icon, isActive: editing.isActive } : EMPTY);
  }

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const parsed = categoryInputSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setSaving(true);
    try {
      const res = isNew
        ? await api<{ category: Category }>("POST", "/kategoriler", parsed.data)
        : await api<{ category: Category }>("PUT", `/kategoriler/${(editing as Category).id}`, parsed.data);
      onSaved(res.category, isNew);
    } catch (err) {
      if (err instanceof ApiError) setErrors({ ...err.fieldErrors, _: Object.keys(err.fieldErrors).length ? "" : err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={editing !== null}
      onClose={onClose}
      title={isNew ? "Yeni kategori" : "Kategoriyi düzenle"}
      description={isNew ? "Kategori, menüde ürünlerin gruplandığı bir bölümdür." : undefined}
      footer={
        <>
          <Button onClick={onClose}>Vazgeç</Button>
          <Button variant="primary" loading={saving} onClick={() => void submit()}>
            {isNew ? "Kategoriyi oluştur" : "Değişiklikleri kaydet"}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5" noValidate>
        {errors._ && (
          <p role="alert" className="rounded-xl bg-bad/10 px-4 py-3 text-sm text-bad">
            {errors._}
          </p>
        )}
        <Field label="Kategori adı" required error={errors.name}>
          <input
            className="field"
            value={form.name}
            maxLength={60}
            autoFocus
            placeholder="Örn. Izgaralar"
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <Field label="Açıklama" optional error={errors.description} counter={{ value: form.description.length, max: 200 }} hint="Menüde kategori başlığının altında görünür.">
          <textarea
            className="field min-h-20 resize-y"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Örn. Meşe kömüründe, siparişle birlikte pişirilir."
          />
        </Field>
        <div>
          <p className="mb-2 text-sm font-semibold">İkon</p>
          <IconPicker value={form.icon} onChange={(icon) => setForm({ ...form, icon })} />
          {errors.icon && <p className="mt-1.5 text-[0.8rem] font-medium text-bad">{errors.icon}</p>}
        </div>
        <Switch
          checked={form.isActive}
          onChange={(isActive) => setForm({ ...form, isActive })}
          label="Menüde göster"
          description="Kapalıyken kategori ve içindeki ürünler müşterilere görünmez."
        />
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

function DeleteModal({
  target,
  categories,
  onClose,
  onDeleted,
}: {
  target: Category | null;
  categories: Category[];
  onClose: () => void;
  onDeleted: (msg: string) => void;
}) {
  const others = categories.filter((c) => c.id !== target?.id);
  const [strategy, setStrategy] = useState<"move" | "delete">("move");
  const [targetId, setTargetId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<number | null>(null);
  if ((target?.id ?? null) !== last) {
    setLast(target?.id ?? null);
    setStrategy(others.length ? "move" : "delete");
    setTargetId(others[0]?.id ?? null);
    setError(null);
  }
  if (!target) return <Modal open={false} onClose={onClose} title="" />;
  const count = target.productCount;

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await api("DELETE", `/kategoriler/${target.id}`, { strategy, targetCategoryId: strategy === "move" ? targetId : null });
      const moved = count && strategy === "move" ? `, ${count} ürün “${others.find((o) => o.id === targetId)?.name}” kategorisine taşındı` : "";
      onDeleted(`“${target.name}” silindi${moved}.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kategori silinemedi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={`“${target.name}” silinsin mi?`}
      description={count === 0 ? "Bu kategoride ürün yok. Silme işlemi geri alınamaz." : `Bu kategoride ${count} ürün var. Ürünlere ne olacağını seçin.`}
      footer={
        <>
          <Button onClick={onClose}>Vazgeç</Button>
          <Button variant="danger" loading={busy} onClick={() => void run()} disabled={count > 0 && strategy === "move" && !targetId}>
            {count > 0 && strategy === "delete" ? `Kategoriyi ve ${count} ürünü sil` : "Kategoriyi sil"}
          </Button>
        </>
      }
    >
      {count > 0 && (
        <fieldset className="space-y-3">
          <legend className="sr-only">Ürünler</legend>
          {others.length > 0 && (
            <label className="flex cursor-pointer gap-3 rounded-xl p-3 ring-1 ring-line has-[:checked]:ring-2 has-[:checked]:ring-coal">
              <input type="radio" name="strateji" className="mt-1 accent-[#1e1f23]" checked={strategy === "move"} onChange={() => setStrategy("move")} />
              <span className="flex-1">
                <span className="block text-sm font-semibold">Ürünleri başka kategoriye taşı</span>
                <select
                  className="field mt-2"
                  value={targetId ?? ""}
                  onChange={(e) => {
                    setTargetId(Number(e.target.value));
                    setStrategy("move");
                  }}
                  aria-label="Hedef kategori"
                >
                  {others.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </span>
            </label>
          )}
          <label className="flex cursor-pointer gap-3 rounded-xl p-3 ring-1 ring-line has-[:checked]:ring-2 has-[:checked]:ring-bad">
            <input type="radio" name="strateji" className="mt-1 accent-[#c43d2c]" checked={strategy === "delete"} onChange={() => setStrategy("delete")} />
            <span>
              <span className="block text-sm font-semibold text-bad">Ürünleri de kalıcı olarak sil</span>
              <span className="mt-0.5 block text-[0.8rem] text-ink-3">{count} ürün ve bilgileri silinir. Bu işlem geri alınamaz.</span>
            </span>
          </label>
        </fieldset>
      )}
      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-bad/10 px-4 py-3 text-sm text-bad">
          {error}
        </p>
      )}
    </Modal>
  );
}

export function Categories() {
  const { data, error, loading, reload, setData } = useResource<{ categories: Category[] }>("/kategoriler");
  const { toast } = useFeedback();
  const [editing, setEditing] = useState<Category | "new" | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const categories = data?.categories ?? [];

  const reorder = async (ids: number[]) => {
    const byId = new Map(categories.map((c) => [c.id, c]));
    setData({ categories: ids.map((id) => byId.get(id)!).filter(Boolean) });
    try {
      await api("PUT", "/kategoriler/sirala", { ids });
      toast("Kategori sıralaması kaydedildi. Menü yeni sıralamayla görünüyor.");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Sıralama kaydedilemedi.", "error");
      void reload();
    }
  };

  const toggle = async (c: Category, isActive: boolean) => {
    setData({ categories: categories.map((x) => (x.id === c.id ? { ...x, isActive } : x)) });
    try {
      await api("PATCH", `/kategoriler/${c.id}`, { isActive });
      toast(isActive ? `“${c.name}” menüde gösteriliyor.` : `“${c.name}” menüden gizlendi.`);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Kaydedilemedi.", "error");
      void reload();
    }
  };

  return (
    <>
      <PageHeader
        title="Kategoriler"
        description="Menüdeki bölümleri oluşturun ve sıralayın. Buradaki sıra, müşterilerin menüde gördüğü sıradır."
        actions={
          <Button variant="primary" icon={LuPlus} onClick={() => setEditing("new")}>
            Yeni kategori
          </Button>
        }
      />

      {loading && !data ? (
        <SkeletonRows rows={6} className="h-[4.25rem]" />
      ) : error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : categories.length === 0 ? (
        <Panel>
          <EmptyState
            icon={LuLayers}
            title="Henüz kategori yok"
            text="Ürün eklemeden önce en az bir kategori oluşturun; örneğin Izgaralar, Tatlılar veya İçecekler."
            action={
              <Button variant="primary" icon={LuPlus} onClick={() => setEditing("new")}>
                İlk kategoriyi oluştur
              </Button>
            }
          />
        </Panel>
      ) : (
        <Panel padded={false}>
          <div className="hidden grid-cols-[2.25rem_1fr_7rem_10rem_5.5rem] items-center gap-3 border-b border-line px-4 py-3 text-xs font-semibold text-ink-3 md:grid">
            <span />
            <span>Kategori</span>
            <span>Ürünler</span>
            <span>Menüde</span>
            <span className="text-right">İşlemler</span>
          </div>
          <SortableList
            items={categories}
            getId={(c) => c.id}
            onReorder={(ids) => void reorder(ids)}
            className="divide-y divide-line"
            itemClassName="bg-surface"
            renderItem={(c, handle) => (
              <div className="grid grid-cols-[2.25rem_1fr_auto] items-center gap-3 px-4 py-3 md:grid-cols-[2.25rem_1fr_7rem_10rem_5.5rem]">
                <DragHandle handle={handle} label={c.name} />
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-raised ring-1 ring-line">
                    <CategoryIcon name={c.icon} className="size-6" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{c.name}</p>
                    <p className="truncate text-[0.8rem] text-ink-3 md:hidden">{c.productCount} ürün</p>
                    {c.description && <p className="hidden truncate text-[0.8rem] text-ink-3 md:block">{c.description}</p>}
                  </div>
                </div>
                <Link to={`/yonetim/urunler?kategori=${c.id}`} className="hidden text-sm text-ink-2 tabular hover:text-ink hover:underline md:block">
                  {c.productCount} ürün
                </Link>
                <div className="hidden items-center gap-3 md:flex">
                  <Switch size="sm" hideLabel label={`${c.name} menüde görünsün`} checked={c.isActive} onChange={(v) => void toggle(c, v)} />
                  {c.isActive ? <Pill tone="green">Görünüyor</Pill> : <Pill tone="gray">Gizli</Pill>}
                </div>
                <div className="flex items-center justify-end gap-0.5">
                  <span className="mr-1 md:hidden">
                    <Switch size="sm" hideLabel label={`${c.name} menüde görünsün`} checked={c.isActive} onChange={(v) => void toggle(c, v)} />
                  </span>
                  <IconButton icon={LuPencil} label={`${c.name} kategorisini düzenle`} onClick={() => setEditing(c)} />
                  <IconButton icon={LuTrash2} tone="danger" label={`${c.name} kategorisini sil`} onClick={() => setDeleting(c)} />
                </div>
              </div>
            )}
          />
        </Panel>
      )}

      <CategoryModal
        editing={editing}
        onClose={() => setEditing(null)}
        onSaved={(c, created) => {
          setEditing(null);
          toast(created ? `“${c.name}” kategorisi oluşturuldu.` : `“${c.name}” kaydedildi.`);
          void reload();
        }}
      />
      <DeleteModal
        target={deleting}
        categories={categories}
        onClose={() => setDeleting(null)}
        onDeleted={(msg) => {
          setDeleting(null);
          toast(msg);
          void reload();
        }}
      />
    </>
  );
}
