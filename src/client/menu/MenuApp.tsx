import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { LuArrowRight, LuChefHat, LuSearch, LuSearchX, LuSlidersHorizontal, LuX } from "react-icons/lu";
import { BADGE_LABEL } from "../../shared/catalog";
import { searchKey } from "../../shared/format";
import type { ImageCredit, PublicCategory, PublicMenu, PublicProduct } from "../../shared/types";
import { CategoryIcon } from "../ui/icons";
import { BottomNav, WhatsAppButton, type BottomTab } from "./BottomNav";
import { ALL_VIEW, CategoryTiles, FEATURED_VIEW } from "./CategoryTiles";
import { BrandMark, MenuHeader } from "./Header";
import { Hero } from "./Hero";
import { InfoSection } from "./InfoSection";
import { ProductCard, ProductGrid, cx } from "./ProductCard";
import { ProductDialog } from "./ProductDialog";
import { CategorySheet, CreditsSheet, FilterSheet, type MenuFilters } from "./Sheets";
import { prefersReducedMotion, scrollToId, track, useInView, useOpenStatus, useScrolled } from "./hooks";

export interface MenuAppProps {
  data: PublicMenu;
  /** Sunucuya ?urun=... ile gelindiyse açılacak ürün */
  initialSlug: string | null;
  /** ?urun=... bulunamadıysa bilgi mesajı göster */
  missingProduct: boolean;
  /** ?kategori=... ile gelindiyse seçili görünüm ("tumu", "one-cikanlar" ya da kategori kısa adı) */
  initialView: string;
}

type SheetKind = "categories" | "filters" | "credits" | null;

/** URL'deki ?kategori= değerini geçerli bir görünüme çevirir (sunucu ve istemci aynı sonucu üretir) */
export function resolveView(raw: string | null, data: PublicMenu): string {
  if (!raw) return ALL_VIEW;
  if (raw === FEATURED_VIEW && data.featured.length) return FEATURED_VIEW;
  return data.categories.some((c) => c.slug === raw) ? raw : ALL_VIEW;
}

function SectionHeader({ id, title, icon, aside }: { id: string; title: string; icon?: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <h2 id={id} className="flex min-w-0 items-center gap-2.5 font-display text-[1.25rem] font-semibold text-ink md:text-[1.4rem]">
        {icon}
        <span className="truncate">{title}</span>
      </h2>
      {aside}
    </div>
  );
}

