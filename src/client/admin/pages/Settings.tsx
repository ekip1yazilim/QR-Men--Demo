import { useEffect, useMemo, useState } from "react";
import { LuDatabase, LuDownload, LuKeyRound, LuLogOut, LuTriangleAlert } from "react-icons/lu";
import { formatDateTime } from "../../../shared/format";
import { accountInputSchema, fieldErrors, generalInputSchema, passwordChangeSchema, PASSWORD_MIN } from "../../../shared/schemas";
import type { GeneralSettings } from "../../../shared/types";
import { useBoot } from "../App";
import { api, ApiError } from "../lib/api";
import { useBeforeUnload, useResource } from "../lib/hooks";
import { useRouter } from "../lib/router";
import { useFeedback } from "../ui/feedback";
import { Button, ErrorState, Field, PageHeader, Panel, SaveBar, SkeletonRows, Switch } from "../ui/primitives";

interface SettingsData {
  general: GeneralSettings;
  envSiteUrl: string;
  account: { name: string; email: string; passwordChangedAt: string; lastLoginAt: string | null };
  sessions: number;
  system: { dbBytes: number; images: number; imageBytes: number; schemaVersion: number; nodeVersion: string; dataDir: string };
}

const TIMEZONES = [
  { value: "Europe/Istanbul", label: "Türkiye (İstanbul)" },
  { value: "Asia/Famagusta", label: "KKTC (Gazimağusa)" },
  { value: "Asia/Baku", label: "Azerbaycan (Bakü)" },
  { value: "Europe/Berlin", label: "Almanya (Berlin)" },
  { value: "Europe/Amsterdam", label: "Hollanda (Amsterdam)" },
  { value: "Europe/London", label: "Birleşik Krallık (Londra)" },
];

function bytes(n: number) {
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

function AccountPanel({ account, onSaved }: { account: SettingsData["account"]; onSaved: (a: { name: string; email: string }) => void }) {
  const { toast } = useFeedback();
  const [form, setForm] = useState({ name: account.name, email: account.email });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const dirty = form.name !== account.name || form.email !== account.email;

  const save = async () => {
    const parsed = accountInputSchema.safeParse(form);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setBusy(true);
    try {
      const res = await api<{ account: { name: string; email: string } }>("PUT", "/hesap", parsed.data);
      onSaved(res.account);
      setErrors({});
      toast("Hesap bilgileri kaydedildi.");
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fieldErrors);
        if (!Object.keys(err.fieldErrors).length) toast(err.message, "error");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="Hesap bilgileri" description={account.lastLoginAt ? `Son giriş: ${formatDateTime(account.lastLoginAt)}` : undefined}>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="space-y-5"
      >
        <Field label="Ad soyad" required error={errors.name}>
          <input className="field" value={form.name} autoComplete="name" onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="E-posta (giriş adı)" required error={errors.email}>
          <input className="field" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Button type="submit" variant="primary" loading={busy} disabled={!dirty}>
          Hesabı kaydet
        </Button>
      </form>
    </Panel>
  );
}

function PasswordPanel({ changedAt, onChanged }: { changedAt: string; onChanged: () => void }) {
  const { toast } = useFeedback();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const parsed = passwordChangeSchema.safeParse(form);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setBusy(true);
    try {
      const res = await api<{ closedSessions: number }>("PUT", "/hesap/sifre", parsed.data);
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setErrors({});
      toast(res.closedSessions ? `Şifreniz değiştirildi. Diğer cihazlardaki ${res.closedSessions} oturum kapatıldı.` : "Şifreniz değiştirildi.");
      onChanged();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fieldErrors);
        if (!Object.keys(err.fieldErrors).length) toast(err.message, "error");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="Şifre değiştir" description={`Son değişiklik: ${formatDateTime(changedAt)}`}>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="space-y-5"
      >
        <input type="text" autoComplete="username" className="hidden" readOnly value="" tabIndex={-1} aria-hidden="true" />
        <Field label="Mevcut şifre" required error={errors.currentPassword}>
          <input className="field" type="password" autoComplete="current-password" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} />
        </Field>
        <Field label="Yeni şifre" required error={errors.newPassword} hint={`En az ${PASSWORD_MIN} karakter; harf ve rakam içermeli.`}>
          <input className="field" type="password" autoComplete="new-password" value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} />
        </Field>
        <Field label="Yeni şifre (tekrar)" required error={errors.confirmPassword}>
          <input className="field" type="password" autoComplete="new-password" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} />
        </Field>
        <Button type="submit" variant="primary" icon={LuKeyRound} loading={busy} disabled={!form.currentPassword || !form.newPassword}>
          Şifreyi değiştir
        </Button>
      </form>
    </Panel>
  );
}

