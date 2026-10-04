import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canValidate, isSiteBound } from "@/lib/permissions";
import { OPERATION_LABEL } from "@/lib/labels";
import { fmtDateTime, fmtInt, fmtMoney, fmtQty } from "@/lib/format";
import { validateOperationAction } from "@/app/actions/operations";
import { Notice, PageHeader } from "@/components/ui";

const include = {
  agent: { select: { nom: true } },
  valideePar: { select: { nom: true } },
  site: true,
  equipment: true,
  correctedBy: { select: { id: true } },
  stockMovements: { include: { produit: true } },
} as const;

export default async function OperationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const op = await prisma.operation.findUnique({ where: { id }, include });
  if (!op) notFound();
  if (isSiteBound(user.role) && op.siteId !== user.siteId) return <Notice tone="bad">Opération d&apos;un autre site.</Notice>;

  // Full correction chain, oldest first.
  const chain = [op];
  let prevId = op.correctionOfId;
  while (prevId) {
    const prev = await prisma.operation.findUnique({ where: { id: prevId }, include });
    if (!prev) break;
    chain.unshift(prev);
    prevId = prev.correctionOfId;
  }
  let next = op.correctedBy ? await prisma.operation.findUnique({ where: { id: op.correctedBy.id }, include }) : null;
  while (next) {
    chain.push(next);
    next = next.correctedBy ? await prisma.operation.findUnique({ where: { id: next.correctedBy.id }, include }) : null;
  }
  const latest = chain[chain.length - 1];

  const canCorrect =
    !op.correctedBy &&
    (user.role === "ADMIN" ||
      (user.role === "CHEF_SITE" && op.siteId === user.siteId) ||
      (user.role === "AGENT" && op.siteId === user.siteId && !op.valideeLe));
  const u = op.equipment.uniteCompteur === "KM" ? "km" : "h";

  return (
    <div className="max-w-5xl">
      <PageHeader
        title={`${OPERATION_LABEL[op.type]} — ${op.codeParking}`}
        subtitle={`${op.site.nom} · ${fmtDateTime(op.date)}`}
        actions={
          <>
            {canCorrect && <Link className="btn" href={`/operations/nouvelle?corriger=${op.id}`}>Corriger</Link>}
            {canValidate(user) && !op.correctedBy && !op.valideeLe && (
              <form action={validateOperationAction}>
                <input type="hidden" name="id" value={op.id} />
                <button className="btn-primary">Valider</button>
              </form>
            )}
            <Link className="btn" href={`/materiel/${op.codeParking}`}>Fiche matériel</Link>
          </>
        }
      />
      {sp.ok && <Notice tone="ok">Opération enregistrée.</Notice>}
      {op.correctedBy && (
        <Notice>
          Cette écriture a été corrigée. <Link className="font-semibold underline" href={`/operations/${latest.id}`}>Voir la version en vigueur</Link>.
        </Notice>
      )}

      <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">Historique des écritures</h2>
      <div className="space-y-3">
        {chain.map((o, i) => (
          <div key={o.id} className={`card ${o.id === op.id ? "border-accent" : ""} ${o.correctedBy ? "bg-slate-50" : ""}`}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
              <div className="font-semibold">
                {i === 0 ? "Saisie d'origine" : `Correction n°${i}`}
                {o.correctedBy ? <span className="badge ml-2 bg-slate-200 text-muted">Remplacée</span> : <span className="badge ml-2 bg-ok/10 text-ok">En vigueur</span>}
              </div>
              <div className="text-xs text-muted">
                Écrit par <strong>{o.agent.nom}</strong> le {fmtDateTime(o.createdAt)}
                {o.valideeLe && <> · Validé par <strong>{o.valideePar?.nom}</strong> le {fmtDateTime(o.valideeLe)}</>}
              </div>
            </div>
            {o.motifCorrection && <p className="mb-2 text-sm">Motif : <em>{o.motifCorrection}</em></p>}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
              <dt className="text-muted">Date</dt><dd>{fmtDateTime(o.date)}</dd>
              <dt className="text-muted">Compteur</dt><dd>{fmtInt(o.compteur)} {u}</dd>
              <dt className="text-muted">Coût</dt><dd>{o.cout ? fmtMoney(o.cout) : "—"}</dd>
              <dt className="text-muted">Site</dt><dd>{o.site.nom}</dd>
              {o.stockMovements.map((m) => (
                <div key={m.id} className="contents">
                  <dt className="text-muted">Sortie stock</dt>
                  <dd>{m.produit.nom} — {fmtQty(m.quantite)} {m.produit.unite === "KG" ? "kg" : "L"}</dd>
                </div>
              ))}
              {o.type === "VIDANGE" && (
                <>
                  <dt className="text-muted">Filtre changé</dt><dd>{o.filtreChange ? "Oui" : "Non"}</dd>
                  <dt className="text-muted">Prochaine échéance</dt><dd>{o.prochaineEcheance ? `${fmtInt(o.prochaineEcheance)} ${u}` : "—"}</dd>
                </>
              )}
              {o.type === "REPARATION" && (
                <>
                  <dt className="text-muted">Panne</dt><dd>{o.panne}</dd>
                  <dt className="text-muted">Pièces</dt><dd>{o.pieces ?? "—"}</dd>
                  <dt className="text-muted">Fournisseur</dt><dd>{o.fournisseur ?? "—"}</dd>
                  <dt className="text-muted">Immobilisation</dt><dd>{o.dureeImmobilisationJours ?? 0} j</dd>
                  <dt className="text-muted">Coût pièces</dt><dd>{o.coutPieces ? fmtMoney(o.coutPieces) : "—"}</dd>
                  <dt className="text-muted">Main-d&apos;œuvre</dt><dd>{o.coutMainOeuvre ? fmtMoney(o.coutMainOeuvre) : "—"}</dd>
                </>
              )}
            </dl>
            {o.observation && <p className="mt-2 text-sm text-muted">{o.observation}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
