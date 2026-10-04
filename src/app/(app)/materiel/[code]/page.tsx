import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canWrite, isSiteBound } from "@/lib/permissions";
import { fmtDate, fmtDateTime, fmtInt, fmtMoney, fmtQty, toNum } from "@/lib/format";
import { OPERATION_LABEL } from "@/lib/labels";
import { startOfMonth } from "@/lib/dates";
import { PageHeader, Notice } from "@/components/ui";

export default async function MaterielPage({ params }: { params: Promise<{ code: string }> }) {
  const user = await requireUser();
  const { code } = await params;
  const equipment = await prisma.equipment.findUnique({
    where: { codeParking: decodeURIComponent(code).toUpperCase() },
    include: { site: true },
  });
  if (!equipment) notFound();
  if (isSiteBound(user.role) && equipment.siteId !== user.siteId) {
    return <Notice tone="bad">Ce matériel n&apos;appartient pas à votre site.</Notice>;
  }

  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const monthStart = startOfMonth(now);

  const [ops, products] = await Promise.all([
    prisma.operation.findMany({
      where: { codeParking: equipment.codeParking },
      include: {
        agent: { select: { nom: true } },
        valideePar: { select: { nom: true } },
        produit: true,
        correctedBy: { select: { id: true } },
        stockMovements: { include: { produit: true } },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
    prisma.lubricant.findMany({ orderBy: { ordre: "asc" } }),
  ]);
  const current = ops.filter((o) => !o.correctedBy);

  const conso = products.map((p) => {
    const sum = (from: Date) =>
      current
        .filter((o) => o.date >= from)
        .flatMap((o) => o.stockMovements)
        .filter((m) => m.produitId === p.id && m.sens === "SORTIE")
        .reduce((a, m) => a + toNum(m.quantite), 0);
    return { p, mois: sum(monthStart), annee: sum(yearStart) };
  });

  const yearOps = current.filter((o) => o.date >= yearStart);
  const costs = {
    pieces: yearOps.reduce((a, o) => a + toNum(o.coutPieces), 0),
    mainOeuvre: yearOps.reduce((a, o) => a + toNum(o.coutMainOeuvre), 0),
    autres: yearOps.filter((o) => o.type !== "REPARATION").reduce((a, o) => a + toNum(o.cout), 0),
    lubrifiant: yearOps
      .flatMap((o) => o.stockMovements)
      .reduce((a, m) => a + toNum(m.quantite) * toNum(m.produit.prixUnitaire), 0),
  };
  const coutTotal = costs.pieces + costs.mainOeuvre + costs.autres + costs.lubrifiant;
  const u = equipment.uniteCompteur === "KM" ? "km" : "h";
  const reste = equipment.prochaineEcheance !== null ? equipment.prochaineEcheance - equipment.compteurActuel : null;

  return (
    <div>
      <PageHeader
        title={`${equipment.codeParking} — ${equipment.marque} ${equipment.type}`}
        subtitle={`${equipment.famille === "D" ? "Camion" : "Engin"} · ${equipment.site.nom}${equipment.actif ? "" : " · INACTIF"}`}
        actions={
          <>
            {canWrite(user) && (
              <Link href={`/operations/nouvelle?code=${equipment.codeParking}`} className="btn-primary">
                Nouvelle opération
              </Link>
            )}
            <Link href="/materiel" className="btn">Autre recherche</Link>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card">
          <h2 className="card-title">Identité</h2>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
            <dt className="text-muted">Code parking</dt><dd className="font-semibold">{equipment.codeParking}</dd>
            <dt className="text-muted">Famille</dt><dd>{equipment.famille === "D" ? "D — camion" : "E — engin"}</dd>
            <dt className="text-muted">Marque</dt><dd>{equipment.marque}</dd>
            <dt className="text-muted">Type</dt><dd>{equipment.type}</dd>
            <dt className="text-muted">Immatriculation</dt><dd>{equipment.immatriculation ?? "—"}</dd>
            <dt className="text-muted">Année</dt><dd>{equipment.annee ?? "—"}</dd>
            <dt className="text-muted">Site</dt><dd>{equipment.site.nom}</dd>
          </dl>
        </div>
        <div className="card">
          <h2 className="card-title">Compteur et vidange</h2>
          <div className="text-3xl font-bold tabular-nums">{fmtInt(equipment.compteurActuel)} <span className="text-base text-muted">{u}</span></div>
          <div className="mt-3 text-sm">
            Prochaine vidange à{" "}
            <span className="font-semibold">{equipment.prochaineEcheance !== null ? `${fmtInt(equipment.prochaineEcheance)} ${u}` : "—"}</span>
          </div>
          {reste !== null && (
            <div className={`mt-1 text-sm font-semibold ${reste <= 0 ? "text-bad" : reste < (u === "km" ? 1000 : 25) ? "text-accent-dark" : "text-ok"}`}>
              {reste <= 0 ? `Échue depuis ${fmtInt(-reste)} ${u}` : `Dans ${fmtInt(reste)} ${u}`}
            </div>
          )}
        </div>
        <div className="card">
          <h2 className="card-title">Coûts {now.getFullYear()}</h2>
          <table className="w-full text-sm">
            <tbody>
              <tr><td className="text-muted">Pièces</td><td className="num">{fmtMoney(costs.pieces)}</td></tr>
              <tr><td className="text-muted">Main-d&apos;œuvre</td><td className="num">{fmtMoney(costs.mainOeuvre)}</td></tr>
              <tr><td className="text-muted">Lubrifiant</td><td className="num">{fmtMoney(costs.lubrifiant)}</td></tr>
              <tr><td className="text-muted">Autres opérations</td><td className="num">{fmtMoney(costs.autres)}</td></tr>
              <tr className="border-t border-ink font-bold"><td>Total</td><td className="num">{fmtMoney(coutTotal)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="card mt-4 overflow-x-auto">
        <h2 className="card-title">Lubrifiants consommés</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Produit</th>
              <th className="num">Mois en cours</th>
              <th className="num">Cumul {now.getFullYear()}</th>
            </tr>
          </thead>
          <tbody>
            {conso.map(({ p, mois, annee }) => (
              <tr key={p.id}>
                <td>{p.nom}</td>
                <td className="num">{fmtQty(mois)} {p.unite === "KG" ? "kg" : "L"}</td>
                <td className="num">{fmtQty(annee)} {p.unite === "KG" ? "kg" : "L"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card mt-4 overflow-x-auto p-0">
        <h2 className="card-title px-4 pt-4">Historique des opérations</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Opération</th>
              <th className="num">Compteur</th>
              <th>Détail</th>
              <th className="num">Coût</th>
              <th>Agent</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {ops.map((o) => (
              <tr key={o.id} className={o.correctedBy ? "text-muted line-through decoration-muted/60" : ""}>
                <td className="whitespace-nowrap">
                  <Link href={`/operations/${o.id}`} className="hover:underline">{fmtDateTime(o.date)}</Link>
                </td>
                <td className="font-medium">{OPERATION_LABEL[o.type]}</td>
                <td className="num">{fmtInt(o.compteur)} {u}</td>
                <td className="max-w-xs">
                  {o.stockMovements.map((m) => `${m.produit.nom} ${fmtQty(m.quantite)} ${m.produit.unite === "KG" ? "kg" : "L"}`).join(", ")}
                  {o.panne && <div>{o.panne}</div>}
                  {o.observation && <div className="text-xs text-muted">{o.observation}</div>}
                </td>
                <td className="num">{o.cout ? fmtMoney(o.cout) : "—"}</td>
                <td>{o.agent.nom}</td>
                <td className="whitespace-nowrap text-xs">
                  {o.correctedBy ? (
                    <span className="badge bg-slate-100 text-muted no-underline">Corrigée</span>
                  ) : o.valideeLe ? (
                    <span className="badge bg-ok/10 text-ok">Validée {fmtDate(o.valideeLe)}</span>
                  ) : (
                    <span className="badge bg-accent-light text-accent-dark">À valider</span>
                  )}
                  {o.correctionOfId && <span className="badge ml-1 bg-slate-100 text-ink">Correction</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
