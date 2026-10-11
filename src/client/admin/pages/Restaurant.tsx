import { useEffect, useMemo, useState } from "react";
import { LuCopy } from "react-icons/lu";
import { DAY_NAMES, toMinutes } from "../../../shared/hours";
import { fieldErrors, restaurantInputSchema } from "../../../shared/schemas";
import type { DayHours, ImageRef, WeekHours } from "../../../shared/types";
import { useBoot } from "../App";
import { api, ApiError } from "../lib/api";
import { useBeforeUnload, useResource } from "../lib/hooks";
import { useRouter } from "../lib/router";
import { useFeedback } from "../ui/feedback";
import { ImageUploader } from "../ui/inputs";
import { Button, ErrorState, Field, PageHeader, Panel, SaveBar, SkeletonRows, Switch } from "../ui/primitives";

interface Stored {
  name: string;
  brandLabel: string;
  heroTitle: string;
  tagline: string;
  description: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  mapsUrl: string;
  instagram: string;
  hours: WeekHours;
  hoursNote: string;
  footerNote: string;
  logo: ImageRef | null;
  cover: ImageRef | null;
}

function HoursEditor({ hours, onChange, errors }: { hours: WeekHours; onChange: (h: WeekHours) => void; errors: Record<string, string> }) {
  const setDay = (i: number, patch: Partial<DayHours>) => onChange(hours.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  return (
    <div>
      <div className="divide-y divide-line rounded-xl ring-1 ring-line">
        {hours.map((d, i) => {
          const overnight = !d.closed && toMinutes(d.close) <= toMinutes(d.open);
          const err = errors[`hours.${i}.open`] ?? errors[`hours.${i}.close`];
          return (
            <div key={i} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <span className="w-24 text-sm font-semibold">{DAY_NAMES[i]}</span>
              <Switch size="sm" hideLabel label={`${DAY_NAMES[i]} açık`} checked={!d.closed} onChange={(open) => setDay(i, { closed: !open })} />
              {d.closed ? (
                <span className="text-sm text-ink-3">Kapalı</span>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    className="field h-10 w-[7.5rem] tabular"
                    value={d.open}
                    aria-label={`${DAY_NAMES[i]} açılış saati`}
                    onChange={(e) => setDay(i, { open: e.target.value })}
                  />
                  <span className="text-ink-3" aria-hidden="true">
                    –
                  </span>
                  <input
                    type="time"
                    className="field h-10 w-[7.5rem] tabular"
                    value={d.close}
                    aria-label={`${DAY_NAMES[i]} kapanış saati`}
                    onChange={(e) => setDay(i, { close: e.target.value })}
                  />
                  {overnight && <span className="text-xs text-ink-3">ertesi gün</span>}
                </div>
              )}
              {err && <span className="w-full text-[0.8rem] font-medium text-bad">{err}</span>}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[0.8rem] text-ink-3">Kapanış saati açılıştan erkense (ör. 11:00 – 01:00) gece yarısından sonra kapanış olarak değerlendirilir.</p>
        <Button size="sm" icon={LuCopy} onClick={() => onChange(hours.map(() => ({ ...hours[0] })))}>
          Pazartesi saatlerini tüm günlere uygula
        </Button>
      </div>
    </div>
  );
}

export function RestaurantPage() {
  const boot = useBoot();
  const { toast, confirm } = useFeedback();
  const { setBlocker } = useRouter();
  const { data, error, loading, reload } = useResource<{ restaurant: Stored }>("/restoran");
  const [form, setForm] = useState<Stored | null>(null);
  const [initial, setInitial] = useState<Stored | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data && !form) {
      setForm(data.restaurant);
      setInitial(data.restaurant);
    }
  }, [data, form]);

  const dirty = useMemo(() => !!form && JSON.stringify(form) !== JSON.stringify(initial), [form, initial]);
  useBeforeUnload(dirty);
  useEffect(() => {
    setBlocker(dirty ? () => confirm({ title: "Kaydedilmemiş değişiklikler var", message: "Sayfadan ayrılırsanız değişiklikler kaybolacak.", confirmLabel: "Kaydetmeden ayrıl", cancelLabel: "Sayfada kal", tone: "danger" }) : null);
    return () => setBlocker(null);
  }, [dirty, setBlocker, confirm]);

  const set = <K extends keyof Stored>(k: K, v: Stored[K]) => {
    setForm((f) => (f ? { ...f, [k]: v } : f));
    if (errors[k as string]) setErrors((e) => ({ ...e, [k as string]: "" }));
  };

  const save = async () => {
    if (!form) return;
    const body = { ...form, logoImageId: form.logo?.id ?? null, coverImageId: form.cover?.id ?? null };
    const parsed = restaurantInputSchema.safeParse(body);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      toast("Lütfen işaretli alanları kontrol edin.", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await api<{ restaurant: Stored }>("PUT", "/restoran", parsed.data);
      setForm(res.restaurant);
      setInitial(res.restaurant);
      setErrors({});
      boot.update({ restaurantName: res.restaurant.name, logo: res.restaurant.logo });
      toast("Restoran bilgileri kaydedildi. Menü güncellendi.");
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fieldErrors);
        toast(err.message, "error");
      }
    } finally {
      setSaving(false);
    }
  };

  const header = <PageHeader title="Restoran Bilgileri" description="Menünün üst kısmında ve iletişim bölümünde görünen bilgiler." />;
  if (loading && !form) return (<>{header}<SkeletonRows rows={4} className="h-40" /></>);
  if (error || !form) return (<>{header}<ErrorState message={error?.message ?? "Bilgiler yüklenemedi."} onRetry={reload} /></>);

  return (
    <>
      {header}
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="space-y-5"
      >
        <Panel title="Temel bilgiler">
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Restoran adı" required error={errors.name} counter={{ value: form.name.length, max: 60 }}>
              <input className="field" value={form.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field label="Logo alt yazısı" optional error={errors.brandLabel} counter={{ value: form.brandLabel.length, max: 24 }} hint="Üst çubukta restoran adının altında küçük harflerle görünür.">
              <input className="field" value={form.brandLabel} onChange={(e) => set("brandLabel", e.target.value)} placeholder="Örn. RESTAURANT, OCAKBAŞI" />
            </Field>
            <Field label="Kapak başlığı" optional error={errors.heroTitle} counter={{ value: form.heroTitle.length, max: 70 }} hint="Kapak fotoğrafının üzerindeki büyük yazı. Boş bırakılırsa restoran adı gösterilir.">
              <input className="field" value={form.heroTitle} onChange={(e) => set("heroTitle", e.target.value)} placeholder="Örn. Eşsiz Lezzetler Sizi Bekliyor" />
            </Field>
            <Field label="Kapak açıklaması" optional error={errors.tagline} counter={{ value: form.tagline.length, max: 160 }} hint="Kapak başlığının altında görünür.">
              <input className="field" value={form.tagline} onChange={(e) => set("tagline", e.target.value)} placeholder="Örn. Taze malzemelerle hazırlanan özel tariflerimiz" />
            </Field>
            <Field label="Hakkımızda" optional error={errors.description} counter={{ value: form.description.length, max: 500 }} className="md:col-span-2" hint="Menünün altındaki iletişim bölümünde görünür.">
              <textarea className="field min-h-24 resize-y" value={form.description} onChange={(e) => set("description", e.target.value)} />
            </Field>
          </div>
        </Panel>

        <Panel title="Logo ve kapak fotoğrafı" description="Fotoğraflar otomatik olarak sıkıştırılır ve her ekran boyutu için ayrı hazırlanır.">
          <div className="grid gap-6 md:grid-cols-[13rem_1fr]">
            <ImageUploader kind="logo" aspect="square" label="Logo" value={form.logo} onChange={(v) => set("logo", v)} error={errors.logoImageId} hint="Kare, şeffaf arka planlı PNG önerilir." />
            <ImageUploader
              kind="cover"
              aspect="wide"
              label="Kapak fotoğrafı"
              value={form.cover}
              onChange={(v) => set("cover", v)}
              error={errors.coverImageId}
              hint="Yatay, en az 1600 px genişliğinde bir fotoğraf önerilir. Kapak yoksa köz desenli zemin kullanılır."
            />
          </div>
        </Panel>

        <Panel title="İletişim">
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Telefon" optional error={errors.phone}>
              <input className="field" type="tel" inputMode="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+90 555 123 45 67" />
            </Field>
            <Field label="WhatsApp" optional error={errors.whatsapp}>
              <input className="field" type="tel" inputMode="tel" value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="+90 555 123 45 67" />
            </Field>
            <Field label="E-posta" optional error={errors.email}>
              <input className="field" type="email" inputMode="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </Field>
            <Field label="Instagram" optional error={errors.instagram}>
              <input className="field" value={form.instagram} onChange={(e) => set("instagram", e.target.value)} placeholder="@restoraniniz" />
            </Field>
            <Field label="Adres" optional error={errors.address} className="md:col-span-2">
              <input className="field" value={form.address} onChange={(e) => set("address", e.target.value)} />
            </Field>
            <Field label="Harita bağlantısı" optional error={errors.mapsUrl} className="md:col-span-2" hint="Google Haritalar'da restoranınızı açıp “Paylaş” bağlantısını yapıştırın. Boş bırakırsanız adresten otomatik oluşturulur.">
              <input className="field" type="url" inputMode="url" value={form.mapsUrl} onChange={(e) => set("mapsUrl", e.target.value)} placeholder="https://maps.app.goo.gl/…" />
            </Field>
          </div>
        </Panel>

        <Panel title="Çalışma saatleri" description="Menüde “Şu an açık / kapalı” bilgisi bu saatlere göre gösterilir.">
          <HoursEditor hours={form.hours} onChange={(h) => set("hours", h)} errors={errors} />
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <Field label="Saatlerle ilgili not" optional error={errors.hoursNote} counter={{ value: form.hoursNote.length, max: 140 }}>
              <input className="field" value={form.hoursNote} onChange={(e) => set("hoursNote", e.target.value)} placeholder="Örn. Mutfak kapanıştan 45 dakika önce kapanır." />
            </Field>
            <Field label="Menü alt bilgi notu" optional error={errors.footerNote} counter={{ value: form.footerNote.length, max: 160 }}>
              <input className="field" value={form.footerNote} onChange={(e) => set("footerNote", e.target.value)} placeholder="Örn. Tüm fiyatlarımıza KDV dahildir." />
            </Field>
          </div>
        </Panel>

        <SaveBar dirty={dirty} saving={saving} onSave={() => void save()} onReset={() => initial && (setForm(initial), setErrors({}))} />
      </form>
    </>
  );
}
