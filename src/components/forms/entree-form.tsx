"use client";

import { useEffect, useRef } from "react";
import { entreeSchema } from "@/lib/validation";
import { entreeAction } from "@/app/actions/stock";
import { FieldError, useZodForm } from "./use-zod-form";

export function EntreeForm({
  sites,
  products,
  nowLocal,
  correction,
}: {
  sites: { id: string; nom: string }[];
  products: { id: string; nom: string; unite: string }[];
  nowLocal: string;
  correction?: { id: string; label: string; produitId: string; quantite: string; fournisseur: string; bonLivraison: string; siteId: string; date: string };
}) {
  const { onSubmit, errors, message, pending, ok } = useZodForm(entreeSchema, entreeAction);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (ok && !correction) ref.current?.reset();
  }, [ok, correction]);

  return (
    <form ref={ref} onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" noValidate>
      {correction && (
        <div className="rounded border border-accent/50 bg-accent-light/50 p-3 text-sm sm:col-span-2 lg:col-span-3">
          <input type="hidden" name="correctionOfId" value={correction.id} />
          Correction de l&apos;entrée <strong>{correction.label}</strong> (l&apos;originale reste dans l&apos;historique).
          <div className="mt-2">
            <label className="label" htmlFor="motifCorrection">Motif *</label>
            <input id="motifCorrection" name="motifCorrection" className="input" />
            <FieldError errors={errors} name="motifCorrection" />
          </div>
        </div>
      )}
      <div>
        <label className="label" htmlFor="e-produit">Produit *</label>
        <select id="e-produit" name="produitId" className="input" defaultValue={correction?.produitId ?? ""}>
          <option value="">— Choisir —</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.nom} ({p.unite === "KG" ? "kg" : "L"})</option>
          ))}
        </select>
        <FieldError errors={errors} name="produitId" />
      </div>
      <div>
        <label className="label" htmlFor="e-quantite">Quantité *</label>
        <input id="e-quantite" name="quantite" type="number" step="0.1" min={0} className="input" defaultValue={correction?.quantite} />
        <FieldError errors={errors} name="quantite" />
      </div>
      <div>
        <label className="label" htmlFor="e-site">Site *</label>
        <select id="e-site" name="siteId" className="input" defaultValue={correction?.siteId ?? (sites.length === 1 ? sites[0].id : "")}>
          {sites.length > 1 && <option value="">— Choisir —</option>}
          {sites.map((s) => (
            <option key={s.id} value={s.id}>{s.nom}</option>
          ))}
        </select>
        <FieldError errors={errors} name="siteId" />
      </div>
      <div>
        <label className="label" htmlFor="e-fournisseur">Fournisseur *</label>
        <input id="e-fournisseur" name="fournisseur" className="input" defaultValue={correction?.fournisseur} />
        <FieldError errors={errors} name="fournisseur" />
      </div>
      <div>
        <label className="label" htmlFor="e-bl">N° bon de livraison</label>
        <input id="e-bl" name="bonLivraison" className="input" defaultValue={correction?.bonLivraison} />
      </div>
      <div>
        <label className="label" htmlFor="e-date">Date *</label>
        <input id="e-date" name="date" type="datetime-local" className="input" defaultValue={correction?.date ?? nowLocal} />
        <FieldError errors={errors} name="date" />
      </div>
      <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-3">
        <button className="btn-primary" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer l'entrée"}</button>
        {message && <span className={`text-sm ${ok ? "text-ok" : "text-bad"}`}>{message}</span>}
      </div>
    </form>
  );
}
