import { useEffect, useMemo, useState } from "react";
import { getOpenStatus } from "../../shared/hours";
import type { WeekHours } from "../../shared/types";

/** Açık/kapalı durumu. İlk render sunucunun zamanıyla yapılır (hydration tutarlılığı), sonra dakikada bir güncellenir. */
export function useOpenStatus(hours: WeekHours, timeZone: string, generatedAt: string) {
  const [now, setNow] = useState(() => new Date(generatedAt));
  useEffect(() => {
    setNow(new Date());
    const t = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  return useMemo(() => ({ ...getOpenStatus(hours, now, timeZone), now }), [hours, now, timeZone]);
}

/** Bir öğenin ekranda görünüp görünmediği (alt gezinme çubuğundaki etkin sekme için) */
export function useInView(id: string, threshold = 0.25): boolean {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = document.getElementById(id);
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [id, threshold]);
  return inView;
}

/** Sayfa belirli bir mesafeden fazla kaydırıldı mı? */
export function useScrolled(offset: number): boolean {
  const [past, setPast] = useState(false);
  useEffect(() => {
    const on = () => setPast(window.scrollY > offset);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, [offset]);
  return past;
}

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function scrollToId(id: string, block: ScrollLogicalPosition = "start") {
  document.getElementById(id)?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block });
}

/**
 * Anonim görüntülenme sayacı. Oturum başına bir kez gönderilir; çerez veya kişisel veri kullanılmaz.
 */
export function track(kind: "menu" | "product", productId?: number) {
  try {
    const key = kind === "menu" ? "gm" : `gp${productId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch {
    /* gizli sekme vb. — yine de gönder */
  }
  try {
    void fetch("/api/goruntulenme", {
      method: "POST",
      keepalive: true,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(kind === "menu" ? { tur: "menu" } : { tur: "urun", id: productId }),
    }).catch(() => {});
  } catch {
    /* sayaç hatası menüyü etkilemez */
  }
}
