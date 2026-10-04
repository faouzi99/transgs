"use client";

import { useState } from "react";
import { inventaireSchema } from "@/lib/validation";
import { inventaireAction } from "@/app/actions/stock";
import { FieldError, useZodForm } from "./use-zod-form";

export function InventaireRow({
  siteId,
  mois,
  produit,
  theorique,
  last,
  readOnly,
}: {
  siteId: string;
  mois: string;
  produit: { id: string; nom: string; unite: string };
  theorique: number;
  last?: { physique: number; ecart: number; justification: string | null; par: string; le: string };
  readOnly: boolean;
}) {
  const { onSubmit, errors, message, pending, ok } = useZodForm(inventaireSchema, inventaireAction);
  const [physique, setPhysique] = useState("");
  const u = produit.unite === "KG" ? "kg" : "L";
  const ecart = physique === "" ? null : Math.round((Number(physique) - theorique) * 100) / 100;
  const fmt = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });

  return (
    <tr>
      <td className="font-medium">{produit.nom}</td>
      <td className="num">{fmt(theorique)} {u}</td>
      <td>
        {last ? (
          <div className="text-xs">
            <div>
              Physique {fmt(last.physique)} {u} · écart{" "}
              <strong className={last.ecart === 0 ? "text-ok" : "text-bad"}>{fmt(last.ecart)}</strong>
            </div>
            {last.justification && <div className="text-muted">« {last.justification} »</div>}
            <div className="text-muted">{last.par} · {last.le}</div>
          </div>
        ) : (
          <span className="text-xs text-muted">Non saisi</span>
        )}
      </td>
      <td className="min-w-72">
        {!readOnly && (
          <form onSubmit={onSubmit} className="flex flex-wrap items-start gap-2" noValidate>
            <input type="hidden" name="siteId" value={siteId} />
            <input type="hidden" name="produitId" value={produit.id} />
            <input type="hidden" name="mois" value={mois} />
            <input type="hidden" name="quantiteTheorique" value={theorique} />
            <div className="w-28">
              <input
                name="quantitePhysique"
                type="number"
                step="0.1"
                min={0}
                placeholder={`Réel (${u})`}
                className="input"
                value={physique}
                onChange={(e) => setPhysique(e.target.value)}
                aria-label={`Quantité physique ${produit.nom}`}
              />
              <FieldError errors={errors} name="quantitePhysique" />
            </div>
            <div className={`w-20 pt-1.5 text-sm font-semibold tabular-nums ${ecart === null ? "text-muted" : ecart === 0 ? "text-ok" : "text-bad"}`}>
              {ecart === null ? "—" : `${ecart > 0 ? "+" : ""}${fmt(ecart)}`}
            </div>
            <div className="min-w-40 flex-1">
              <input
                name="justification"
                placeholder={ecart ? "Justification obligatoire" : "Justification"}
                className={`input ${ecart ? "border-accent" : ""}`}
              />
              <FieldError errors={errors} name="justification" />
            </div>
            <button className="btn-primary btn-sm mt-1" disabled={pending}>OK</button>
            {message && <div className={`w-full text-xs ${ok ? "text-ok" : "text-bad"}`}>{message}</div>}
          </form>
        )}
      </td>
    </tr>
  );
}
