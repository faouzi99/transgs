import type { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { siteScope } from "@/lib/permissions";
import { buildPeriod } from "@/lib/dates";
import { workbook } from "@/lib/excel";
import { fmtDateTime, toNum } from "@/lib/format";
import { fileResponse, unauthorized } from "@/lib/http";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const q = new URL(req.url).searchParams;
  const period = buildPeriod(q.get("vue") ?? undefined, q.get("ref") ?? undefined);
  const siteId = siteScope(user, q.get("site"));
  const sens = q.get("sens");
  const produitId = q.get("produit");
  const where: Prisma.StockMovementWhereInput = {
    date: { gte: period.start, lt: period.end },
    ...(siteId ? { siteId } : {}),
    ...(sens === "ENTREE" || sens === "SORTIE" ? { sens } : {}),
    ...(produitId ? { produitId } : {}),
  };
  const list = await prisma.stockMovement.findMany({
    where,
    include: { produit: true, site: true, agent: true, operation: { include: { correctedBy: true } }, correctedBy: true },
    orderBy: { date: "asc" },
  });
  const rows = [
    ["Date", "Sens", "Produit", "Quantité", "Unité", "Site", "Code parking", "Fournisseur", "Bon de livraison", "Opération", "Saisi par", "Saisi le", "En vigueur"],
    ...list.map((m) => [
      fmtDateTime(m.date),
      m.sens === "ENTREE" ? "Entrée" : "Sortie",
      m.produit.nom,
      toNum(m.quantite),
      m.produit.unite === "KG" ? "kg" : "L",
      m.site.nom,
      m.codeParking ?? "",
      m.fournisseur ?? "",
      m.bonLivraison ?? "",
      m.operation?.type ?? "",
      m.agent.nom,
      fmtDateTime(m.createdAt),
      m.correctedBy || m.operation?.correctedBy ? "Non (corrigé)" : "Oui",
    ]),
  ];
  return fileResponse(workbook([{ name: "Mouvements", rows }]), `mouvements-${period.label}`, "xlsx");
}
