import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { str, type SearchParams } from "@/lib/params";
import { ROLE_LABEL } from "@/lib/labels";
import { fmtDate, fmtDateTime, fmtInt, toNum } from "@/lib/format";
import {
  createUserAction,
  saveEquipmentAction,
  saveLubricantAction,
  saveSettingsAction,
  saveSiteAction,
  toggleUserAction,
  updateUserAction,
} from "@/app/actions/admin";
import { AdminForm } from "@/components/forms/admin-form";
import { PageHeader } from "@/components/ui";

const TABS = [
  { k: "comptes", l: "Comptes et rôles" },
  { k: "sites", l: "Sites" },
  { k: "materiel", l: "Référentiel matériel" },
  { k: "lubrifiants", l: "Lubrifiants et seuils" },
  { k: "parametres", l: "Périodicités et alertes" },
  { k: "journal", l: "Journal" },
] as const;

const ROLES = ["AGENT", "CHEF_SITE", "DIRECTION", "ADMIN"] as const;

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={wide ? "sm:col-span-2" : ""}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

function SiteSelect({ sites, name = "siteId", defaultValue, optional }: { sites: { id: string; nom: string }[]; name?: string; defaultValue?: string | null; optional?: boolean }) {
  return (
    <select name={name} className="input" defaultValue={defaultValue ?? ""}>
      <option value="">{optional ? "Aucun (tous les sites)" : "— Choisir —"}</option>
      {sites.map((s) => (
        <option key={s.id} value={s.id}>{s.nom}</option>
      ))}
    </select>
  );
}

