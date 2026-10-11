/** Kapak: yuvarlatılmış yemek fotoğrafı, soldan koyulaşan katman, büyük beyaz başlık ve çalışma durumu */
import type { RestaurantInfo } from "../../shared/types";
import { Img } from "../ui/Img";

export function OpenStatusPill({ isOpen, title, detail }: { isOpen: boolean; title: string; detail: string }) {
  return (
    <p className="inline-flex max-w-full items-center gap-2 rounded-full bg-black/35 py-1 pl-2.5 pr-3.5 text-[0.72rem] text-white/90 ring-1 ring-white/15 backdrop-blur-md md:text-[0.82rem]">
      <span className="relative flex size-2" aria-hidden="true">
        {isOpen && <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#4ade80] opacity-50 motion-reduce:hidden" />}
        <span className={`relative inline-flex size-2 rounded-full ${isOpen ? "bg-[#4ade80]" : "bg-white/50"}`} />
      </span>
      <span className="font-semibold text-white">{title}</span>
      {detail && <span className="truncate text-white/75">{detail}</span>}
    </p>
  );
}

interface HeroProps {
  restaurant: RestaurantInfo;
  status: { isOpen: boolean; title: string; detail: string };
}

export function Hero({ restaurant, status }: HeroProps) {
  const { cover } = restaurant;
  const title = restaurant.heroTitle || restaurant.name;
  return (
    <div className="mx-auto w-full max-w-[80rem] md:px-6 md:pt-6 lg:px-8">
      <section
        aria-label="Kapak"
        className="hero-wood relative isolate h-[14.25rem] overflow-hidden md:h-[16.5rem] md:rounded-2xl lg:h-[18rem]"
      >
        {cover ? (
          // Telefonda tam genişlik; geniş ekranda referanstaki gibi sağda, sola doğru koyu zemine yumuşakça kaybolur
          <div className="hero-photo absolute inset-y-0 right-0 -z-20 w-full md:w-[68%]">
            <Img image={cover} alt="" priority sizes="(min-width: 1280px) 830px, (min-width: 768px) 68vw, 100vw" className="size-full object-cover" />
          </div>
        ) : (
          <>
            <div className="ember-field absolute inset-0 -z-20" aria-hidden="true" />
            <div className="ember-grain absolute inset-0 -z-10" aria-hidden="true" />
          </>
        )}
        <div className="hero-shade absolute inset-0 -z-10" aria-hidden="true" />

        <div className="flex h-full max-w-[34rem] flex-col justify-center px-5 pb-9 pt-2 md:px-12 md:pb-10 md:pt-0">
          <h1 className="rise max-w-[15ch] font-display text-[1.6rem] font-semibold leading-[1.2] text-white md:max-w-none md:text-[2.35rem] lg:text-[2.6rem]">{title}</h1>
          {restaurant.tagline && (
            <p className="rise mt-1.5 max-w-[19rem] text-[0.78rem] leading-relaxed text-white/85 md:max-w-[26rem] [animation-delay:60ms] md:mt-3 md:text-[0.95rem]">
              {restaurant.tagline}
            </p>
          )}
          <div className="rise mt-2.5 [animation-delay:120ms] md:mt-4">
            <OpenStatusPill {...status} />
          </div>
        </div>
      </section>
    </div>
  );
}
