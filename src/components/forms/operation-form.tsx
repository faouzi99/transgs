"use client";

import { useMemo, useState } from "react";
import { operationSchema } from "@/lib/validation";
import { recordOperationAction } from "@/app/actions/operations";
import { FieldError, useZodForm } from "./use-zod-form";

export interface OperationFormProps {
  agentNom: string;
  sites: { id: string; nom: string }[];
  products: { id: string; nom: string; unite: "L" | "KG" }[];
  equipments: { codeParking: string; siteId: string; famille: "D" | "E"; uniteCompteur: "KM" | "H"; compteurActuel: number; label: string }[];
  periodicite: { D: number; E: number };
  defaultSiteId?: string;
  nowLocal: string; // yyyy-MM-ddTHH:mm in server local time
  initial?: Partial<Record<string, string>>;
  correctionOf?: { id: string; label: string };
}

const TYPES = [
  { v: "VIDANGE", l: "Vidange" },
  { v: "REPARATION", l: "Réparation" },
  { v: "SOUFFLAGE", l: "Soufflage" },
  { v: "GRAISSAGE", l: "Graissage" },
  { v: "LAVAGE", l: "Lavage" },
];

export function OperationForm(props: OperationFormProps) {
  const { onSubmit, errors, message, pending } = useZodForm(operationSchema, recordOperationAction);
  const init = props.initial ?? {};
  const [type, setType] = useState(init.type ?? "VIDANGE");
  const [code, setCode] = useState(init.codeParking ?? "");
  const [siteId, setSiteId] = useState(init.siteId ?? props.defaultSiteId ?? "");
  const [compteur, setCompteur] = useState(init.compteur ?? "");
  const [showLub, setShowLub] = useState(Boolean(init.produitId) || type === "VIDANGE" || type === "GRAISSAGE");

  const equipment = useMemo(
    () => props.equipments.find((e) => e.codeParking === code.trim().toUpperCase()),
    [code, props.equipments],
  );
  const unit = equipment ? (equipment.uniteCompteur === "KM" ? "km" : "h") : "";
  const p15 = props.products.find((p) => p.nom.includes("15W40"));
  const pGraisse = props.products.find((p) => p.unite === "KG");
  const defaultProduct = init.produitId ?? (type === "GRAISSAGE" ? pGraisse?.id : type === "VIDANGE" ? p15?.id : "");
  const prochaine = equipment && compteur ? Number(compteur) + props.periodicite[equipment.famille] : null;
  const lubVisible = type === "VIDANGE" || showLub;

  const onCodeChange = (v: string) => {
    setCode(v);
    const eq = props.equipments.find((e) => e.codeParking === v.trim().toUpperCase());
    if (eq && props.sites.some((s) => s.id === eq.siteId)) setSiteId(eq.siteId);
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {props.correctionOf && (
        <>
          <input type="hidden" name="correctionOfId" value={props.correctionOf.id} />
          <div className="rounded border border-accent/50 bg-accent-light/50 p-3 text-sm">
            Correction de : <strong>{props.correctionOf.label}</strong>. L&apos;écriture d&apos;origine reste visible dans
            l&apos;historique.
            <div className="mt-2">
              <label className="label" htmlFor="motifCorrection">Motif de la correction *</label>
              <input id="motifCorrection" name="motifCorrection" className="input" defaultValue={init.motifCorrection} />
              <FieldError errors={errors} name="motifCorrection" />
            </div>
          </div>
        </>
      )}

      <div>
        <span className="label">Type d&apos;opération *</span>
        <div className="flex flex-wrap gap-2">
          {TYPES.map((t) => (
            <label
              key={t.v}
              className={`cursor-pointer rounded border px-3 py-2 text-sm font-semibold ${
                type === t.v ? "border-accent bg-accent text-white" : "border-line bg-white hover:border-accent"
              }`}
            >
              <input
                type="radio"
                name="type"
                value={t.v}
                checked={type === t.v}
                onChange={() => {
                  setType(t.v);
                  setShowLub(t.v === "VIDANGE" || t.v === "GRAISSAGE");
                }}
                className="sr-only"
              />
              {t.l}
            </label>
          ))}
        </div>
      </div>

      <fieldset className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="label" htmlFor="codeParking">Code parking *</label>
          <input
            id="codeParking"
            name="codeParking"
            list="equipments"
            className="input font-semibold uppercase"
            value={code}
            onChange={(e) => onCodeChange(e.target.value)}
            autoComplete="off"
          />
          <datalist id="equipments">
            {props.equipments.map((e) => (
              <option key={e.codeParking} value={e.codeParking}>{e.label}</option>
            ))}
          </datalist>
          {equipment && <p className="mt-1 text-xs text-muted">{equipment.label}</p>}
          <FieldError errors={errors} name="codeParking" />
        </div>
        <div>
          <label className="label" htmlFor="siteId">Site *</label>
          <select id="siteId" name="siteId" className="input" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            {props.sites.length > 1 && <option value="">— Choisir —</option>}
            {props.sites.map((s) => (
              <option key={s.id} value={s.id}>{s.nom}</option>
            ))}
          </select>
          <FieldError errors={errors} name="siteId" />
        </div>
        <div>
          <label className="label" htmlFor="date">Date et heure *</label>
          <input id="date" name="date" type="datetime-local" className="input" defaultValue={init.date ?? props.nowLocal} />
          <FieldError errors={errors} name="date" />
        </div>
        <div>
          <label className="label">Agent</label>
          <input className="input bg-slate-50" value={props.agentNom} readOnly tabIndex={-1} />
        </div>
        <div>
          <label className="label" htmlFor="compteur">Compteur {unit && `(${unit})`} *</label>
          <input
            id="compteur"
            name="compteur"
            type="number"
            inputMode="numeric"
            min={0}
            className="input"
            value={compteur}
            onChange={(e) => setCompteur(e.target.value)}
          />
          {equipment && (
            <p className="mt-1 text-xs text-muted">
              Dernier relevé : {equipment.compteurActuel.toLocaleString("fr-FR")} {unit}
              {compteur && Number(compteur) < equipment.compteurActuel && (
                <span className="font-semibold text-accent-dark"> · inférieur au dernier relevé</span>
              )}
            </p>
          )}
          <FieldError errors={errors} name="compteur" />
        </div>
        {type !== "REPARATION" && (
          <div>
            <label className="label" htmlFor="cout">Coût (MAD)</label>
            <input id="cout" name="cout" type="number" step="0.01" min={0} className="input" defaultValue={init.cout} />
            <FieldError errors={errors} name="cout" />
          </div>
        )}
      </fieldset>

      {type === "REPARATION" && (
        <fieldset className="grid gap-3 rounded border border-line p-3 sm:grid-cols-2 lg:grid-cols-3">
          <legend className="px-1 text-xs font-bold uppercase text-muted">Réparation</legend>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="label" htmlFor="panne">Panne *</label>
            <input id="panne" name="panne" className="input" defaultValue={init.panne} />
            <FieldError errors={errors} name="panne" />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="pieces">Pièces remplacées</label>
            <input id="pieces" name="pieces" className="input" defaultValue={init.pieces} />
          </div>
          <div>
            <label className="label" htmlFor="fournisseur">Fournisseur</label>
            <input id="fournisseur" name="fournisseur" className="input" defaultValue={init.fournisseur} />
          </div>
          <div>
            <label className="label" htmlFor="dureeImmobilisationJours">Immobilisation (jours)</label>
            <input id="dureeImmobilisationJours" name="dureeImmobilisationJours" type="number" min={0} className="input" defaultValue={init.dureeImmobilisationJours} />
          </div>
          <div>
            <label className="label" htmlFor="coutPieces">Coût pièces (MAD)</label>
            <input id="coutPieces" name="coutPieces" type="number" step="0.01" min={0} className="input" defaultValue={init.coutPieces} />
          </div>
          <div>
            <label className="label" htmlFor="coutMainOeuvre">Main-d&apos;œuvre (MAD)</label>
            <input id="coutMainOeuvre" name="coutMainOeuvre" type="number" step="0.01" min={0} className="input" defaultValue={init.coutMainOeuvre} />
          </div>
        </fieldset>
      )}

      {type !== "VIDANGE" && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showLub} onChange={(e) => setShowLub(e.target.checked)} />
          Lubrifiant consommé pendant l&apos;opération
        </label>
      )}

      {lubVisible && (
        <fieldset key={type} className="grid gap-3 rounded border border-line p-3 sm:grid-cols-2 lg:grid-cols-3">
          <legend className="px-1 text-xs font-bold uppercase text-muted">
            {type === "VIDANGE" ? "Vidange" : "Lubrifiant"} — sortie de stock liée à cette opération
          </legend>
          <div>
            <label className="label" htmlFor="produitId">Produit {type === "VIDANGE" && "*"}</label>
            <select id="produitId" name="produitId" className="input" defaultValue={defaultProduct}>
              <option value="">— Choisir —</option>
              {props.products.map((p) => (
                <option key={p.id} value={p.id}>{p.nom} ({p.unite === "KG" ? "kg" : "L"})</option>
              ))}
            </select>
            <FieldError errors={errors} name="produitId" />
          </div>
          <div>
            <label className="label" htmlFor="quantite">Quantité {type === "VIDANGE" && "*"}</label>
            <input id="quantite" name="quantite" type="number" step="0.1" min={0} className="input" defaultValue={init.quantite} />
            <FieldError errors={errors} name="quantite" />
          </div>
          {type === "VIDANGE" && (
            <>
              <label className="flex items-center gap-2 self-end pb-2 text-sm">
                <input type="checkbox" name="filtreChange" defaultChecked={init.filtreChange !== "false"} /> Filtre changé
              </label>
              <div className="sm:col-span-2 lg:col-span-3 text-sm text-muted">
                Prochaine échéance calculée :{" "}
                <strong className="text-ink">{prochaine ? `${prochaine.toLocaleString("fr-FR")} ${unit}` : "—"}</strong>
                {equipment && ` (périodicité ${props.periodicite[equipment.famille].toLocaleString("fr-FR")} ${unit})`}
              </div>
            </>
          )}
        </fieldset>
      )}

      <div>
        <label className="label" htmlFor="observation">Observation</label>
        <textarea id="observation" name="observation" rows={2} className="input" defaultValue={init.observation} />
      </div>

      {message && (
        <p role="alert" className="rounded border border-bad/30 bg-bad/5 px-3 py-2 text-sm text-bad">{message}</p>
      )}
      <div className="flex gap-2">
        <button className="btn-primary px-6 py-2 text-base" disabled={pending}>
          {pending ? "Enregistrement…" : props.correctionOf ? "Enregistrer la correction" : "Enregistrer l'opération"}
        </button>
      </div>
    </form>
  );
}
