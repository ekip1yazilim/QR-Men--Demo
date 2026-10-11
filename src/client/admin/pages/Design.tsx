import { useEffect, useMemo, useState } from "react";
import { LuCheck, LuInfo, LuMoon, LuSun } from "react-icons/lu";
import { ACCENT_PRESETS, accentTokens, isHexColor } from "../../../shared/color";
import { designInputSchema, fieldErrors } from "../../../shared/schemas";
import type { DesignSettings, FontStyle } from "../../../shared/types";
import { api, ApiError } from "../lib/api";
import { useBeforeUnload, useDebounced, useResource } from "../lib/hooks";
import { useRouter } from "../lib/router";
import { useFeedback } from "../ui/feedback";
import { ErrorState, PageHeader, Panel, SaveBar, SkeletonRows, Switch, cx } from "../ui/primitives";

const FONTS: { key: FontStyle; label: string; family: string; note: string }[] = [
  { key: "geometrik", label: "Geometrik", family: "Poppins, system-ui, sans-serif", note: "Yuvarlak hatlı ve modern; varsayılan menü görünümü" },
  { key: "klasik", label: "Klasik", family: "Fraunces, Georgia, serif", note: "Basılı menü havası; başlıklar zarif bir serif ile" },
  { key: "modern", label: "Modern", family: "Manrope, system-ui, sans-serif", note: "Sade ve net; kafe ve burger konseptleri için" },
];

