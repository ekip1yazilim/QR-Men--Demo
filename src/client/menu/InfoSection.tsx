import { LuClock, LuInstagram, LuMail, LuMapPin, LuMessageCircle, LuNavigation, LuPhone } from "react-icons/lu";
import type { IconType } from "react-icons";
import { instagramHandle, instagramHref, telHref, whatsappHref } from "../../shared/format";
import { DAY_NAMES, zonedNow } from "../../shared/hours";
import type { RestaurantInfo } from "../../shared/types";
import { BrandMark } from "./Header";

interface Props {
  restaurant: RestaurantInfo;
  status: { isOpen: boolean; title: string; detail: string; now: Date };
  timeZone: string;
  year: number;
  hasCredits: boolean;
  onShowCredits: () => void;
  onShowPrivacy: () => void;
}

function ContactLine({ icon: Icon, children, href, external }: { icon: IconType; children: React.ReactNode; href?: string; external?: boolean }) {
  const body = (
    <>
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-tint">
        <Icon className="size-4 text-accent-text" aria-hidden="true" />
      </span>
      <span className="min-w-0 self-center break-words text-[0.92rem]">{children}</span>
    </>
  );
  return (
    <li>
      {href ? (
        <a
          href={href}
          className="-mx-2 flex gap-3 rounded-xl px-2 py-1.5 text-ink transition-colors hover:bg-raised"
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {body}
        </a>
      ) : (
        <div className="flex gap-3 py-1.5 text-ink">{body}</div>
      )}
    </li>
  );
}

export function InfoSection({ restaurant: r, status, timeZone, year, hasCredits, onShowCredits, onShowPrivacy }: Props) {
  const today = zonedNow(status.now, timeZone).day;
  const mapsHref = r.mapsUrl || (r.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.address)}` : "");
  const hasContact = r.address || r.phone || r.whatsapp || r.email || r.instagram;

  return (
    <section id="iletisim" aria-labelledby="iletisim-baslik" className="mt-16 scroll-mt-20 border-t border-line bg-raised md:mt-20">
      <div className="mx-auto grid w-full max-w-[80rem] gap-5 px-4 py-12 sm:px-6 md:grid-cols-2 md:gap-6 md:py-14 lg:px-8">
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-7">
          <h2 id="iletisim-baslik" className="font-display text-xl font-semibold text-ink">
            İletişim
          </h2>
          {r.description && <p className="mt-2 max-w-prose whitespace-pre-line text-[0.92rem] leading-relaxed text-ink-2">{r.description}</p>}

          {hasContact && (
            <ul className="mt-5 space-y-1">
              {r.address && (
                <ContactLine icon={LuMapPin} href={mapsHref || undefined} external>
                  {r.address}
                </ContactLine>
              )}
              {r.phone && (
                <ContactLine icon={LuPhone} href={telHref(r.phone)}>
                  {r.phone}
                </ContactLine>
              )}
              {r.whatsapp && (
                <ContactLine icon={LuMessageCircle} href={whatsappHref(r.whatsapp)} external>
                  WhatsApp: {r.whatsapp}
                </ContactLine>
              )}
              {r.email && (
                <ContactLine icon={LuMail} href={`mailto:${r.email}`}>
                  {r.email}
                </ContactLine>
              )}
              {r.instagram && (
                <ContactLine icon={LuInstagram} href={instagramHref(r.instagram)} external>
                  {instagramHandle(r.instagram)}
                </ContactLine>
              )}
            </ul>
          )}

          {(r.phone || mapsHref) && (
            <div className="mt-6 flex flex-wrap gap-2.5">
              {r.phone && (
                <a
                  href={telHref(r.phone)}
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-ink transition-[filter] hover:brightness-105"
                >
                  <LuPhone className="size-4" aria-hidden="true" />
                  Hemen ara
                </a>
              )}
              {mapsHref && (
                <a
                  href={mapsHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-surface px-5 text-sm font-semibold text-ink transition-colors hover:bg-raised"
                >
                  <LuNavigation className="size-4" aria-hidden="true" />
                  Yol tarifi al
                </a>
              )}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-7">
          <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-ink">
            <LuClock className="size-5 text-accent-text" aria-hidden="true" />
            Çalışma saatleri
          </h2>
          <p className="mt-2 flex items-center gap-2 text-sm">
            <span className={`size-2 rounded-full ${status.isOpen ? "bg-[#22a35a]" : "bg-ink-3"}`} aria-hidden="true" />
            <span className="font-semibold text-ink">{status.title}</span>
            {status.detail && <span className="text-ink-3">{status.detail}</span>}
          </p>
          <dl className="mt-4 divide-y divide-line">
            {r.hours.map((d, i) => (
              <div key={i} className={`flex items-center justify-between py-2.5 text-[0.92rem] ${i === today ? "font-semibold text-ink" : "text-ink-2"}`}>
                <dt className="flex items-center gap-2">
                  {DAY_NAMES[i]}
                  {i === today && <span className="rounded-full bg-tint px-2 py-0.5 text-[0.68rem] font-semibold text-accent-text">Bugün</span>}
                </dt>
                <dd className="tabular">{d.closed ? "Kapalı" : `${d.open} – ${d.close}`}</dd>
              </div>
            ))}
          </dl>
          {r.hoursNote && <p className="mt-3 text-[0.82rem] text-ink-3">{r.hoursNote}</p>}
        </div>
      </div>

      <footer className="menu-header text-white/70">
        <div className="mx-auto flex w-full max-w-[80rem] flex-col gap-4 px-4 py-8 pb-[max(2rem,calc(env(safe-area-inset-bottom)+5.5rem))] sm:px-6 md:flex-row md:items-center md:justify-between md:pb-8 lg:px-8">
          <BrandMark restaurant={r} />
          <div className="text-[0.8rem] leading-relaxed md:text-right">
            {r.footerNote && <p>{r.footerNote}</p>}
            <p className="mt-1 text-white/50">
              © {year} {r.name}
              {" · "}
              <button type="button" onClick={onShowPrivacy} className="underline underline-offset-2 hover:text-white">
                Gizlilik ve çerezler
              </button>
              {hasCredits && (
                <>
                  {" · "}
                  <button type="button" onClick={onShowCredits} className="underline underline-offset-2 hover:text-white">
                    Fotoğraf kaynakları
                  </button>
                </>
              )}
            </p>
          </div>
        </div>
      </footer>
    </section>
  );
}