export function MenuApp({ data, initialSlug, missingProduct, initialView }: MenuAppProps) {
  const { restaurant, design, categories, featured } = data;
  const status = useOpenStatus(restaurant.hours, data.timezone, data.generatedAt);

  const productIndex = useMemo(() => {
    const map = new Map<string, { product: PublicProduct; category: PublicCategory }>();
    for (const c of categories) for (const p of c.products) map.set(p.slug, { product: p, category: c });
    return map;
  }, [categories]);
  const iconFor = useCallback((p: PublicProduct) => categories.find((c) => c.id === p.categoryId)?.icon ?? "utensils", [categories]);

  // --- Ürün penceresi ----------------------------------------------------
  const [openSlug, setOpenSlug] = useState<string | null>(initialSlug && productIndex.has(initialSlug) ? initialSlug : null);
  const pushedRef = useRef(false);
  const open = openSlug ? (productIndex.get(openSlug) ?? null) : null;

  const openProduct = useCallback(
    (p: PublicProduct, e?: MouseEvent) => {
      if (e && (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1)) return; // yeni sekmede açma isteğine saygı
      e?.preventDefault();
      setOpenSlug(p.slug);
      if (!data.preview) track("product", p.id);
      const url = new URL(window.location.href);
      url.searchParams.set("urun", p.slug);
      url.hash = "";
      window.history.pushState({ urun: p.slug }, "", url);
      pushedRef.current = true;
    },
    [data.preview],
  );

  const closeProduct = useCallback(() => {
    setOpenSlug(null);
    if (pushedRef.current) {
      pushedRef.current = false;
      window.history.back();
    } else {
      const url = new URL(window.location.href);
      url.searchParams.delete("urun");
      window.history.replaceState(null, "", url);
    }
  }, []);

  useEffect(() => {
    const onPop = () => {
      const slug = new URL(window.location.href).searchParams.get("urun");
      pushedRef.current = false;
      setOpenSlug(slug && productIndex.has(slug) ? slug : null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [productIndex]);

  // --- Görünüm (kategori sekmeleri), arama ve filtreler -------------------
  const [view, setView] = useState(initialView);
  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [filters, setFilters] = useState<MenuFilters>({ badges: [], hideSoldOut: false });
  const [sheet, setSheet] = useState<SheetKind>(null);

  const filterCount = filters.badges.length + (filters.hideSoldOut ? 1 : 0);
  const matches = useCallback(
    (p: PublicProduct) => filters.badges.every((b) => p.badges.includes(b)) && (!filters.hideSoldOut || !p.isSoldOut),
    [filters],
  );
  const visibleCats = useMemo(
    () => categories.map((c) => ({ ...c, products: c.products.filter(matches) })).filter((c) => c.products.length > 0),
    [categories, matches],
  );
  const visibleFeatured = useMemo(() => featured.filter(matches), [featured, matches]);
  const visibleCount = visibleCats.reduce((s, c) => s + c.products.length, 0);
  const totalCount = categories.reduce((s, c) => s + c.products.length, 0);

  const results = useMemo(() => {
    const q = searchKey(query);
    if (!q) return null;
    const tokens = q.split(" ");
    const out: PublicProduct[] = [];
    for (const c of visibleCats) {
      for (const p of c.products) {
        const hay = searchKey(p.name, p.description, c.name, p.badges.map((b) => BADGE_LABEL[b]).join(" "));
        if (tokens.every((t) => hay.includes(t))) out.push(p);
      }
    }
    return out;
  }, [query, visibleCats]);

  const selectView = useCallback((next: string, opts: { scroll?: boolean } = {}) => {
    setView(next);
    setQuery("");
    setSheet(null);
    const url = new URL(window.location.href);
    if (next === ALL_VIEW) url.searchParams.delete("kategori");
    else url.searchParams.set("kategori", next);
    window.history.replaceState(window.history.state, "", url);
    window.requestAnimationFrame(() => {
      const tiles = document.getElementById("kategoriler");
      if (!tiles) return;
      if (opts.scroll || tiles.getBoundingClientRect().top < 64) scrollToId("kategoriler");
    });
  }, []);

  const focusSearch = useCallback(() => {
    setSheet(null);
    const input = document.getElementById("menu-arama") as HTMLInputElement | null;
    if (!input) return;
    input.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" });
    window.setTimeout(() => input.focus({ preventScroll: true }), 280);
  }, []);

  const goHome = useCallback(() => {
    setSheet(null);
    setQuery("");
    if (view !== ALL_VIEW) selectView(ALL_VIEW);
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [view, selectView]);
  const goContact = useCallback(() => {
    setSheet(null);
    scrollToId("iletisim");
  }, []);

  // --- Gezinme durumları ------------------------------------------------------
  const contactInView = useInView("iletisim", 0.2);
  const scrolled = useScrolled(260);
  const headerActive = contactInView ? "contact" : "menu";
  const bottomActive: BottomTab =
    sheet === "categories" ? "menu" : searchFocused ? "search" : contactInView ? "contact" : scrolled ? "menu" : "home";

  // --- Diğer --------------------------------------------------------------
  const [notice, setNotice] = useState(missingProduct);
  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(false), 7000);
    return () => window.clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    if (!data.preview) track("menu");
  }, [data.preview]);

  const credits = useMemo(() => {
    const seen = new Set<string>();
    const items: { label: string; credit: ImageCredit }[] = [];
    if (restaurant.cover?.credit) {
      seen.add(restaurant.cover.id);
      items.push({ label: "Kapak fotoğrafı", credit: restaurant.cover.credit });
    }
    for (const c of categories)
      for (const p of c.products)
        if (p.image?.credit && !seen.has(p.image.id)) {
          seen.add(p.image.id);
          items.push({ label: p.name, credit: p.image.credit });
        }
    return items;
  }, [restaurant.cover, categories]);

  const isEmpty = categories.length === 0;
  const year = new Date(data.generatedAt).getFullYear();
  const activeCat = visibleCats.find((c) => c.slug === view);
  const clearFilters = () => setFilters({ badges: [], hideSoldOut: false });

  const noFilterResults = (
    <div className="mx-auto max-w-md py-14 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-raised">
        <LuSlidersHorizontal className="size-6 text-accent-text" aria-hidden="true" />
      </span>
      <h2 className="mt-5 font-display text-xl font-semibold text-ink">Bu filtrelere uygun ürün yok</h2>
      <p className="mt-2 text-sm text-ink-2">Seçtiğiniz özelliklerin bir kısmını kaldırmayı deneyin.</p>
      <button type="button" onClick={clearFilters} className="mt-6 h-11 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-ink">
        Filtreleri temizle
      </button>
    </div>
  );

  let content: React.ReactNode;
  if (isEmpty) {
    content = <EmptyMenu />;
  } else if (results) {
    content = <SearchResults query={query} results={results} onOpen={openProduct} onClear={() => setQuery("")} iconFor={iconFor} />;
  } else if (visibleCount === 0) {
    content = noFilterResults;
  } else if (view === FEATURED_VIEW) {
    content = (
      <section aria-labelledby="one-cikanlar" className="pt-8 md:pt-10">
        <SectionHeader
          id="one-cikanlar"
          title="Öne Çıkanlar"
          aside={<span className="shrink-0 text-sm text-ink-3 tabular">{visibleFeatured.length} ürün</span>}
        />
        <p className="mt-1 text-sm text-ink-3">Şefimizin önerdiği lezzetler</p>
        <div className="mt-5">
          {visibleFeatured.length ? <ProductGrid products={visibleFeatured} icon="utensils" iconFor={iconFor} onOpen={openProduct} /> : noFilterResults}
        </div>
      </section>
    );
  } else if (view !== ALL_VIEW) {
    content = activeCat ? (
      <CategorySection category={activeCat} onOpen={openProduct} first />
    ) : (
      noFilterResults
    );
  } else {
    content = (
      <>
        {design.showFeatured && visibleFeatured.length > 0 && (
          <section aria-labelledby="one-cikanlar" className="pt-8">
            <SectionHeader
              id="one-cikanlar"
              title="Öne Çıkanlar"
              aside={
                <a
                  href={`?kategori=${FEATURED_VIEW}`}
                  onClick={(e) => {
                    e.preventDefault();
                    selectView(FEATURED_VIEW, { scroll: true });
                  }}
                  className="inline-flex shrink-0 items-center gap-1.5 text-[0.85rem] font-medium text-accent-text hover:underline hover:underline-offset-4"
                >
                  Tümünü Gör
                  <LuArrowRight className="size-4" aria-hidden="true" />
                </a>
              }
            />
            <ul className="no-scrollbar -mx-4 mt-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:scroll-px-6 sm:px-6 md:mx-0 md:mt-4 md:grid md:grid-cols-2 md:gap-5 md:overflow-visible md:px-0 md:pb-1 lg:grid-cols-4 lg:gap-6 md:[&>li:nth-child(n+5)]:hidden">
              {visibleFeatured.slice(0, 8).map((p, i) => (
                <li key={p.id} className="w-[85%] max-w-[22rem] shrink-0 snap-start md:w-auto md:max-w-none">
                  <ProductCard product={p} icon={iconFor(p)} layout="featured" onOpen={openProduct} priority={i < 2} />
                </li>
              ))}
            </ul>
          </section>
        )}
        {visibleCats.map((c, i) => (
          <CategorySection key={c.id} category={c} onOpen={openProduct} first={i === 0 && !(design.showFeatured && visibleFeatured.length > 0)} />
        ))}
      </>
    );
  }

  return (
    <div className="menu-root min-h-dvh pb-16 md:pb-0">
      <a
        href="#menu-icerik"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-ink"
      >
        Menüye geç
      </a>

      <MenuHeader
        restaurant={restaurant}
        active={headerActive}
        filterCount={filterCount}
        showSearch={design.showSearch && !isEmpty}
        onHome={goHome}
        onMenu={() => scrollToId("kategoriler")}
        onContact={goContact}
        onSearch={focusSearch}
        onCategories={() => setSheet("categories")}
        onFilters={() => setSheet("filters")}
      />

      <main id="menu">
        <Hero restaurant={restaurant} status={status} />

        <div className="mx-auto w-full max-w-[80rem] px-4 sm:px-6 lg:px-8">
          {design.showSearch && !isEmpty && (
            <div className="relative z-10 -mt-7 md:pl-12">
              <div className="md:w-[62%] md:max-w-[44rem]">
                <SearchField value={query} onChange={setQuery} onFocusChange={setSearchFocused} />
              </div>
            </div>
          )}

          {!isEmpty && (
            <div className={design.showSearch ? "mt-5" : "mt-6"}>
              <CategoryTiles categories={categories} active={results ? null : view} onSelect={(v) => selectView(v)} />
            </div>
          )}

          {filterCount > 0 && (
            <div role="status" className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-tint px-4 py-2.5 text-sm text-ink-2">
              <LuSlidersHorizontal className="size-4 text-accent-text" aria-hidden="true" />
              <span className="font-medium text-ink">
                {[...filters.badges.map((b) => BADGE_LABEL[b]), ...(filters.hideSoldOut ? ["Tükenenler gizli"] : [])].join(", ")}
              </span>
              <span className="text-ink-3">· {visibleCount} ürün</span>
              <button type="button" onClick={clearFilters} className="ml-auto inline-flex items-center gap-1 font-semibold text-accent-text">
                <LuX className="size-4" aria-hidden="true" /> Temizle
              </button>
            </div>
          )}

          <div id="menu-icerik">{content}</div>
        </div>
      </main>

      <InfoSection
        restaurant={restaurant}
        status={status}
        timeZone={data.timezone}
        year={year}
        hasCredits={credits.length > 0}
        onShowCredits={() => setSheet("credits")}
      />

      <ProductDialog
        product={open?.product ?? null}
        categoryName={open?.category.name ?? ""}
        categoryIcon={open?.category.icon ?? "utensils"}
        ssrOpen={!!(initialSlug && open && initialSlug === openSlug)}
        onClose={closeProduct}
      />

      <CategorySheet
        open={sheet === "categories"}
        onClose={() => setSheet(null)}
        categories={categories}
        active={view}
        totalCount={totalCount}
        onSelect={(v) => selectView(v, { scroll: true })}
        onContact={goContact}
      />
      <FilterSheet open={sheet === "filters"} onClose={() => setSheet(null)} filters={filters} onChange={setFilters} resultCount={visibleCount} />
      <CreditsSheet open={sheet === "credits"} onClose={() => setSheet(null)} items={credits} />

      {notice && (
        <div role="status" className="toast-enter fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-40 mx-auto max-w-md md:bottom-6">
          <div className="flex items-start gap-3 rounded-2xl bg-[#1b1f27] px-4 py-3.5 text-sm text-white shadow-float">
            <LuSearchX className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p className="flex-1">Aradığınız ürün şu an menüde yer almıyor. Güncel menümüze aşağıdan göz atabilirsiniz.</p>
            <button type="button" onClick={() => setNotice(false)} aria-label="Bildirimi kapat" className="-m-1 rounded-full p-1 hover:bg-white/10">
              <LuX className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {!isEmpty && (
        <BottomNav
          active={bottomActive}
          showSearch={design.showSearch}
          onHome={goHome}
          onMenu={() => setSheet("categories")}
          onSearch={focusSearch}
          onContact={goContact}
        />
      )}
      {restaurant.whatsapp && !data.preview && <WhatsAppButton phone={restaurant.whatsapp} />}
    </div>
  );
}

function CategorySection({ category: c, onOpen, first }: { category: PublicCategory; onOpen: (p: PublicProduct, e: MouseEvent) => void; first?: boolean }) {
  return (
    <section id={c.slug} aria-labelledby={`kategori-${c.slug}`} className={cx("scroll-mt-24", first ? "pt-8 md:pt-10" : "pt-10 md:pt-14")}>
      <SectionHeader
        id={`kategori-${c.slug}`}
        title={c.name}
        icon={<CategoryIcon name={c.icon} className="size-7 md:size-8" />}
        aside={<span className="shrink-0 text-sm text-ink-3 tabular">{c.products.length} ürün</span>}
      />
      {c.description && <p className="mt-1.5 max-w-3xl text-[0.88rem] leading-relaxed text-ink-3">{c.description}</p>}
      <div className="mt-4 md:mt-5">
        <ProductGrid products={c.products} icon={c.icon} onOpen={onOpen} />
      </div>
    </section>
  );
}

function SearchField({ value, onChange, onFocusChange }: { value: string; onChange: (v: string) => void; onFocusChange: (f: boolean) => void }) {
  return (
    <div role="search" className="relative">
      <label htmlFor="menu-arama" className="sr-only">
        Menüde ara
      </label>
      <LuSearch className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-3" aria-hidden="true" />
      <input
        id="menu-arama"
        type="search"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => onFocusChange(true)}
        onBlur={() => onFocusChange(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onChange("");
        }}
        placeholder="Ürün veya kategori ara…"
        className="h-14 w-full rounded-xl border border-line bg-surface pl-12 pr-12 text-[0.95rem] text-ink shadow-search outline-none transition-[border-color,box-shadow] placeholder:text-ink-3 focus:border-[var(--c-accent)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--c-accent)_18%,transparent)]"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Aramayı temizle"
          className="absolute right-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-ink-2 hover:bg-raised"
        >
          <LuX className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

function SearchResults({
  query,
  results,
  onOpen,
  onClear,
  iconFor,
}: {
  query: string;
  results: PublicProduct[];
  onOpen: (p: PublicProduct, e: MouseEvent) => void;
  onClear: () => void;
  iconFor: (p: PublicProduct) => string;
}) {
  return (
    <section aria-live="polite" aria-labelledby="arama-baslik" className="pt-8 md:pt-10">
      {results.length === 0 ? (
        <div className="mx-auto max-w-md py-12 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-raised">
            <LuSearchX className="size-6 text-accent-text" aria-hidden="true" />
          </span>
          <h2 id="arama-baslik" className="mt-5 font-display text-xl font-semibold text-ink">
            “{query.trim()}” için sonuç yok
          </h2>
          <p className="mt-2 text-sm text-ink-2">Farklı bir kelime deneyin ya da tüm menüye dönün.</p>
          <button type="button" onClick={onClear} className="mt-6 h-11 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-ink transition-[filter] hover:brightness-105">
            Tüm menüyü göster
          </button>
        </div>
      ) : (
        <>
          <SectionHeader id="arama-baslik" title="Arama sonuçları" aside={<span className="shrink-0 text-sm text-ink-3 tabular">{results.length} ürün</span>} />
          <div className="mt-4 md:mt-5">
            <ProductGrid products={results} icon="utensils" iconFor={iconFor} onOpen={onOpen} />
          </div>
        </>
      )}
    </section>
  );
}

function EmptyMenu() {
  return (
    <section className="mx-auto max-w-md py-16 text-center">
      <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-raised">
        <LuChefHat className="size-7 text-accent-text" aria-hidden="true" />
      </span>
      <h2 className="mt-5 font-display text-2xl font-semibold text-ink">Menümüz hazırlanıyor</h2>
      <p className="mt-2 leading-relaxed text-ink-2">
        Lezzetlerimizi çok yakında burada görebileceksiniz. Siparişiniz için garsonumuza danışabilirsiniz.
      </p>
    </section>
  );
}

/** Menü yayından kaldırıldığında gösterilen sayfa (Genel Ayarlar → Menü yayında) */
export function MenuUnavailable({ data, message }: { data: PublicMenu; message: string }) {
  const r = data.restaurant;
  return (
    <main className="menu-header relative grid min-h-dvh place-items-center px-6 py-16 text-center text-white">
      <div className="relative max-w-md">
        <div className="mx-auto flex w-fit justify-center">
          <BrandMark restaurant={r} size="lg" />
        </div>
        <p className="mt-8 leading-relaxed text-white/80">{message}</p>
        {r.phone && (
          <a
            href={`tel:${r.phone.replace(/[^\d+]/g, "")}`}
            className="mt-8 inline-flex rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-ink"
          >
            Bizi arayın: {r.phone}
          </a>
        )}
      </div>
    </main>
  );
}
