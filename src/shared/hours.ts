import type { DayHours, WeekHours } from "./types";

export const DAY_NAMES = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"] as const;
export const DAY_SHORT = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"] as const;

export const DEFAULT_HOURS: WeekHours = Array.from({ length: 7 }, () => ({ closed: false, open: "11:00", close: "23:00" }));

const WEEKDAY_INDEX: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Verilen saat diliminde haftanın günü (Pzt=0) ve gün içindeki dakika */
export function zonedNow(date: Date, timeZone: string): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  return { day: WEEKDAY_INDEX[get("weekday")] ?? 0, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

function spansMidnight(d: DayHours) {
  return toMinutes(d.close) <= toMinutes(d.open);
}

export interface OpenStatus {
  isOpen: boolean;
  /** Kısa durum metni: "Şu an açık" / "Şu an kapalı" */
  title: string;
  /** Ayrıntı: "Kapanış 23:00", "Açılış yarın 11:00" */
  detail: string;
}

/** Restoranın verilen andaki açık/kapalı durumu. */
export function getOpenStatus(hours: WeekHours, date: Date, timeZone: string): OpenStatus {
  if (!hours || hours.length !== 7) return { isOpen: false, title: "Çalışma saatleri", detail: "" };
  const { day, minutes } = zonedNow(date, timeZone);
  const today = hours[day];
  const yesterday = hours[(day + 6) % 7];

  // Dünden taşan gece vardiyası (ör. Cuma 11:00–02:00 → Cumartesi 01:30 hâlâ açık)
  if (!yesterday.closed && spansMidnight(yesterday) && minutes < toMinutes(yesterday.close)) {
    return { isOpen: true, title: "Şu an açık", detail: `Kapanış ${yesterday.close}` };
  }
  if (!today.closed) {
    const open = toMinutes(today.open);
    const close = toMinutes(today.close);
    const overnight = spansMidnight(today);
    if (minutes >= open && (overnight || minutes < close)) {
      return { isOpen: true, title: "Şu an açık", detail: `Kapanış ${today.close}` };
    }
    if (minutes < open) {
      return { isOpen: false, title: "Şu an kapalı", detail: `Açılış bugün ${today.open}` };
    }
  }
  // Sonraki açık günü bul
  for (let i = 1; i <= 7; i++) {
    const next = hours[(day + i) % 7];
    if (!next.closed) {
      const when = i === 1 ? "yarın" : DAY_NAMES[(day + i) % 7];
      return { isOpen: false, title: today.closed ? "Bugün kapalı" : "Şu an kapalı", detail: `Açılış ${when} ${next.open}` };
    }
  }
  return { isOpen: false, title: "Geçici olarak kapalı", detail: "" };
}

/** Aynı saatlere sahip ardışık günleri gruplar: "Pazartesi – Cuma: 11:00 – 23:00" */
export function groupHours(hours: WeekHours): { label: string; value: string; days: number[] }[] {
  const groups: { label: string; value: string; days: number[] }[] = [];
  hours.forEach((d, i) => {
    const value = d.closed ? "Kapalı" : `${d.open} – ${d.close}`;
    const last = groups[groups.length - 1];
    if (last && last.value === value) last.days.push(i);
    else groups.push({ label: "", value, days: [i] });
  });
  for (const g of groups) {
    const first = DAY_NAMES[g.days[0]];
    const lastDay = DAY_NAMES[g.days[g.days.length - 1]];
    g.label = g.days.length === 1 ? first : g.days.length === 2 ? `${first}, ${lastDay}` : `${first} – ${lastDay}`;
  }
  return groups;
}

/** schema.org openingHoursSpecification için gün adları */
export const SCHEMA_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
