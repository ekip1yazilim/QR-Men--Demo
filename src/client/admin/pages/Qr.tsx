import { useState } from "react";
import { LuCheck, LuCopy, LuDownload, LuExternalLink, LuPrinter, LuShieldCheck, LuTriangleAlert } from "react-icons/lu";
import { useBoot } from "../App";
import { useResource } from "../lib/hooks";
import { Link } from "../lib/router";
import { useFeedback } from "../ui/feedback";
import { Button, ButtonLink, ErrorState, PageHeader, Panel, SkeletonRows, cx } from "../ui/primitives";
import { EmberMark } from "../../ui/icons";
import { Img } from "../../ui/Img";

const SIZES = [
  { px: 512, label: "512 px", note: "Ekran ve sosyal medya" },
  { px: 1024, label: "1024 px", note: "Masa kartı, menü" },
  { px: 2048, label: "2048 px", note: "Afiş ve büyük baskı" },
];

export function QrPage() {
  const boot = useBoot();
  const { toast } = useFeedback();
  const { data, error, loading, reload } = useResource<{ menuUrl: string; configured: boolean; restaurantName: string }>("/qr");
  const [size, setSize] = useState(1024);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.menuUrl);
      setCopied(true);
      toast("Menü bağlantısı kopyalandı.");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("Kopyalanamadı. Bağlantıyı seçip elle kopyalayın.", "error");
    }
  };

  return (
    <>
      <div className="print-hidden">
        <PageHeader
          title="QR Kod Yönetimi"
          description="Masalarınıza yerleştireceğiniz QR kod, menünüzün kalıcı bağlantısını açar. Menüyü ne kadar değiştirirseniz değiştirin, basılı QR kod aynı kalır."
        />
      </div>

      {loading && !data ? (
        <SkeletonRows rows={3} className="h-40" />
      ) : error || !data ? (
        <ErrorState message={error?.message ?? "QR bilgileri yüklenemedi."} onRetry={reload} />
      ) : (
        <div className="print-hidden grid items-start gap-5 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <Panel>
            <div className="mx-auto w-full max-w-[17rem] rounded-2xl bg-white p-3 ring-1 ring-line">
              <img src="/yonetim/api/qr.svg" alt={`Menü QR kodu: ${data.menuUrl}`} className="aspect-square w-full" width={272} height={272} />
            </div>
            <p className="mt-4 text-center text-sm text-ink-3">Telefon kameranızla okutarak deneyebilirsiniz.</p>
          </Panel>

          <div className="space-y-5">
            {!data.configured && (
              <div role="alert" className="flex gap-3 rounded-2xl bg-warn/10 px-5 py-4 text-sm text-[#7a4f08] ring-1 ring-warn/25">
                <LuTriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-bold">Baskıdan önce kalıcı menü adresini tanımlayın</p>
                  <p className="mt-1 leading-relaxed">
                    Bu QR kod şu an panelin açıldığı adrese göre oluşturuldu. Alan adınızı (ör. https://lezzetduragi.com){" "}
                    <Link to="/yonetim/ayarlar" className="font-semibold underline underline-offset-2">
                      Genel Ayarlar
                    </Link>{" "}
                    bölümünden girdiğinizde QR kod o adrese göre üretilir.
                  </p>
                </div>
              </div>
            )}

            <Panel title="Menü bağlantısı">
              <div className="flex flex-col gap-2.5 sm:flex-row">
                <input readOnly value={data.menuUrl} aria-label="Menü bağlantısı" className="field h-11 flex-1 font-mono text-sm" onFocus={(e) => e.target.select()} />
                <Button icon={copied ? LuCheck : LuCopy} onClick={() => void copy()} className="h-11">
                  {copied ? "Kopyalandı" : "Bağlantıyı kopyala"}
                </Button>
                <ButtonLink to={data.menuUrl} external icon={LuExternalLink} className="h-11">
                  Aç
                </ButtonLink>
              </div>
              <p className="mt-3 flex items-start gap-2 text-sm text-ink-3">
                <LuShieldCheck className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden="true" />
                Bu bağlantı ürün, fiyat veya tasarım değişikliklerinden etkilenmez; yalnızca alan adınız değişirse yeni QR kod gerekir.
              </p>
            </Panel>

            <Panel title="İndir ve yazdır">
              <fieldset>
                <legend className="mb-2 text-sm font-semibold">PNG boyutu</legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {SIZES.map((s) => (
                    <label
                      key={s.px}
                      className={cx(
                        "flex cursor-pointer flex-col rounded-xl px-4 py-3 ring-1 transition-colors",
                        size === s.px ? "bg-coal text-white ring-coal" : "bg-surface ring-line hover:bg-raised",
                      )}
                    >
                      <input type="radio" name="boyut" value={s.px} checked={size === s.px} onChange={() => setSize(s.px)} className="sr-only" />
                      <span className="font-bold tabular">{s.label}</span>
                      <span className={cx("text-xs", size === s.px ? "text-white/65" : "text-ink-3")}>{s.note}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="mt-5 flex flex-wrap gap-2.5">
                <a
                  href={`/yonetim/api/qr.png?boyut=${size}&indir=1`}
                  download
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-coal px-4 text-[0.92rem] font-semibold text-white hover:bg-coal-3"
                >
                  <LuDownload className="size-4" aria-hidden="true" /> PNG indir
                </a>
                <a
                  href="/yonetim/api/qr.svg?indir=1"
                  download
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-surface px-4 text-[0.92rem] font-semibold text-ink ring-1 ring-line hover:bg-raised"
                >
                  <LuDownload className="size-4" aria-hidden="true" /> SVG indir (matbaa için)
                </a>
                <Button icon={LuPrinter} onClick={() => window.print()}>
                  Masa kartı yazdır
                </Button>
              </div>
              <ul className="mt-5 space-y-1.5 text-sm text-ink-3">
                <li>Basılı QR kod en az 3 × 3 cm olmalı; masada 4–5 cm idealdir.</li>
                <li>QR kodun etrafındaki beyaz boşluğu kırpmayın; okutmayı kolaylaştırır.</li>
                <li>Parlak (laminasyonlu) yüzeylerde ışık yansımasını önlemek için mat baskı tercih edin.</li>
              </ul>
            </Panel>
          </div>
        </div>
      )}

      {/* Yazdırılabilir masa kartı (yalnızca yazdırırken görünür) */}
      {data && (
        <div className="print-only masa-karti">
          <div className="mx-auto flex h-[148mm] w-[105mm] flex-col items-center justify-between bg-coal px-[10mm] py-[12mm] text-center text-white [print-color-adjust:exact] [-webkit-print-color-adjust:exact]">
            <div className="flex flex-col items-center">
              {boot.logo ? (
                <span className="block size-14 overflow-hidden rounded-xl bg-white p-1">
                  <Img image={boot.logo} alt="" sizes="56px" noPlaceholder className="size-full object-contain" />
                </span>
              ) : (
                <EmberMark className="size-12 text-ember" />
              )}
              <p className="mt-3 [font-family:Fraunces,Georgia,serif] text-[22pt] font-semibold leading-tight">{data.restaurantName}</p>
            </div>
            <div className="rounded-2xl bg-white p-[4mm]">
              <img src="/yonetim/api/qr.svg" alt="" className="size-[52mm]" />
            </div>
            <div>
              <p className="text-[12pt] font-semibold">Menümüzü görmek için QR kodu okutun</p>
              <p className="mt-1 text-[9pt] text-white/60">{data.menuUrl.replace(/^https?:\/\//, "")}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