export function DesignPage() {
  const { toast, confirm } = useFeedback();
  const { setBlocker } = useRouter();
  const { data, error, loading, reload } = useResource<{ design: DesignSettings }>("/tasarim");
  const [form, setForm] = useState<DesignSettings | null>(null);
  const [initial, setInitial] = useState<DesignSettings | null>(null);
  const [hex, setHex] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (data && !form) {
      setForm(data.design);
      setInitial(data.design);
      setHex(data.design.accentColor);
    }
  }, [data, form]);

  const dirty = useMemo(() => !!form && JSON.stringify(form) !== JSON.stringify(initial), [form, initial]);
  useBeforeUnload(dirty);
  useEffect(() => {
    setBlocker(dirty ? () => confirm({ title: "Tasarım kaydedilmedi", message: "Önizlemedeki değişiklikler kaydedilmeden kaybolacak.", confirmLabel: "Kaydetmeden ayrıl", cancelLabel: "Sayfada kal", tone: "danger" }) : null);
    return () => setBlocker(null);
  }, [dirty, setBlocker, confirm]);

  const previewSrc = useDebounced(
    form
      ? `/yonetim/onizleme?${new URLSearchParams({
          renk: form.accentColor,
          mod: form.themeMode,
          yazi: form.fontStyle,
          onecikan: form.showFeatured ? "1" : "0",
          arama: form.showSearch ? "1" : "0",
        }).toString()}`
      : "",
    350,
  );

  const set = <K extends keyof DesignSettings>(k: K, v: DesignSettings[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const setAccent = (v: string) => {
    setHex(v);
    if (isHexColor(v)) set("accentColor", v.toUpperCase());
  };

  const save = async () => {
    if (!form) return;
    const parsed = designInputSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setSaving(true);
    try {
      const res = await api<{ design: DesignSettings }>("PUT", "/tasarim", parsed.data);
      setForm(res.design);
      setInitial(res.design);
      setErrors({});
      toast("Tasarım kaydedildi. Yayındaki menü yeni görünümle açılıyor.");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Kaydedilemedi.", "error");
    } finally {
      setSaving(false);
    }
  };

  const header = <PageHeader title="Tasarım Ayarları" description="Menünüzün renklerini, temasını ve yazı tipini seçin. Sağdaki önizleme kaydetmeden önce sonucu gösterir." />;
  if (loading && !form) return (<>{header}<SkeletonRows rows={4} className="h-36" /></>);
  if (error || !form) return (<>{header}<ErrorState message={error?.message ?? "Ayarlar yüklenemedi."} onRetry={reload} /></>);

  const tokens = accentTokens(form.accentColor, form.themeMode);
  const adjusted = tokens.accentText.toLowerCase() !== form.accentColor.toLowerCase();

  return (
    <>
      {header}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-5">
          <Panel title="Vurgu rengi" description="Fiyatlar, seçili kategori ve düğmelerde kullanılır.">
            <div role="radiogroup" aria-label="Hazır renkler" className="grid grid-cols-4 gap-2.5 sm:grid-cols-8">
              {ACCENT_PRESETS.map((p) => {
                const active = p.value.toLowerCase() === form.accentColor.toLowerCase();
                return (
                  <button
                    key={p.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-label={p.name}
                    title={p.name}
                    onClick={() => setAccent(p.value)}
                    className={cx("group flex flex-col items-center gap-1.5 rounded-xl p-1.5 transition-colors", active ? "bg-raised ring-1 ring-line" : "hover:bg-raised")}
                  >
                    <span className="grid size-10 place-items-center rounded-full ring-2 ring-white" style={{ background: p.value, boxShadow: "0 0 0 1px rgb(0 0 0 / 0.12)" }}>
                      {active && <LuCheck className="size-5" style={{ color: accentTokens(p.value, "dark").accentInk }} aria-hidden="true" />}
                    </span>
                    <span className="text-center text-[0.7rem] font-semibold leading-tight text-ink-2">{p.name}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-3 text-sm font-semibold">
                <input
                  type="color"
                  value={isHexColor(hex) ? hex : form.accentColor}
                  onChange={(e) => setAccent(e.target.value)}
                  className="size-11 cursor-pointer rounded-xl border border-line bg-surface p-1"
                  aria-label="Özel renk seç"
                />
                Özel renk
              </label>
              <input
                className="field h-11 w-32 font-mono uppercase"
                value={hex}
                maxLength={7}
                aria-label="Renk kodu"
                aria-invalid={!isHexColor(hex) || undefined}
                onChange={(e) => setAccent(e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`)}
              />
              {!isHexColor(hex) && <span className="text-[0.8rem] font-medium text-bad">#RRGGBB biçiminde girin</span>}
              {errors.accentColor && <span className="text-[0.8rem] font-medium text-bad">{errors.accentColor}</span>}
            </div>
            {adjusted && (
              <p className="mt-4 flex items-start gap-2 rounded-xl bg-raised px-4 py-3 text-[0.82rem] leading-relaxed text-ink-2">
                <LuInfo className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  Bu renk {form.themeMode === "dark" ? "koyu" : "açık"} zeminde metin için yeterince okunaklı değil. Fiyat ve bağlantılarda otomatik olarak{" "}
                  <span className="inline-flex items-center gap-1 font-mono font-semibold">
                    <span className="inline-block size-3 rounded-full" style={{ background: tokens.accentText }} />
                    {tokens.accentText.toUpperCase()}
                  </span>{" "}
                  tonu kullanılır.
                </span>
              </p>
            )}
          </Panel>

          <Panel title="Tema">
            <div role="radiogroup" aria-label="Tema" className="grid gap-3 sm:grid-cols-2">
              {(["light", "dark"] as const).map((m) => {
                const active = form.themeMode === m;
                return (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => set("themeMode", m)}
                    className={cx("rounded-2xl p-3 text-left ring-1 transition-shadow", active ? "ring-2 ring-coal" : "ring-line hover:ring-ink-3")}
                  >
                    <span className={cx("block h-20 overflow-hidden rounded-xl", m === "dark" ? "bg-[#1b1c1f]" : "bg-white ring-1 ring-line")}>
                      <span className="block h-5 bg-[#132131]" />
                      <span className="block p-2.5">
                        <span className={cx("block h-2 w-24 rounded-full", m === "dark" ? "bg-white/80" : "bg-[#1e1f23]")} />
                        <span className={cx("mt-2 block h-2 w-32 rounded-full", m === "dark" ? "bg-white/25" : "bg-[#1e1f23]/20")} />
                        <span className="mt-2.5 block h-2 w-12 rounded-full" style={{ background: form.accentColor }} />
                      </span>
                    </span>
                    <span className="mt-3 flex items-center gap-2 px-1 font-semibold">
                      {m === "dark" ? <LuMoon className="size-4" aria-hidden="true" /> : <LuSun className="size-4" aria-hidden="true" />}
                      {m === "dark" ? "Koyu (antrasit)" : "Açık (beyaz)"}
                    </span>
                    <span className="mt-0.5 block px-1 text-[0.8rem] text-ink-3">
                      {m === "dark" ? "Akşam ambiyansı ve loş ışıklı salonlar için" : "Varsayılan görünüm; gün ışığında rahat okunur"}
                    </span>
                  </button>
                );
              })}
            </div>
          </Panel>

          <Panel title="Yazı tipi" description="Kapak başlığı, kategori başlıkları ve ürün adlarında kullanılır.">
            <div role="radiogroup" aria-label="Yazı tipi" className="grid gap-3 md:grid-cols-3">
              {FONTS.map((f) => {
                const active = form.fontStyle === f.key;
                return (
                  <button
                    key={f.key}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => set("fontStyle", f.key)}
                    className={cx("rounded-2xl p-4 text-left ring-1 transition-shadow", active ? "ring-2 ring-coal" : "ring-line hover:ring-ink-3")}
                  >
                    <span className="block truncate text-[1.45rem] font-semibold leading-tight text-ink" style={{ fontFamily: f.family }}>
                      Izgara Köfte
                    </span>
                    <span className="mt-1 block text-sm font-semibold text-accent-text" style={{ fontFamily: f.key === "klasik" ? undefined : f.family }}>
                      ₺240,00
                    </span>
                    <span className="mt-3 block font-semibold text-ink">{f.label}</span>
                    <span className="mt-0.5 block text-[0.8rem] leading-snug text-ink-3">{f.note}</span>
                  </button>
                );
              })}
            </div>
          </Panel>

          <Panel title="Bölümler">
            <div className="space-y-5">
              <Switch checked={form.showFeatured} onChange={(v) => set("showFeatured", v)} label="Öne çıkanlar bölümü" description="Öne çıkarılmış ürünler menünün başında büyük kartlarla gösterilir." />
              <Switch checked={form.showSearch} onChange={(v) => set("showSearch", v)} label="Ürün arama" description="Müşteriler ürün adı, içerik veya kategoriye göre arama yapabilir." />
            </div>
          </Panel>
        </div>

        <aside className="xl:sticky xl:top-6" aria-label="Canlı önizleme">
          <div className="mx-auto w-[min(100%,20rem)]">
            <p className="mb-2.5 flex items-center justify-between text-sm font-semibold text-ink-2">
              Canlı önizleme
              {dirty && <span className="rounded-full bg-ember/12 px-2 py-0.5 text-xs text-ember-deep">kaydedilmedi</span>}
            </p>
            <div className="rounded-[2.4rem] bg-coal p-2.5 shadow-float">
              <div className="relative h-[34rem] overflow-hidden rounded-[1.9rem] bg-white">
                {previewSrc && (
                  <iframe
                    key="onizleme"
                    src={previewSrc}
                    title="Menü önizlemesi"
                    className="absolute left-0 top-0 h-[130%] w-[130%] origin-top-left scale-[0.7693] border-0"
                  />
                )}
              </div>
            </div>
            <p className="mt-3 text-center text-[0.8rem] text-ink-3">Önizlemeyi kaydırarak tüm menüyü inceleyebilirsiniz.</p>
          </div>
        </aside>
      </div>
      <SaveBar dirty={dirty} saving={saving} onSave={() => void save()} onReset={() => initial && (setForm(initial), setHex(initial.accentColor))} saveLabel="Tasarımı kaydet" />
    </>
  );
}
