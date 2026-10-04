"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canWriteOnSite } from "@/lib/permissions";
import { addMonths, parseMonth } from "@/lib/dates";
import { stockBalances } from "@/lib/stock";
import { entreeSchema, fieldErrors, inventaireSchema, type ActionState } from "@/lib/validation";

/** Stock receipt (bon de livraison), or correction of a previous receipt. */
export async function entreeAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser(["ADMIN", "AGENT", "CHEF_SITE"]);
  const parsed = entreeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error), message: "Vérifiez les champs en rouge." };
  const v = parsed.data;
  if (!canWriteOnSite(user, v.siteId)) return { message: "Vous ne pouvez saisir que sur votre site." };

  if (v.correctionOfId) {
    const original = await prisma.stockMovement.findUnique({ where: { id: v.correctionOfId }, include: { correctedBy: true } });
    if (!original || original.sens !== "ENTREE") return { message: "Entrée à corriger introuvable." };
    if (original.correctedBy) return { message: "Cette entrée a déjà été corrigée." };
    if (!canWriteOnSite(user, original.siteId)) return { message: "Entrée d'un autre site." };
    if (!v.motifCorrection) return { errors: { motifCorrection: "Motif obligatoire" } };
  }

  await prisma.stockMovement.create({
    data: {
      produitId: v.produitId,
      sens: "ENTREE",
      quantite: new Prisma.Decimal(v.quantite),
      siteId: v.siteId,
      fournisseur: v.fournisseur,
      bonLivraison: v.bonLivraison ?? null,
      date: new Date(v.date),
      agentId: user.id,
      correctionOfId: v.correctionOfId ?? null,
      motifCorrection: v.motifCorrection ?? null,
    },
  });
  revalidatePath("/", "layout");
  return { ok: true, message: v.correctionOfId ? "Correction enregistrée." : "Entrée enregistrée." };
}

/** Monthly physical inventory. The theoretical balance is recomputed server-side. */
export async function inventaireAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser(["ADMIN", "AGENT", "CHEF_SITE"]);
  const raw = Object.fromEntries(formData);
  const mois = parseMonth(String(raw.mois ?? ""));
  if (!mois) return { message: "Mois invalide" };
  const siteId = String(raw.siteId ?? "");
  const produitId = String(raw.produitId ?? "");
  if (!canWriteOnSite(user, siteId)) return { message: "Vous ne pouvez saisir que sur votre site." };

  const end = addMonths(mois, 1);
  const before = end < new Date() ? end : new Date();
  const [b] = await stockBalances({ siteId, produitId, before });
  const theorique = Math.round((b?.solde ?? 0) * 100) / 100;

  const parsed = inventaireSchema.safeParse({ ...raw, quantiteTheorique: String(theorique) });
  if (!parsed.success) return { errors: fieldErrors(parsed.error), message: "Vérifiez les champs en rouge." };
  const v = parsed.data;
  const ecart = Math.round((v.quantitePhysique - theorique) * 100) / 100;

  await prisma.inventory.create({
    data: {
      siteId,
      produitId,
      mois,
      quantitePhysique: new Prisma.Decimal(v.quantitePhysique),
      quantiteTheorique: new Prisma.Decimal(theorique),
      ecart: new Prisma.Decimal(ecart),
      justification: v.justification ?? null,
      agentId: user.id,
    },
  });
  revalidatePath("/stock");
  return { ok: true, message: `Inventaire enregistré (écart ${ecart.toLocaleString("fr-FR")}).` };
}
