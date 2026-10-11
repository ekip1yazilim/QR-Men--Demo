import { useState } from "react";
import type { IconType } from "react-icons";
import {
  LuChartColumn,
  LuCircleAlert,
  LuEye,
  LuGlobe,
  LuHistory,
  LuImage,
  LuLayers,
  LuPackageX,
  LuPlus,
  LuCircleCheck,
  LuExternalLink,
  LuUtensils,
  LuEyeOff,
  LuArrowRight,
} from "react-icons/lu";
import { formatNumber, formatRelative } from "../../../shared/format";
import type { DashboardSummary } from "../../../shared/types";
import { useBoot } from "../App";
import { useResource } from "../lib/hooks";
import { Link } from "../lib/router";
import { ButtonLink, ErrorState, PageHeader, Panel, cx } from "../ui/primitives";

function StatTile({ icon: Icon, label, value, sub }: { icon: IconType; label: string; value: number; sub: string }) {
  return (
    <div className="rounded-2xl bg-surface p-5 ring-1 ring-line">
      <div className="flex items-center gap-2.5 text-sm font-semibold text-ink-2">
        <span className="grid size-8 place-items-center rounded-lg bg-raised ring-1 ring-line">
          <Icon className="size-4 text-ink" aria-hidden="true" />
        </span>
        {label}
      </div>
      <p className="mt-4 text-[2.1rem] font-bold leading-none tracking-tight tabular text-ink">{formatNumber(value)}</p>
      <p className="mt-2 text-[0.82rem] text-ink-3">{sub}</p>
    </div>
  );
}

const dayFmt = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", timeZone: "UTC" });
const weekdayFmt = new Intl.DateTimeFormat("tr-TR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/** Günlük görüntülenme çubuk grafiği (tek seri) */
function ViewsChart({ data }: { data: { day: string; views: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(4, ...data.map((d) => d.views));
  const niceMax = Math.ceil(max / 4) * 4;
  const W = 640;
  const H = 220;
  const pad = { top: 12, right: 8, bottom: 28, left: 34 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const slot = innerW / data.length;
  const barW = Math.min(26, slot - 6);
  const ticks = [0, niceMax / 2, niceMax];
  const y = (v: number) => pad.top + innerH - (v / niceMax) * innerH;
  const date = (d: string) => new Date(`${d}T00:00:00Z`);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Son 14 günün menü görüntülenmeleri">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} stroke="var(--c-line)" strokeWidth={1} />
            <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-[var(--c-ink-3)] text-[11px] tabular">
              {formatNumber(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = pad.left + i * slot + (slot - barW) / 2;
          const h = Math.max(d.views > 0 ? 3 : 0, (d.views / niceMax) * innerH);
          const isToday = i === data.length - 1;
          const r = Math.min(4, barW / 2, h);
          const top = pad.top + innerH - h;
          // Yalnızca üst köşeleri yuvarlatılmış, tabana oturan çubuk
          const path =
            h > 0
              ? `M${x},${pad.top + innerH} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${pad.top + innerH} Z`
              : "";
          return (
            <g key={d.day}>
              {path && (
                <path
                  d={path}
                  fill={isToday ? "var(--color-ember)" : "var(--color-coal)"}
                  opacity={hover === null || hover === i ? 1 : 0.45}
                  className="transition-opacity"
                />
              )}
              {(i % 2 === data.length % 2 || isToday) && (
                <text x={x + barW / 2} y={H - 8} textAnchor="middle" className={cx("text-[10.5px]", isToday ? "fill-[var(--c-ink)] font-semibold" : "fill-[var(--c-ink-3)]")}>
                  {isToday ? "Bugün" : dayFmt.format(date(d.day))}
                </text>
              )}
              {/* Geniş, görünmez hedef alan */}
              <rect
                x={pad.left + i * slot}
                y={pad.top}
                width={slot}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                tabIndex={0}
                aria-label={`${weekdayFmt.format(date(d.day))}: ${d.views} görüntülenme`}
                className="outline-none"
              />
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg bg-coal px-3 py-2 text-xs text-white shadow-float"
          style={{ left: `${((pad.left + hover * slot + slot / 2) / W) * 100}%` }}
        >
          <p className="text-white/65">{weekdayFmt.format(date(data[hover].day))}</p>
          <p className="mt-0.5 font-bold tabular">{formatNumber(data[hover].views)} görüntülenme</p>
        </div>
      )}
      <table className="sr-only">
        <caption>Günlük menü görüntülenmeleri</caption>
        <thead>
          <tr>
            <th>Gün</th>
            <th>Görüntülenme</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.day}>
              <td>{weekdayFmt.format(date(d.day))}</td>
              <td>{d.views}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div aria-busy="true" aria-label="Yükleniyor">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-[9.5rem] rounded-2xl" />
        ))}
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div className="skeleton h-80 rounded-2xl lg:col-span-2" />
        <div className="skeleton h-80 rounded-2xl" />
      </div>
    </div>
  );
}

