/** Renk yardımcıları: kontrast hesapları ile vurgu rengini her temada okunaklı tutar. */

export const MENU_BG = { dark: "#1b1c1f", light: "#ffffff" } as const;
export const INK_DARK = "#1e1f23";
export const INK_LIGHT = "#ffffff";
/** Fiyat ve bağlantı gibi kalın vurgu metinleri için en düşük kontrast oranı */
export const ACCENT_TEXT_CONTRAST = 3;

/** Tasarım ayarlarında sunulan hazır vurgu renkleri */
export const ACCENT_PRESETS: { name: string; value: string }[] = [
  { name: "Turuncu", value: "#F28C28" },
  { name: "Bakır", value: "#C8693A" },
  { name: "Safran", value: "#E0A030" },
  { name: "Nar", value: "#C73E3A" },
  { name: "Zeytin", value: "#7A8B3C" },
  { name: "Çam", value: "#2F7D62" },
  { name: "Gece mavisi", value: "#3E6FB0" },
  { name: "Mürdüm", value: "#8A4F8C" },
];

export function isHexColor(v: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(v);
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return "#" + [r, g, b].map((c) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, "0")).join("");
}

function channel(c: number) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function mix(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToHex([ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, ca[2] + (cb[2] - ca[2]) * t]);
}

/** Vurgu renginin üzerindeki metin rengi (koyu ya da beyaz — hangisi daha kontrastlıysa) */
export function inkOn(accent: string): string {
  return contrastRatio(accent, INK_DARK) >= contrastRatio(accent, INK_LIGHT) ? INK_DARK : INK_LIGHT;
}

/**
 * Zemin üzerinde metin olarak kullanılacak vurgu tonu.
 * Gerekirse rengi açar/koyulaştırır ki istenen kontrast sağlansın.
 */
export function readableOn(accent: string, background: string, min = 4.5): string {
  if (contrastRatio(accent, background) >= min) return accent;
  const towards = luminance(background) > 0.5 ? "#000000" : "#ffffff";
  for (let t = 0.05; t <= 1; t += 0.05) {
    const c = mix(accent, towards, t);
    if (contrastRatio(c, background) >= min) return c;
  }
  return towards;
}

export interface AccentTokens {
  accent: string;
  accentInk: string;
  accentText: string;
}

export function accentTokens(accent: string, mode: "dark" | "light"): AccentTokens {
  const safe = isHexColor(accent) ? accent.toLowerCase() : "#f28c28";
  return {
    accent: safe,
    accentInk: inkOn(safe),
    accentText: readableOn(safe, MENU_BG[mode], ACCENT_TEXT_CONTRAST),
  };
}

/** Sayfa gövdesine yazılacak CSS değişkenleri */
export function accentStyle(accent: string, mode: "dark" | "light"): string {
  const t = accentTokens(accent, mode);
  return `--c-accent:${t.accent};--c-accent-ink:${t.accentInk};--c-accent-text:${t.accentText}`;
}
