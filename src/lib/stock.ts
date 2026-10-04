import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "./db";
import { toNum } from "./format";

type Db = PrismaClient | Prisma.TransactionClient;

/** Operations that have not been superseded by a correction. */
export const currentOperation: Prisma.OperationWhereInput = { correctedBy: { is: null } };

/** Stock movements that count: not corrected, and not tied to a corrected operation. */
export const currentMovement: Prisma.StockMovementWhereInput = {
  correctedBy: { is: null },
  OR: [{ operationId: null }, { operation: { correctedBy: { is: null } } }],
};

export interface Balance {
  siteId: string;
  produitId: string;
  entrees: number;
  sorties: number;
  solde: number;
}

/** Real-time balances per site and product, optionally up to a date (exclusive). */
export async function stockBalances(
  opts: { siteId?: string; produitId?: string; before?: Date; excludeOperationId?: string } = {},
  db: Db = prisma,
): Promise<Balance[]> {
  const where: Prisma.StockMovementWhereInput = {
    AND: [
      currentMovement,
      opts.siteId ? { siteId: opts.siteId } : {},
      opts.produitId ? { produitId: opts.produitId } : {},
      opts.before ? { date: { lt: opts.before } } : {},
      // Written as an OR: NOT (operationId = x) would also drop rows whose operationId is NULL.
      opts.excludeOperationId ? { OR: [{ operationId: null }, { operationId: { not: opts.excludeOperationId } }] } : {},
    ],
  };
  const rows = await db.stockMovement.groupBy({
    by: ["siteId", "produitId", "sens"],
    where,
    _sum: { quantite: true },
  });
  const map = new Map<string, Balance>();
  for (const r of rows) {
    const key = `${r.siteId}|${r.produitId}`;
    const b = map.get(key) ?? { siteId: r.siteId, produitId: r.produitId, entrees: 0, sorties: 0, solde: 0 };
    const q = toNum(r._sum.quantite);
    if (r.sens === "ENTREE") b.entrees += q;
    else b.sorties += q;
    b.solde = b.entrees - b.sorties;
    map.set(key, b);
  }
  return [...map.values()];
}

export async function balanceOf(siteId: string, produitId: string, db: Db = prisma, excludeOperationId?: string) {
  const [b] = await stockBalances({ siteId, produitId, excludeOperationId }, db);
  return b?.solde ?? 0;
}

export interface StockAlert {
  siteId: string;
  siteNom: string;
  produitId: string;
  produitNom: string;
  unite: string;
  solde: number;
  seuil: number;
}

/** Products whose balance on a site is below the alert threshold. */
export async function stockAlerts(siteId?: string): Promise<StockAlert[]> {
  const [sites, products, balances] = await Promise.all([
    prisma.site.findMany({ where: siteId ? { id: siteId } : {}, orderBy: { nom: "asc" } }),
    prisma.lubricant.findMany({ orderBy: { ordre: "asc" } }),
    stockBalances({ siteId }),
  ]);
  const alerts: StockAlert[] = [];
  for (const s of sites) {
    for (const p of products) {
      const solde = balances.find((b) => b.siteId === s.id && b.produitId === p.id)?.solde ?? 0;
      const seuil = toNum(p.seuilAlerte);
      if (solde < seuil) {
        alerts.push({ siteId: s.id, siteNom: s.nom, produitId: p.id, produitNom: p.nom, unite: p.unite, solde, seuil });
      }
    }
  }
  return alerts;
}
