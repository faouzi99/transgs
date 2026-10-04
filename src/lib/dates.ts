// Period helpers. All boundaries are computed in the server's local time zone (TZ env var).

export type PeriodView = "jour" | "mois" | "annee";

export interface Period {
  view: PeriodView;
  start: Date; // inclusive
  end: Date; // exclusive
  label: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

export const toDateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const toMonthInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
export const toDateTimeInput = (d: Date) => `${toDateInput(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

export function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
export function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
export function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

/** Parse "YYYY-MM-DD" as a local date (new Date("YYYY-MM-DD") would be UTC). */
export function parseDay(s: string | undefined): Date | null {
  const m = s?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}
export function parseMonth(s: string | undefined): Date | null {
  const m = s?.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, 1);
}
export function parseYear(s: string | undefined): number | null {
  const m = s?.match(/^(\d{4})$/);
  return m ? Number(m[1]) : null;
}

/** Build a period from a view and a reference value ("YYYY-MM-DD", "YYYY-MM" or "YYYY"). */
export function buildPeriod(view: string | undefined, ref: string | undefined, now = new Date()): Period {
  const v: PeriodView = view === "jour" || view === "annee" ? view : "mois";
  if (v === "jour") {
    const d = parseDay(ref) ?? startOfDay(now);
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    return { view: v, start: d, end, label: d.toLocaleDateString("fr-FR", { dateStyle: "full" }) };
  }
  if (v === "annee") {
    const y = parseYear(ref) ?? now.getFullYear();
    return { view: v, start: new Date(y, 0, 1), end: new Date(y + 1, 0, 1), label: `Année ${y}` };
  }
  const m = parseMonth(ref) ?? startOfMonth(now);
  return {
    view: v,
    start: m,
    end: addMonths(m, 1),
    label: m.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }),
  };
}

export function periodRefValue(p: Period): string {
  if (p.view === "jour") return toDateInput(p.start);
  if (p.view === "annee") return String(p.start.getFullYear());
  return toMonthInput(p.start);
}
