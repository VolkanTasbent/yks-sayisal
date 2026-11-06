export const TYT_AT = new Date("2027-06-19T10:15:00+03:00");
export const EXAM_LAST_DAY = "2027-06-20";
export const PLAN_START_KEY = "yks-sayisal-plan-start";
export const JOURNAL_KEY = "yks-sayisal-gunluk-v1";

export type DayLog = {
  hours: string;
  note: string;
};

export type Journal = Record<string, DayLog>;

export function isoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDay(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function loadPlanStart(): string {
  const today = isoDate(new Date());
  let saved = "";
  try {
    saved = localStorage.getItem(PLAN_START_KEY) ?? "";
  } catch {
    saved = "";
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(saved) || saved > today) {
    try {
      localStorage.setItem(PLAN_START_KEY, today);
    } catch {
      /* The page still works if storage is blocked. */
    }
    return today;
  }
  return saved;
}

export function daysFrom(start: string, end: string): string[] {
  const days: string[] = [];
  const cursor = parseDay(start);
  const last = parseDay(end);
  if (Number.isNaN(cursor.getTime()) || cursor > last) return days;
  while (cursor <= last) {
    days.push(isoDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export function formatDay(iso: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    weekday: "long",
  }).format(parseDay(iso));
}

export function formatMonth(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("tr-TR", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

export function cleanHours(raw: string): string {
  const normalized = raw.replace(",", ".").replace(/[^\d.]/g, "");
  const [whole, ...rest] = normalized.split(".");
  const fraction = rest.join("").slice(0, 1);
  const merged = rest.length > 0 ? `${whole}.${fraction}` : whole;
  const value = Number(merged);
  if (merged !== "" && Number.isFinite(value) && value > 24) return "24";
  return merged;
}

export function hoursValue(raw: string): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(24, value);
}

export function sanitizeJournal(value: unknown): Journal {
  if (!value || typeof value !== "object") return {};
  const next: Journal = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !item || typeof item !== "object") continue;
    const record = item as Partial<DayLog>;
    const hours = cleanHours(String(record.hours ?? ""));
    const note = String(record.note ?? "").slice(0, 2000);
    if (hours || note.trim()) next[key] = { hours, note };
  }
  return next;
}

export function loadJournal(): Journal {
  try {
    return sanitizeJournal(JSON.parse(localStorage.getItem(JOURNAL_KEY) || "{}"));
  } catch {
    return {};
  }
}