export function SettingsPage() {
  const boot = useBoot();
  const { toast, confirm } = useFeedback();
  const { setBlocker } = useRouter();
  const { data, error, loading, reload, setData } = useResource<SettingsData>("/ayarlar");
  const [form, setForm] = useState<GeneralSettings | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data && !form) setForm(data.general);
  }, [data, form]);

  const dirty = useMemo(() => !!form && !!data && JSON.stringify(form) !== JSON.stringify(data.general), [form, data]);
  useBeforeUnload(dirty);
  useEffect(() => {
    setBlocker(dirty ? () => confirm({ title: "Kaydedilmemiş değişiklikler var", message: "Sayfadan ayrılırsanız değişiklikler kaybolacak.", confirmLabel: "Kaydetmeden ayrıl", cancelLabel: "Sayfada kal", tone: "danger" }) : null);
    return () => setBlocker(null);
  }, [dirty, setBlocker, confirm]);

  const set = <K extends keyof GeneralSettings>(k: K, v: GeneralSettings[K]) => {
    setForm((f) => (f ? { ...f, [k]: v } : f));
    if (errors[k as string]) setErrors((e) => ({ ...e, [k as string]: "" }));
  };

  const save = async () => {
    if (!form || !data) return;
    const parsed = generalInputSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    if (parsed.data.siteUrl !== data.general.siteUrl && data.general.siteUrl) {
      const ok = await confirm({
        title: "Menü adresi değişecek",
        message: "Basılı QR kodlarınız eski adresi açmaya devam eder. Yeni adres için QR kodları yeniden indirip basmanız gerekir. Devam edilsin mi?",
        confirmLabel: "Adresi değiştir",
        tone: "danger",
      });
      if (!ok) return;
    }
    if (!parsed.data.menuPublished && data.general.menuPublished) {
      const ok = await confirm({
        title: "Menü yayından kaldırılsın mı?",
        message: "QR kodu okutan müşteriler menü yerine bilgilendirme mesajını görecek.",
        confirmLabel: "Yayından kaldır",
        tone: "danger",
      });
      if (!ok) return;
    }
    setSaving(true);
    try {
      const res = await api<SettingsData>("PUT", "/ayarlar", parsed.data);
      setData(res);
      setForm(res.general);
      setErrors({});
      const base = res.general.siteUrl || res.envSiteUrl;
      if (base) boot.update({ menuUrl: `${base}/menu` });
      toast("Genel ayarlar kaydedildi.");
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fieldErrors);
        toast(err.message, "error");
      }
    } finally {
      setSaving(false);
    }
  };

  const revoke = async () => {
    const ok = await confirm({ title: "Diğer cihazlardan çıkış yapılsın mı?", message: "Bu cihaz dışındaki tüm oturumlar kapatılır.", confirmLabel: "Çıkış yaptır" });
    if (!ok) return;
    try {
      const res = await api<{ closedSessions: number }>("POST", "/oturumlar/kapat");
      toast(res.closedSessions ? `${res.closedSessions} oturum kapatıldı.` : "Başka açık oturum yoktu.");
      void reload();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "İşlem tamamlanamadı.", "error");
    }
  };

  const header = <PageHeader title="Genel Ayarlar" description="Menünün yayın durumu, kalıcı adresi, arama motoru görünümü ve hesap güvenliği." />;
  if (loading && !form) return (<>{header}<SkeletonRows rows={4} className="h-36" /></>);
  if (error || !form || !data) return (<>{header}<ErrorState message={error?.message ?? "Ayarlar yüklenemedi."} onRetry={reload} /></>);

  const effectiveBase = form.siteUrl || data.envSiteUrl;
  const seoTitle = form.seoTitle || `${boot.restaurantName} | Dijital Menü`;

  return (
    <>
      {header}
      <div className="space-y-5">
        <div className="space-y-5">
          <Panel title="Menü yayını">
            <Switch
              checked={form.menuPublished}
              onChange={(v) => set("menuPublished", v)}
              label="Menü yayında"
              description="Kapalıyken QR kodu okutan müşteriler menü yerine aşağıdaki mesajı görür. Bakım veya tadilat dönemleri için kullanın."
            />
            {!form.menuPublished && (
              <Field label="Bilgilendirme mesajı" className="mt-5" error={errors.unpublishedMessage} counter={{ value: form.unpublishedMessage.length, max: 200 }}>
                <textarea className="field min-h-20" value={form.unpublishedMessage} onChange={(e) => set("unpublishedMessage", e.target.value)} />
              </Field>
            )}
          </Panel>

          <Panel title="Menü adresi" description="QR kodlar ve arama motorları bu adresi kullanır.">
            <div className="grid gap-5 md:grid-cols-2">
              <Field
                label="Site adresi (alan adı)"
                error={errors.siteUrl}
                hint={data.envSiteUrl && !form.siteUrl ? `Boş bırakılırsa sunucu ayarındaki adres kullanılır: ${data.envSiteUrl}` : "Örn. https://lezzetduragi.com (sonunda / olmadan)"}
              >
                <input className="field font-mono text-sm" type="url" inputMode="url" placeholder="https://" value={form.siteUrl} onChange={(e) => set("siteUrl", e.target.value)} />
              </Field>
              <Field label="Saat dilimi" error={errors.timezone} hint="Açık/kapalı bilgisi ve istatistikler bu saate göre hesaplanır.">
                <select className="field" value={form.timezone} onChange={(e) => set("timezone", e.target.value)}>
                  {!TIMEZONES.some((t) => t.value === form.timezone) && <option value={form.timezone}>{form.timezone}</option>}
                  {TIMEZONES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="mt-5 rounded-xl bg-raised px-4 py-3 text-sm">
              <p className="text-ink-3">Kalıcı menü bağlantısı</p>
              <p className="mt-0.5 break-all font-mono font-semibold text-ink">{effectiveBase ? `${effectiveBase}/menu` : "Tanımlanmadı. Şu an panelin açıldığı adres kullanılıyor."}</p>
            </div>
            {data.general.siteUrl && form.siteUrl !== data.general.siteUrl && (
              <p className="mt-3 flex items-start gap-2 text-sm font-medium text-[#7a4f08]">
                <LuTriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                Adresi değiştirirseniz basılı QR kodları yenilemeniz gerekir.
              </p>
            )}
          </Panel>

          <Panel title="Arama motorları" description="Google'da ve bağlantı paylaşıldığında görünen başlık ve açıklama.">
            <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
              <div className="space-y-5">
                <Field label="Sayfa başlığı" optional error={errors.seoTitle} counter={{ value: form.seoTitle.length, max: 70 }} hint="Boş bırakılırsa “Restoran adı | Dijital Menü” kullanılır.">
                  <input className="field" value={form.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} />
                </Field>
                <Field label="Açıklama" optional error={errors.seoDescription} counter={{ value: form.seoDescription.length, max: 170 }} hint="Boş bırakılırsa kategorilerinizden otomatik oluşturulur.">
                  <textarea className="field min-h-20" value={form.seoDescription} onChange={(e) => set("seoDescription", e.target.value)} />
                </Field>
              </div>
              <div className="rounded-xl bg-white p-4 ring-1 ring-line" aria-label="Google önizlemesi">
                <p className="text-xs text-ink-3">Google önizlemesi</p>
                <p className="mt-2 truncate text-xs text-[#4d5156]">{(effectiveBase || "https://alanadiniz.com").replace(/^https?:\/\//, "")} › menu</p>
                <p className="mt-1 line-clamp-2 text-[1.05rem] leading-snug text-[#1a0dab]">{seoTitle}</p>
                <p className="mt-1 line-clamp-3 text-[0.82rem] leading-relaxed text-[#4d5156]">
                  {form.seoDescription || `${boot.restaurantName} dijital menüsü. Güncel fiyatlar, ürün içerikleri ve çalışma saatleri.`}
                </p>
              </div>
            </div>
          </Panel>

          <SaveBar dirty={dirty} saving={saving} onSave={() => void save()} onReset={() => setForm(data.general)} saveLabel="Ayarları kaydet" />
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <AccountPanel
            account={data.account}
            onSaved={(a) => {
              setData({ ...data, account: { ...data.account, ...a } });
              boot.update({ user: { ...boot.user, ...a } });
            }}
          />
          <PasswordPanel changedAt={data.account.passwordChangedAt} onChanged={() => void reload()} />
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <Panel title="Oturumlar">
            <p className="text-sm text-ink-2">
              Bu hesapla şu an <strong className="text-ink">{data.sessions}</strong> cihazda oturum açık (bu cihaz dahil).
            </p>
            <Button className="mt-4" icon={LuLogOut} onClick={() => void revoke()} disabled={data.sessions <= 1}>
              Diğer cihazlardan çıkış yap
            </Button>
          </Panel>

          <Panel title="Yedekleme ve sistem">
            <p className="text-sm leading-relaxed text-ink-2">
              Menü, görseller, ayarlar ve hesaplar tek bir veritabanı dosyasında saklanır. Düzenli olarak yedek indirmeniz önerilir.
            </p>
            <a
              href="/yonetim/api/yedek"
              download
              className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-surface px-4 text-[0.92rem] font-semibold text-ink ring-1 ring-line hover:bg-raised"
            >
              <LuDownload className="size-4" aria-hidden="true" /> Veritabanı yedeğini indir
            </a>
            <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="flex items-center gap-1.5 text-ink-3">
                <LuDatabase className="size-3.5" aria-hidden="true" /> Veritabanı
              </dt>
              <dd className="text-right font-semibold tabular">{bytes(data.system.dbBytes)}</dd>
              <dt className="text-ink-3">Görseller</dt>
              <dd className="text-right font-semibold tabular">
                {data.system.images} adet, {bytes(data.system.imageBytes)}
              </dd>
              <dt className="text-ink-3">Şema sürümü</dt>
              <dd className="text-right font-semibold tabular">{data.system.schemaVersion}</dd>
              <dt className="text-ink-3">Node.js</dt>
              <dd className="text-right font-semibold tabular">{data.system.nodeVersion}</dd>
            </dl>
          </Panel>
        </div>
      </div>
    </>
  );
}
