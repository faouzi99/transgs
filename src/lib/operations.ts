import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import type { SessionUser } from "./auth";
import { canWriteOnSite, ForbiddenError } from "./permissions";
import { balanceOf } from "./stock";
import { getPeriodicite } from "./settings";
import type { OperationInput } from "./validation";
import { toNum } from "./format";

export class BusinessError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
  }
}

const dec = (v: number | undefined) => (v === undefined ? null : new Prisma.Decimal(v));

/**
 * Record an operation (or a correction of one). Runs in one transaction:
 * - the lubricant used becomes a SORTIE stock movement tied to the operation and the code parking;
 * - a VIDANGE recomputes the next oil-change due counter of the equipment;
 * - the equipment counter only moves forward.
 */
export async function recordOperation(user: SessionUser, input: OperationInput) {
  if (!canWriteOnSite(user, input.siteId)) throw new ForbiddenError("Vous ne pouvez saisir que sur votre site");
  // Checked on the server only: the browser may run in another time zone.
  if (new Date(input.date).getTime() > Date.now() + 5 * 60 * 1000) {
    throw new BusinessError("La date ne peut pas être dans le futur", "date");
  }

  return prisma.$transaction(
    async (tx) => {
      const equipment = await tx.equipment.findUnique({ where: { codeParking: input.codeParking } });
      if (!equipment || !equipment.actif) throw new BusinessError("Code parking inconnu ou inactif", "codeParking");

      let original: { id: string; siteId: string; valideeLe: Date | null } | null = null;
      if (input.correctionOfId) {
        const found = await tx.operation.findUnique({
          where: { id: input.correctionOfId },
          include: { correctedBy: true },
        });
        if (!found) throw new BusinessError("Opération à corriger introuvable");
        original = found;
        if (found.correctedBy) {
          throw new BusinessError("Cette opération a déjà été corrigée : corrigez la dernière version");
        }
        if (user.role === "AGENT") {
          if (original.valideeLe) throw new ForbiddenError("Une saisie validée ne peut plus être modifiée par un agent");
          if (original.siteId !== user.siteId) throw new ForbiddenError();
        }
        if (user.role === "CHEF_SITE" && original.siteId !== user.siteId) throw new ForbiddenError();
      }

      if (input.produitId && input.quantite) {
        const produit = await tx.lubricant.findUnique({ where: { id: input.produitId } });
        if (!produit) throw new BusinessError("Produit inconnu", "produitId");
        // Movements of the operation being corrected no longer count once it is replaced.
        const available = await balanceOf(input.siteId, input.produitId, tx, original?.id);
        if (available < input.quantite) {
          throw new BusinessError(
            `Stock insuffisant : ${available.toFixed(1)} ${produit.unite} disponible(s) sur ce site`,
            "quantite",
          );
        }
      }

      const date = new Date(input.date);
      let prochaineEcheance: number | null = null;
      if (input.type === "VIDANGE") {
        prochaineEcheance = input.compteur + (await getPeriodicite(equipment.famille));
      }

      let cout = input.cout;
      if (input.type === "REPARATION" && (input.coutPieces !== undefined || input.coutMainOeuvre !== undefined)) {
        cout = (input.coutPieces ?? 0) + (input.coutMainOeuvre ?? 0);
      }

      const autoValidate = user.role === "CHEF_SITE" || user.role === "ADMIN";
      const isVidange = input.type === "VIDANGE";
      const isRepair = input.type === "REPARATION";

      const op = await tx.operation.create({
        data: {
          codeParking: equipment.codeParking,
          type: input.type,
          date,
          agentId: user.id,
          siteId: input.siteId,
          compteur: input.compteur,
          observation: input.observation ?? null,
          cout: dec(cout),
          valideeParId: autoValidate ? user.id : null,
          valideeLe: autoValidate ? new Date() : null,
          produitId: input.produitId ?? null,
          quantite: dec(input.quantite),
          filtreChange: isVidange ? input.filtreChange : null,
          prochaineEcheance,
          panne: isRepair ? input.panne ?? null : null,
          pieces: isRepair ? input.pieces ?? null : null,
          fournisseur: isRepair ? input.fournisseur ?? null : null,
          dureeImmobilisationJours: isRepair && input.dureeImmobilisationJours !== undefined
            ? Math.round(input.dureeImmobilisationJours)
            : null,
          coutPieces: isRepair ? dec(input.coutPieces) : null,
          coutMainOeuvre: isRepair ? dec(input.coutMainOeuvre) : null,
          correctionOfId: original?.id ?? null,
          motifCorrection: input.motifCorrection ?? null,
        },
      });

      if (input.produitId && input.quantite) {
        await tx.stockMovement.create({
          data: {
            produitId: input.produitId,
            sens: "SORTIE",
            quantite: new Prisma.Decimal(input.quantite),
            siteId: input.siteId,
            codeParking: equipment.codeParking,
            operationId: op.id,
            date,
            agentId: user.id,
          },
        });
      }

      await refreshEquipment(tx, equipment.codeParking, input.compteur);
      return op;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

/** Recompute derived equipment fields from the current (uncorrected) operations. */
async function refreshEquipment(tx: Prisma.TransactionClient, codeParking: string, compteur: number) {
  const equipment = await tx.equipment.findUniqueOrThrow({ where: { codeParking } });
  const lastVidange = await tx.operation.findFirst({
    where: { codeParking, type: "VIDANGE", correctedBy: { is: null } },
    orderBy: { date: "desc" },
  });
  await tx.equipment.update({
    where: { codeParking },
    data: {
      compteurActuel: Math.max(equipment.compteurActuel, compteur),
      prochaineEcheance: lastVidange?.prochaineEcheance ?? equipment.prochaineEcheance,
    },
  });
}

export async function validateOperation(user: SessionUser, id: string) {
  if (user.role !== "CHEF_SITE" && user.role !== "ADMIN") throw new ForbiddenError();
  const op = await prisma.operation.findUnique({ where: { id }, include: { correctedBy: true } });
  if (!op) throw new BusinessError("Opération introuvable");
  if (user.role === "CHEF_SITE" && op.siteId !== user.siteId) throw new ForbiddenError();
  if (op.correctedBy) throw new BusinessError("Opération remplacée par une correction");
  if (op.valideeLe) return op;
  return prisma.operation.update({ where: { id }, data: { valideeParId: user.id, valideeLe: new Date() } });
}

/** Lubricant cost of an operation (sum of its SORTIE movements at the product unit price). */
export function lubricantCost(movements: { quantite: Prisma.Decimal; produit: { prixUnitaire: Prisma.Decimal } }[]) {
  return movements.reduce((s, m) => s + toNum(m.quantite) * toNum(m.produit.prixUnitaire), 0);
}
