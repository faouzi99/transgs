"use client";

import { useActionState, useState } from "react";
import { generateOperationReportAction } from "@/app/actions/reports";

export function GenerateReportForm({ sites, defaults }: { sites?: { id: string; nom: string }[]; defaults: { jour: string; mois: string } }) {
  const [state, action, pending] = useActionState(generateOperationReportAction, {});
  const [vue, setVue] = useState<"jour" | "mois">("mois");
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div>
        <label className="label" htmlFor="r-type">Opération</label>
        <select id="r-type" name="type" className="input w-40" defaultValue="VIDANGE">
          <option value="VIDANGE">Vidange</option>
          <option value="REPARATION">Réparation</option>
          <option value="SOUFFLAGE">Soufflage</option>
          <option value="GRAISSAGE">Graissage</option>
          <option value="LAVAGE">Lavage</option>
        </select>
      </div>
      <div>
        <span className="label">Rapport</span>
        <div className="inline-flex overflow-hidden rounded border border-line bg-white">
          {(["jour", "mois"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVue(v)}
              className={`px-3 py-1.5 text-sm font-medium ${vue === v ? "bg-ink text-white" : "hover:bg-slate-100"}`}
            >
              {v === "jour" ? "Journalier" : "Mensuel"}
            </button>
          ))}
        </div>
        <input type="hidden" name="vue" value={vue} />
      </div>
      <div>
        <label className="label" htmlFor="r-ref">{vue === "jour" ? "Date" : "Mois"}</label>
        <input key={vue} id="r-ref" name="ref" type={vue === "jour" ? "date" : "month"} className="input w-44" defaultValue={defaults[vue]} required />
      </div>
      {sites && (
        <div>
          <label className="label" htmlFor="r-site">Site</label>
          <select id="r-site" name="site" className="input w-52">
            <option value="">Tous les sites</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>{s.nom}</option>
            ))}
          </select>
        </div>
      )}
      <button className="btn-primary" disabled={pending}>{pending ? "Génération…" : "Générer PDF + Excel"}</button>
      {state.message && <p className="w-full text-sm text-bad">{state.message}</p>}
    </form>
  );
}
