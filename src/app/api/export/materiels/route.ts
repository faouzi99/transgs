import type { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { siteScope } from "@/lib/permissions";
import { workbook } from "@/lib/excel";
import { fileResponse, unauthorized } from "@/lib/http";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const q = new URL(req.url).searchParams;
  const code = q.get("q")?.trim().toUpperCase();
  const siteId = siteScope(user, q.get("site"));
  const famille = q.get("famille");
  const where: Prisma.EquipmentWhereInput = {
    ...(code ? { codeParking: { contains: code, mode: "insensitive" } } : {}),
    ...(siteId ? { siteId } : {}),
    ...(famille === "D" || famille === "E" ? { famille } : {}),
  };
  const list = await prisma.equipment.findMany({ where, include: { site: true }, orderBy: { codeParking: "asc" } });
  const rows = [
    ["Code parking", "Famille", "Marque", "Type", "Immatriculation", "Année", "Site", "Compteur", "Unité", "Prochaine vidange", "Actif"],
    ...list.map((e) => [
      e.codeParking,
      e.famille,
      e.marque,
      e.type,
      e.immatriculation ?? "",
      e.annee ?? "",
      e.site.nom,
      e.compteurActuel,
      e.uniteCompteur === "KM" ? "km" : "h",
      e.prochaineEcheance ?? "",
      e.actif ? "Oui" : "Non",
    ]),
  ];
  return fileResponse(workbook([{ name: "Matériels", rows }]), "materiels-transwin", "xlsx");
}