export function Overview() {
  const boot = useBoot();
  const { data, error, loading, reload } = useResource<DashboardSummary>("/ozet");

  const header = (
    <PageHeader
      title="Genel Bakış"
      description={`Hoş geldiniz, ${boot.user.name}. Menünüzün güncel durumu aşağıda.`}
      actions={
        <>
          <ButtonLink to={boot.menuUrl} external icon={LuExternalLink}>
            Menüyü aç
          </ButtonLink>
          <ButtonLink to="/yonetim/urunler/yeni" variant="primary" icon={LuPlus}>
            Yeni ürün
          </ButtonLink>
        </>
      }
    />
  );

  if (loading && !data) return (<>{header}<OverviewSkeleton /></>);
  if (error || !data) return (<>{header}<ErrorState message={error?.message ?? "Veriler yüklenemedi."} onRetry={reload} /></>);

  const t = data.totals;
  const today = data.views[data.views.length - 1]?.views ?? 0;
  const attention = [
    t.soldOutProducts > 0 && { icon: LuPackageX, text: `${t.soldOutProducts} ürün tükendi olarak işaretli`, to: "/yonetim/menu" },
    t.productsWithoutImage > 0 && { icon: LuImage, text: `${t.productsWithoutImage} ürünün fotoğrafı yok`, to: "/yonetim/urunler?durum=noimage" },
    t.inactiveProducts > 0 && { icon: LuEyeOff, text: `${t.inactiveProducts} ürün menüde gizli`, to: "/yonetim/urunler?durum=inactive" },
    t.categories - t.activeCategories > 0 && { icon: LuLayers, text: `${t.categories - t.activeCategories} kategori menüde gizli`, to: "/yonetim/kategoriler" },
  ].filter(Boolean) as { icon: IconType; text: string; to: string }[];

  return (
    <>
      {header}

      {!data.menuPublished && (
        <div role="status" className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl bg-warn/10 px-5 py-4 text-sm text-[#7a4f08] ring-1 ring-warn/25">
          <LuCircleAlert className="size-5 shrink-0" aria-hidden="true" />
          <p className="flex-1">
            <strong>Menünüz şu an yayında değil.</strong> Müşterileriniz QR kodu okuttuğunda bilgilendirme mesajını görüyor.
          </p>
          <Link to="/yonetim/ayarlar" className="font-semibold underline underline-offset-2">
            Yayın ayarlarına git
          </Link>
        </div>
      )}
      {!data.siteUrlConfigured && (
        <div role="status" className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl bg-surface px-5 py-4 text-sm text-ink-2 ring-1 ring-line">
          <LuGlobe className="size-5 shrink-0 text-ember-deep" aria-hidden="true" />
          <p className="flex-1">
            <strong className="text-ink">Kalıcı menü adresi tanımlanmadı.</strong> QR kodu basmadan önce alan adınızı Genel Ayarlar'dan girin.
          </p>
          <Link to="/yonetim/ayarlar" className="font-semibold text-ink underline underline-offset-2">
            Adresi tanımla
          </Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile icon={LuUtensils} label="Toplam ürün" value={t.products} sub={`${t.activeProducts} aktif, ${t.inactiveProducts} pasif`} />
        <StatTile icon={LuLayers} label="Kategori" value={t.categories} sub={`${t.activeCategories} kategori menüde görünüyor`} />
        <StatTile icon={LuCircleCheck} label="Aktif ürün" value={t.activeProducts} sub={t.soldOutProducts ? `${t.soldOutProducts} ürün şu an tükendi` : "Menüde görünen ürünler"} />
        <StatTile icon={LuEye} label="Menü görüntülenme" value={data.viewsTotal} sub={`Son 14 gün; bugün ${formatNumber(today)}`} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Panel title="Menü görüntülenmeleri" description="QR kod veya bağlantı ile menünün açılma sayısı (son 14 gün)" className="lg:col-span-2">
          {data.viewsTotal === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <LuChartColumn className="size-8 text-ink-3" aria-hidden="true" />
              <p className="mt-3 font-semibold text-ink">Henüz görüntülenme yok</p>
              <p className="mt-1 max-w-sm text-sm text-ink-3">
                QR kodu masalara yerleştirdiğinizde menünün kaç kez açıldığını burada göreceksiniz. Kişisel veri tutulmaz.
              </p>
            </div>
          ) : (
            <ViewsChart data={data.views} />
          )}
        </Panel>

        <Panel title="Son değişiklikler" padded={false}>
          {data.activity.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-10 text-center">
              <LuHistory className="size-7 text-ink-3" aria-hidden="true" />
              <p className="mt-3 text-sm text-ink-3">Menüde yaptığınız değişiklikler burada listelenir.</p>
            </div>
          ) : (
            <ol className="divide-y divide-line">
              {data.activity.map((a) => (
                <li key={a.id} className="flex gap-3 px-5 py-3.5 sm:px-6">
                  <span
                    className={cx(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      a.action === "delete" ? "bg-bad" : a.action === "create" ? "bg-ok" : "bg-ember",
                    )}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="text-sm leading-snug text-ink">{a.summary}</p>
                    <p className="mt-0.5 text-xs text-ink-3">
                      {formatRelative(a.createdAt)}
                      {a.userName ? `, ${a.userName}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel title="Dikkat gerektirenler" padded={false}>
          {attention.length === 0 ? (
            <p className="flex items-center gap-2.5 px-6 py-6 text-sm text-ink-2">
              <LuCircleCheck className="size-5 text-ok" aria-hidden="true" />
              Her şey yolunda: tüm ürünler satışta ve fotoğraflı.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {attention.map((a) => (
                <li key={a.text}>
                  <Link to={a.to} className="group flex items-center gap-3 px-5 py-3.5 text-sm text-ink hover:bg-raised sm:px-6">
                    <a.icon className="size-4 shrink-0 text-ember-deep" aria-hidden="true" />
                    <span className="flex-1">{a.text}</span>
                    <LuArrowRight className="size-4 text-ink-3 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="En çok incelenen ürünler" description="Son 30 günde ayrıntısı en çok açılanlar" padded={false}>
          {data.topProducts.length === 0 ? (
            <p className="px-6 py-6 text-sm text-ink-3">Müşteriler ürün ayrıntılarını açtıkça liste burada oluşur.</p>
          ) : (
            <ol className="divide-y divide-line">
              {data.topProducts.map((p, i) => (
                <li key={p.id}>
                  <Link to={`/yonetim/urunler/${p.id}`} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-raised sm:px-6">
                    <span className="w-5 text-ink-3 tabular">{i + 1}.</span>
                    <span className="flex-1 font-semibold text-ink">{p.name}</span>
                    <span className="text-ink-2 tabular">{formatNumber(p.views)}</span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </>
  );
}
