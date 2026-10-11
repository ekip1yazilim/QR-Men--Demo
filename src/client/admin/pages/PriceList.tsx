/**
 * Basılı fiyat listesi (A4)
 * Fiyat Etiketi Yönetmeliği: masalarda karekod (QR) menü kullanılıyorsa, müşteri isterse fiyat listesi
 * basılı olarak da verilmelidir; işyeri girişinde de görülebilir bir fiyat listesi bulunmalıdır.
 * Bu sayfa menüdeki tüm aktif ürünleri güncel fiyatlarıyla yazdırılabilir bir sayfa olarak hazırlar.
 */
import { useState } from "react";
import { LuInfo, LuPrinter, LuReceiptText } from "react-icons/lu";
import { formatDate, formatPrice } from "../../../shared/format";
import type { PublicMenu } from "../../../shared/types";
import { useResource } from "../lib/hooks";
import { Link } from "../lib/router";
import { Button, EmptyState, ErrorState, PageHeader, Panel, SkeletonRows } from "../ui/primitives";

function Option({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-[var(--color-ember)]" />
      {label}
    </label>
  );
}

export function PriceListPage() {
  const { data, error, loading, reload } = useResource<{ menu: PublicMenu }>("/fiyat-listesi");
  const [showDescriptions, setShowDescriptions] = useState(true);
  const [showAllergens, setShowAllergens] = useState(true);
  const [showQr, setShowQr] = useState(true);

  const header = (
    <div className="print-hidden">
      <PageHeader
        title="Basılı Fiyat Listesi"
        description="Menünüzdeki tüm ürünleri güncel fiyatlarıyla A4 sayfa olarak yazdırın veya PDF olarak kaydedin."
        actions={
          data?.menu.categories.length ? (
            <Button variant="primary" icon={LuPrinter} onClick={() => window.print()}>
              Yazdır / PDF kaydet
            </Button>
          ) : undefined
        }
      />
    </div>
  );
  if (loading && !data) return (<>{header}<SkeletonRows rows={3} className="h-40" /></>);
  if (error || !data) return (<>{header}<ErrorState message={error?.message ?? "Fiyat listesi yüklenemedi."} onRetry={reload} /></>);

  const { restaurant: r, categories, menuUrl, generatedAt, timezone } = data.menu;
  const contact = [r.address, r.phone].filter(Boolean).join(" · ");

  return (
    <>
      {header}
      {categories.length === 0 ? (
        <EmptyState icon={LuReceiptText} title="Menüde yayında ürün yok" text="Ürün ekledikten sonra fiyat listesini buradan yazdırabilirsiniz." />
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[19rem_minmax(0,1fr)]">
          <div className="print-hidden space-y-5">
            <Panel title="Yazdırma seçenekleri">
              <div className="space-y-3">
                <Option checked={showDescriptions} onChange={setShowDescriptions} label="Ürün açıklamaları" />
                <Option checked={showAllergens} onChange={setShowAllergens} label="Alerjen bilgisi" />
                <Option checked={showQr} onChange={setShowQr} label="Dijital menü QR kodu" />
              </div>
            </Panel>
            <div className="flex gap-3 rounded-2xl bg-surface px-4 py-3.5 text-[0.82rem] leading-relaxed text-ink-2 ring-1 ring-line">
              <LuInfo className="mt-0.5 size-4 shrink-0 text-ember-deep" aria-hidden="true" />
              <div className="space-y-2">
                <p>
                  Masalarda QR menü kullanıyorsanız, müşteri istediğinde fiyat listesini <strong className="text-ink">basılı olarak</strong> vermeniz
                  ve işyeri <strong className="text-ink">girişinde</strong> görülebilir bir fiyat listesi bulundurmanız gerekir (Fiyat Etiketi Yönetmeliği).
                </p>
                <p>
                  Fiyat değiştirdiğinizde listeyi yeniden yazdırın. Servis ücreti gibi ek ücretleri{" "}
                  <Link to="/yonetim/restoran" className="font-semibold text-ink underline underline-offset-2">
                    Restoran Bilgileri → Fiyat bilgisi notu
                  </Link>{" "}
                  alanına yazın; listenin altında görünür.
                </p>
              </div>
            </div>
          </div>

          {/* A4 sayfa: ekranda önizleme, yazdırırken yalnızca bu bölüm basılır */}
          <article
            className="fiyat-listesi mx-auto w-full max-w-[210mm] bg-white px-[12mm] py-[12mm] text-[#1b1f27] shadow-[0_8px_30px_-12px_rgb(16_24_40/0.25)] ring-1 ring-line [font-family:Poppins,system-ui,sans-serif] print:max-w-none print:p-0 print:shadow-none print:ring-0"
            aria-label="Basılı fiyat listesi önizlemesi"
          >
            <header className="flex items-end justify-between gap-6 border-b-2 border-[#1b1f27] pb-4">
              <div className="min-w-0">
                <h2 className="text-[20pt] font-semibold leading-tight">{r.name}</h2>
                {r.brandLabel && <p className="mt-0.5 text-[7.5pt] font-semibold tracking-[0.35em] text-[#b65a17]">{r.brandLabel}</p>}
                {contact && <p className="mt-2 text-[8.5pt] text-[#555b66]">{contact}</p>}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[13pt] font-semibold tracking-[0.12em]">FİYAT LİSTESİ</p>
                <p className="mt-1 text-[8pt] text-[#555b66]">Güncelleme: {formatDate(generatedAt, timezone)}</p>
              </div>
            </header>

            <div className="mt-5 columns-1 gap-[10mm] sm:columns-2 print:columns-2">
              {categories.map((c) => (
                <section key={c.id} className="mb-5 break-inside-avoid-column">
                  <h3 className="mb-2 border-b border-[#e3e5e9] pb-1 text-[11pt] font-semibold uppercase tracking-[0.06em] text-[#b65a17]">{c.name}</h3>
                  <ul className="space-y-2">
                    {c.products.map((p) => (
                      <li key={p.id} className="break-inside-avoid">
                        <div className="flex items-baseline gap-2 text-[9.5pt]">
                          <span className="font-semibold">{p.name}</span>
                          <span className="min-w-4 flex-1 translate-y-[-0.2em] border-b border-dotted border-[#9aa0aa]" aria-hidden="true" />
                          <span className="shrink-0 font-semibold tabular">{formatPrice(p.priceCents)}</span>
                        </div>
                        {showDescriptions && p.description && <p className="mt-0.5 text-[7.5pt] leading-snug text-[#555b66]">{p.description}</p>}
                        {showAllergens && p.allergens && <p className="mt-0.5 text-[7pt] leading-snug text-[#8a5a14]">Alerjen: {p.allergens}</p>}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>

            <footer className="mt-4 flex items-end justify-between gap-6 border-t border-[#e3e5e9] pt-4 text-[8pt] text-[#555b66] break-inside-avoid">
              <div className="space-y-1">
                <p className="font-semibold text-[#1b1f27]">{r.footerNote || "Fiyatlarımıza KDV dahildir."}</p>
                <p>Dijital menü: {menuUrl.replace(/^https?:\/\//, "")}</p>
              </div>
              {showQr && <img src="/yonetim/api/qr.svg" alt="" className="size-[22mm] shrink-0" />}
            </footer>
          </article>
        </div>
      )}
    </>
  );
}
