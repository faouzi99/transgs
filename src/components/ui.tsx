import clsx from "clsx";
import Link from "next/link";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-3">
      <div>
        <h1 className="text-xl font-bold text-ink">{title}</h1>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Kpi({ label, value, hint, tone, href }: { label: string; value: string; hint?: string; tone?: "alert"; href?: string }) {
  const body = (
    <div className={clsx("card h-full", tone === "alert" && "border-bad/40 bg-bad/5")}>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className={clsx("mt-1 text-2xl font-bold tabular-nums", tone === "alert" ? "text-bad" : "text-ink")}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
    </div>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}

export function YesNo({ value }: { value: boolean }) {
  return (
    <span className={clsx("badge", value ? "bg-ok/10 text-ok" : "bg-bad/10 text-bad")}>{value ? "Oui" : "Non"}</span>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted">{children}</p>;
}

export function Notice({ tone = "info", children }: { tone?: "info" | "ok" | "bad"; children: React.ReactNode }) {
  return (
    <div
      className={clsx(
        "mb-4 rounded border px-3 py-2 text-sm",
        tone === "ok" && "border-ok/30 bg-ok/5 text-ok",
        tone === "bad" && "border-bad/30 bg-bad/5 text-bad",
        tone === "info" && "border-accent/40 bg-accent-light/50 text-ink",
      )}
    >
      {children}
    </div>
  );
}