export default async function AdminPage({ searchParams }: { searchParams: SearchParams }) {
  const me = await requireUser(["ADMIN"]);
  const sp = await searchParams;
  const tab = TABS.find((t) => t.k === str(sp.onglet))?.k ?? "comptes";
  const sites = await prisma.site.findMany({ orderBy: { nom: "asc" } });
  let body: React.ReactNode = null;

  if (tab === "comptes") {
    const users = await prisma.user.findMany({
      include: { site: true, createdBy: { select: { nom: true } } },
      orderBy: [{ actif: "desc" }, { role: "asc" }, { nom: "asc" }],
    });
    body = (
      <>
        <div className="card mb-4">
          <h2 className="card-title">Créer un compte</h2>
          <AdminForm action={createUserAction} schema="userCreate" submitLabel="Créer le compte" resetOnSuccess>
            <Field label="Nom complet *"><input name="nom" className="input" /></Field>
            <Field label="Email *"><input name="email" type="email" className="input" /></Field>
            <Field label="Mot de passe initial *"><input name="password" type="password" className="input" autoComplete="new-password" /></Field>
            <Field label="Rôle *">
              <select name="role" className="input" defaultValue="AGENT">
                {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
            </Field>
            <Field label="Site (obligatoire pour agent et chef de site)"><SiteSelect sites={sites} optional /></Field>
          </AdminForm>
        </div>
        <div className="card overflow-x-auto p-0">
          <table className="table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Email</th>
                <th>Rôle</th>
                <th>Site</th>
                <th>Créé</th>
                <th>Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className={u.actif ? "" : "text-muted"}>
                  <td className="font-medium">{u.nom}</td>
                  <td>{u.email}</td>
                  <td>{ROLE_LABEL[u.role]}</td>
                  <td>{u.site?.nom ?? "Tous"}</td>
                  <td className="text-xs">{fmtDate(u.createdAt)}{u.createdBy && <> par {u.createdBy.nom}</>}</td>
                  <td>
                    {u.actif ? <span className="badge bg-ok/10 text-ok">Actif</span> : <span className="badge bg-bad/10 text-bad">Désactivé</span>}
                  </td>
                  <td className="min-w-64">
                    <details>
                      <summary className="cursor-pointer text-sm font-semibold text-accent-dark">Modifier</summary>
                      <div className="mt-2 space-y-2">
                        <AdminForm action={updateUserAction} schema="userUpdate" className="grid gap-2">
                          <input type="hidden" name="id" value={u.id} />
                          <select name="role" className="input" defaultValue={u.role}>
                            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                          </select>
                          <SiteSelect sites={sites} defaultValue={u.siteId} optional />
                          <input name="password" type="password" placeholder="Nouveau mot de passe (facultatif)" className="input" autoComplete="new-password" />
                        </AdminForm>
                        {u.id !== me.id && (
                          <form action={toggleUserAction}>
                            <input type="hidden" name="id" value={u.id} />
                            <button className={`btn btn-sm ${u.actif ? "text-bad" : "text-ok"}`}>
                              {u.actif ? "Désactiver (départ du poste)" : "Réactiver"}
                            </button>
                          </form>
                        )}
                      </div>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  if (tab === "sites") {
    body = (
      <div className="card space-y-3">
        {sites.map((s) => (
          <AdminForm key={s.id} action={saveSiteAction} schema="site" className="grid gap-3 border-b border-line pb-3 sm:grid-cols-3">
            <input type="hidden" name="id" value={s.id} />
            <Field label="Nom"><input name="nom" defaultValue={s.nom} className="input" /></Field>
            <Field label="Responsable"><input name="responsable" defaultValue={s.responsable ?? ""} className="input" /></Field>
          </AdminForm>
        ))}
        <h2 className="card-title pt-2">Nouveau site</h2>
        <AdminForm action={saveSiteAction} schema="site" className="grid gap-3 sm:grid-cols-3" resetOnSuccess submitLabel="Ajouter">
          <Field label="Nom *"><input name="nom" className="input" /></Field>
          <Field label="Responsable"><input name="responsable" className="input" /></Field>
        </AdminForm>
      </div>
    );
  }

  if (tab === "materiel") {
    const equipments = await prisma.equipment.findMany({ include: { site: true }, orderBy: { codeParking: "asc" } });
    body = (
      <>
        <div className="card mb-4">
          <h2 className="card-title">Ajouter un matériel</h2>
          <p className="mb-3 text-xs text-muted">Préfixe D = camion (compteur en km), préfixe E = engin (compteur en heures).</p>
          <AdminForm action={saveEquipmentAction} schema="equipment" resetOnSuccess submitLabel="Ajouter">
            <Field label="Code parking *"><input name="codeParking" className="input uppercase" placeholder="D108 / E209" /></Field>
            <Field label="Marque *"><input name="marque" className="input" list="marques" /></Field>
            <Field label="Type *"><input name="type" className="input" list="types" /></Field>
            <Field label="Immatriculation"><input name="immatriculation" className="input" /></Field>
            <Field label="Année"><input name="annee" type="number" className="input" /></Field>
            <Field label="Site *"><SiteSelect sites={sites} /></Field>
            <Field label="Compteur actuel *"><input name="compteurActuel" type="number" min={0} defaultValue={0} className="input" /></Field>
            <input type="hidden" name="actif" value="true" />
          </AdminForm>
          <datalist id="marques">
            {["MAN", "RENAULT", "CATERPILLAR", "SEM", "HYUNDAI"].map((m) => <option key={m} value={m} />)}
          </datalist>
          <datalist id="types">
            {[...new Set(equipments.map((e) => e.type))].map((t) => <option key={t} value={t} />)}
          </datalist>
        </div>
        <div className="card overflow-x-auto p-0">
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Marque / type</th>
                <th>Site</th>
                <th className="num">Compteur</th>
                <th>Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {equipments.map((e) => (
                <tr key={e.codeParking} className={e.actif ? "" : "text-muted"}>
                  <td className="font-bold">{e.codeParking}</td>
                  <td>{e.marque} {e.type}{e.immatriculation && <span className="text-xs text-muted"> · {e.immatriculation}</span>}</td>
                  <td>{e.site.nom}</td>
                  <td className="num">{fmtInt(e.compteurActuel)} {e.uniteCompteur === "KM" ? "km" : "h"}</td>
                  <td>{e.actif ? "Actif" : "Inactif"}</td>
                  <td className="min-w-72">
                    <details>
                      <summary className="cursor-pointer text-sm font-semibold text-accent-dark">Modifier</summary>
                      <AdminForm action={saveEquipmentAction} schema="equipment" className="mt-2 grid gap-2 sm:grid-cols-2">
                        <input type="hidden" name="original" value={e.codeParking} />
                        <input type="hidden" name="codeParking" value={e.codeParking} />
                        <Field label="Marque"><input name="marque" defaultValue={e.marque} className="input" /></Field>
                        <Field label="Type"><input name="type" defaultValue={e.type} className="input" list="types" /></Field>
                        <Field label="Immatriculation"><input name="immatriculation" defaultValue={e.immatriculation ?? ""} className="input" /></Field>
                        <Field label="Année"><input name="annee" type="number" defaultValue={e.annee ?? ""} className="input" /></Field>
                        <Field label="Site"><SiteSelect sites={sites} defaultValue={e.siteId} /></Field>
                        <Field label="Compteur"><input name="compteurActuel" type="number" defaultValue={e.compteurActuel} className="input" /></Field>
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" name="actif" defaultChecked={e.actif} /> Actif
                        </label>
                      </AdminForm>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  if (tab === "lubrifiants") {
    const products = await prisma.lubricant.findMany({ orderBy: { ordre: "asc" } });
    const form = (p?: (typeof products)[number]) => (
      <AdminForm
        key={p?.id ?? "new"}
        action={saveLubricantAction}
        schema="lubricant"
        className="grid gap-3 border-b border-line pb-3 sm:grid-cols-5"
        resetOnSuccess={!p}
        submitLabel={p ? "Enregistrer" : "Ajouter"}
      >
        {p && <input type="hidden" name="id" value={p.id} />}
        <Field label="Produit"><input name="nom" defaultValue={p?.nom} className="input" /></Field>
        <Field label="Unité">
          <select name="unite" defaultValue={p?.unite ?? "L"} className="input">
            <option value="L">Litre (L)</option>
            <option value="KG">Kilogramme (kg)</option>
          </select>
        </Field>
        <Field label="Seuil d'alerte (par site)"><input name="seuilAlerte" type="number" step="0.1" defaultValue={p ? toNum(p.seuilAlerte) : ""} className="input" /></Field>
        <Field label="Prix unitaire (MAD)"><input name="prixUnitaire" type="number" step="0.01" defaultValue={p ? toNum(p.prixUnitaire) : ""} className="input" /></Field>
      </AdminForm>
    );
    body = (
      <div className="card space-y-3">
        {products.map((p) => form(p))}
        <h2 className="card-title pt-2">Nouveau lubrifiant</h2>
        {form()}
      </div>
    );
  }

  if (tab === "parametres") {
    const s = await getSettings();
    body = (
      <div className="card max-w-3xl">
        <AdminForm action={saveSettingsAction} schema="settings" className="grid gap-3 sm:grid-cols-3">
          <Field label="Périodicité vidange camions D (km)"><input name="periodicite_D" type="number" defaultValue={s.periodicite_D} className="input" /></Field>
          <Field label="Périodicité vidange engins E (heures)"><input name="periodicite_E" type="number" defaultValue={s.periodicite_E} className="input" /></Field>
          <Field label="Seuil « hors norme » (% au-dessus de la moyenne du type)"><input name="hors_norme_pct" type="number" defaultValue={s.hors_norme_pct} className="input" /></Field>
        </AdminForm>
      </div>
    );
  }

  if (tab === "journal") {
    const logs = await prisma.auditLog.findMany({ include: { user: { select: { nom: true } } }, orderBy: { at: "desc" }, take: 200 });
    body = (
      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Auteur</th>
              <th>Action</th>
              <th>Objet</th>
              <th>Détail</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="whitespace-nowrap">{fmtDateTime(l.at)}</td>
                <td>{l.user.nom}</td>
                <td>{l.action}</td>
                <td>{l.entity} {l.entityId}</td>
                <td className="max-w-md truncate font-mono text-xs">{l.data ? JSON.stringify(l.data) : ""}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr><td colSpan={5} className="py-6 text-center text-muted">Aucune modification de référentiel pour l&apos;instant.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Administration" subtitle="Comptes, rôles, sites, référentiels et seuils" />
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <Link
            key={t.k}
            href={`/admin?onglet=${t.k}`}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold ${tab === t.k ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"}`}
          >
            {t.l}
          </Link>
        ))}
      </div>
      {body}
    </div>
  );
}
