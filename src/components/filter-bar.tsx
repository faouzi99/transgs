"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export interface FilterOptions {
  sites?: { id: string; nom: string }[]; // omitted for site-bound users
  view?: boolean; // jour / mois / annee
  views?: ("jour" | "mois" | "annee")[];
  defaultView?: "jour" | "mois" | "annee";
  famille?: boolean;
  type?: boolean;
  year?: boolean; // year only
}

const VIEW_LABEL = { jour: "Jour", mois: "Mois", annee: "Année" } as const;

/** Shared filter bar. Values live in the URL so pages stay server-rendered and shareable. */
export function FilterBar({ options, children }: { options: FilterOptions; children?: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  const set = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    start(() => router.push(`${pathname}?${next.toString()}`));
  };

  const views = options.views ?? ["jour", "mois", "annee"];
  const vue = (params.get("vue") as "jour" | "mois" | "annee") ?? options.defaultView ?? (views.includes("mois") ? "mois" : views[0]);
  const ref = params.get("ref") ?? "";
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const defaults = {
    jour: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    mois: `${now.getFullYear()}-${pad(now.getMonth() + 1)}`,
    annee: String(now.getFullYear()),
  };

  return (
    <div className={`mb-4 flex flex-wrap items-end gap-3 rounded border border-line bg-slate-50 p-3 ${pending ? "opacity-60" : ""}`}>
      {options.view && (
        <div>
          <span className="label">Vue</span>
          <div className="inline-flex overflow-hidden rounded border border-line bg-white">
            {views.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => set({ vue: v, ref: undefined })}
                className={`px-3 py-1.5 text-sm font-medium ${vue === v ? "bg-ink text-white" : "text-ink hover:bg-slate-100"}`}
              >
                {VIEW_LABEL[v]}
              </button>
            ))}
          </div>
        </div>
      )}
      {options.view && (
        <div>
          <label className="label" htmlFor="f-ref">{vue === "jour" ? "Date" : vue === "mois" ? "Mois" : "Année"}</label>
          {vue === "annee" ? (
            <input
              id="f-ref"
              type="number"
              min={2000}
              max={2100}
              className="input w-28"
              value={ref || defaults.annee}
              onChange={(e) => set({ ref: e.target.value })}
            />
          ) : (
            <input
              id="f-ref"
              type={vue === "jour" ? "date" : "month"}
              className="input w-44"
              value={ref || defaults[vue]}
              onChange={(e) => set({ ref: e.target.value })}
            />
          )}
        </div>
      )}
      {options.year && (
        <div>
          <label className="label" htmlFor="f-annee">Année</label>
          <input
            id="f-annee"
            type="number"
            min={2000}
            max={2100}
            className="input w-28"
            value={params.get("annee") ?? defaults.annee}
            onChange={(e) => set({ annee: e.target.value })}
          />
        </div>
      )}
      {options.sites && (
        <div>
          <label className="label" htmlFor="f-site">Site</label>
          <select id="f-site" className="input w-52" value={params.get("site") ?? ""} onChange={(e) => set({ site: e.target.value })}>
            <option value="">Tous les sites</option>
            {options.sites.map((s) => (
              <option key={s.id} value={s.id}>{s.nom}</option>
            ))}
          </select>
        </div>
      )}
      {options.famille && (
        <div>
          <label className="label" htmlFor="f-famille">Famille</label>
          <select id="f-famille" className="input w-40" value={params.get("famille") ?? ""} onChange={(e) => set({ famille: e.target.value })}>
            <option value="">D et E</option>
            <option value="D">Camions (D)</option>
            <option value="E">Engins (E)</option>
          </select>
        </div>
      )}
      {options.type && (
        <div>
          <label className="label" htmlFor="f-type">Type d&apos;opération</label>
          <select id="f-type" className="input w-40" value={params.get("type") ?? ""} onChange={(e) => set({ type: e.target.value })}>
            <option value="">Toutes</option>
            <option value="VIDANGE">Vidange</option>
            <option value="REPARATION">Réparation</option>
            <option value="SOUFFLAGE">Soufflage</option>
            <option value="GRAISSAGE">Graissage</option>
            <option value="LAVAGE">Lavage</option>
          </select>
        </div>
      )}
      {children}
    </div>
  );
}
