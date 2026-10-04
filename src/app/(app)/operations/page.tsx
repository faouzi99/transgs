import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canValidate, canWrite, isSiteBound, siteScope } from "@/lib/permissions";
import { buildPeriod } from "@/lib/dates";
import { parseFamille, parseType, str, type SearchParams } from "@/lib/params";
import { OPERATION_LABEL } from "@/lib/labels";
import { fmtDateTime, fmtInt, fmtMoney, fmtQty } from "@/lib/format";
import { validateOperationAction } from "@/app/actions/operations";
import { FilterBar } from "@/components/filter-bar";
import { Empty, PageHeader } from "@/components/ui";
import { StatutFilter } from "./statut-filter";

export default async function OperationsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const sp = await searchParams;
  const period = buildPeriod(str(sp.vue), str(sp.ref));
  const siteId = siteScope(user, str(sp.site));
  const famille = parseFamille(str(sp.famille));
  const type = parseType(str(sp.type));
  const statut = str(sp.statut);

  const where: Prisma.OperationWhereInput = {
    correctedBy: { is: null },
    date: { gte: period.start, lt: period.end },
    ...(siteId ? { siteId } : {}),
    ...(famille ? { equipment: { famille } } : {}),
    ...(type ? { type } : {}),
    ...(statut === "a_valider" ? { valideeLe: null } : statut === "validees" ? { valideeLe: { not: null } } : {}),
  };
  const [sites, ops, pending] = await Promise.all([
    prisma.site.findMany({ orderBy: { nom: "asc" } }),
    prisma.operation.findMany({
      where,
      include: {
        agent: { select: { nom: true } },
        site: { select: { nom: true } },
        equipment: { select: { uniteCompteur: true } },
        stockMovements: { include: { produit: true } },
      },
      orderBy: { date: "desc" },
      take: 500,
    }),
    prisma.operation.count({ where: { correctedBy: { is: null }, valideeLe: null, ...(siteId ? { siteId } : {}) } }),
  ]);
  const validator = canValidate(user);

  return (
    <div>
      <PageHeader
        title="Opérations"
        subtitle={`${period.label} · ${ops.length} opération(s)${pending ? ` · ${pending} à valider au total` : ""}`}
        actions={canWrite(user) && <Link href="/operations/nouvelle" className="btn-primary">Nouvelle opération</Link>}
      />
      <FilterBar options={{ view: true, sites: isSiteBound(user.role) ? undefined : sites, famille: true, type: true }}>
        <StatutFilter />
      </FilterBar>

      <form action={validateOperationAction}>
        {validator && (
          <div className="mb-2 flex justify-end">
            <button className="btn-primary btn-sm">Valider la sélection</button>
          </div>
        )}
        <div className="card overflow-x-auto p-0">
          {ops.length === 0 ? (
            <Empty>Aucune opération sur la période.</Empty>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  {validator && <th className="w-8"></th>}
                  <th>Date</th>
                  <th>Code</th>
                  <th>Opération</th>
                  <th>Site</th>
                  <th className="num">Compteur</th>
                  <th>Lubrifiant</th>
                  <th className="num">Coût</th>
                  <th>Agent</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {ops.map((o) => (
                  <tr key={o.id}>
                    {validator && (
                      <td>
                        {!o.valideeLe && <input type="checkbox" name="id" value={o.id} aria-label={`Valider ${o.codeParking}`} />}
                      </td>
                    )}
                    <td className="whitespace-nowrap">
                      <Link href={`/operations/${o.id}`} className="hover:underline">{fmtDateTime(o.date)}</Link>
                    </td>
                    <td>
                      <Link href={`/materiel/${o.codeParking}`} className="font-bold text-accent-dark hover:underline">{o.codeParking}</Link>
                    </td>
                    <td>
                      {OPERATION_LABEL[o.type]}
                      {o.correctionOfId && <span className="badge ml-1 bg-slate-100 text-ink">Corrigée</span>}
                    </td>
                    <td>{o.site.nom}</td>
                    <td className="num">{fmtInt(o.compteur)} {o.equipment.uniteCompteur === "KM" ? "km" : "h"}</td>
                    <td className="text-xs">
                      {o.stockMovements.map((m) => `${m.produit.nom} ${fmtQty(m.quantite)} ${m.produit.unite === "KG" ? "kg" : "L"}`).join(", ") || "—"}
                    </td>
                    <td className="num">{o.cout ? fmtMoney(o.cout) : "—"}</td>
                    <td>{o.agent.nom}</td>
                    <td>
                      {o.valideeLe ? (
                        <span className="badge bg-ok/10 text-ok">Validée</span>
                      ) : (
                        <span className="badge bg-accent-light text-accent-dark">À valider</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </form>
    </div>
  );
}
