import "server-only";
import type { Famille, OperationType, Prisma } from "@prisma/client";
import { prisma } from "./db";
import { currentMovement, currentOperation } from "./stock";
import { toNum } from "./format";
import { getSettings } from "./settings";

export interface Filters {
  start: Date;
  end: Date;
  siteId?: string;
  famille?: Famille;
  type?: OperationType;
}

function opWhere(f: Filters): Prisma.OperationWhereInput {
  return {
    AND: [
      currentOperation,
      { date: { gte: f.start, lt: f.end } },
      f.siteId ? { siteId: f.siteId } : {},
      f.famille ? { equipment: { famille: f.famille } } : {},
      f.type ? { type: f.type } : {},
    ],
  };
}

function sortieWhere(f: Omit<Filters, "type"> & { type?: OperationType }): Prisma.StockMovementWhereInput {
  return {
    AND: [
      currentMovement,
      { sens: "SORTIE", date: { gte: f.start, lt: f.end } },
      f.siteId ? { siteId: f.siteId } : {},
      f.famille ? { equipment: { famille: f.famille } } : {},
      f.type ? { operation: { type: f.type } } : {},
    ],
  };
}

/** Current operations in the period with what cost computations need. */
export async function loadOperations(f: Filters) {
  return prisma.operation.findMany({
    where: opWhere(f),
    select: {
      id: true,
      type: true,
      date: true,
      siteId: true,
      codeParking: true,
      compteur: true,
      cout: true,
      coutPieces: true,
      coutMainOeuvre: true,
      valideeLe: true,
      agent: { select: { nom: true } },
      equipment: { select: { famille: true, type: true, marque: true } },
      stockMovements: {
        where: { sens: "SORTIE" },
        select: { quantite: true, produitId: true, produit: { select: { prixUnitaire: true } } },
      },
    },
    orderBy: { date: "asc" },
  });
}

export type LoadedOperation = Awaited<ReturnType<typeof loadOperations>>[number];

export function lubCost(op: LoadedOperation) {
  return op.stockMovements.reduce((s, m) => s + toNum(m.quantite) * toNum(m.produit.prixUnitaire), 0);
}
export const totalCost = (op: LoadedOperation) => toNum(op.cout) + lubCost(op);

/** Current SORTIE movements in the period (lubricant consumption). */
export async function loadSorties(f: Filters) {
  return prisma.stockMovement.findMany({
    where: sortieWhere(f),
    select: {
      quantite: true,
      date: true,
      siteId: true,
      produitId: true,
      codeParking: true,
      equipment: { select: { famille: true, type: true } },
      produit: { select: { prixUnitaire: true } },
    },
  });
}

/** Time buckets for a period: hours for a day, days for a month, months for a year. */
export function buckets(view: "jour" | "mois" | "annee", start: Date) {
  if (view === "jour") {
    return Array.from({ length: 24 }, (_, h) => ({ key: h, label: `${h}h`, match: (d: Date) => d.getHours() === h }));
  }
  if (view === "mois") {
    const days = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    return Array.from({ length: days }, (_, i) => ({
      key: i + 1,
      label: String(i + 1),
      match: (d: Date) => d.getDate() === i + 1,
    }));
  }
  const names = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
  return names.map((label, m) => ({ key: m, label, match: (d: Date) => d.getMonth() === m }));
}

export interface HorsNorme {
  codeParking: string;
  type: string;
  produitNom: string;
  unite: string;
  valeur: number;
  moyenne: number;
  ecartPct: number;
}

/**
 * Equipment whose consumption of a product is significantly above the average of the
 * equipment of the same type (same `type` label) over the window. Threshold is the
 * `hors_norme_pct` setting (default +50 %). Groups with a single equipment are ignored.
 */
export async function horsNorme(f: Omit<Filters, "type">): Promise<HorsNorme[]> {
  const [settings, products, equipments, sorties] = await Promise.all([
    getSettings(),
    prisma.lubricant.findMany(),
    prisma.equipment.findMany({
      where: {
        actif: true,
        ...(f.siteId ? { siteId: f.siteId } : {}),
        ...(f.famille ? { famille: f.famille } : {}),
      },
      select: { codeParking: true, type: true },
    }),
    loadSorties(f),
  ]);
  const threshold = 1 + settings.hors_norme_pct / 100;
  const out: HorsNorme[] = [];
  const byType = new Map<string, string[]>();
  for (const e of equipments) byType.set(e.type, [...(byType.get(e.type) ?? []), e.codeParking]);

  for (const p of products) {
    const perEquipment = new Map<string, number>();
    for (const s of sorties) {
      if (s.produitId !== p.id || !s.codeParking) continue;
      perEquipment.set(s.codeParking, (perEquipment.get(s.codeParking) ?? 0) + toNum(s.quantite));
    }
    for (const [type, codes] of byType) {
      if (codes.length < 2) continue;
      const values = codes.map((c) => perEquipment.get(c) ?? 0);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      if (mean <= 0) continue;
      codes.forEach((c, i) => {
        if (values[i] > mean * threshold) {
          out.push({
            codeParking: c,
            type,
            produitNom: p.nom,
            unite: p.unite,
            valeur: values[i],
            moyenne: mean,
            ecartPct: ((values[i] - mean) / mean) * 100,
          });
        }
      });
    }
  }
  return out.sort((a, b) => b.ecartPct - a.ecartPct);
}

/** Equipment whose counter reached the next oil-change due value. */
export async function vidangesEchues(siteId?: string, famille?: Famille) {
  const list = await prisma.equipment.findMany({
    where: {
      actif: true,
      prochaineEcheance: { not: null },
      ...(siteId ? { siteId } : {}),
      ...(famille ? { famille } : {}),
    },
    select: { codeParking: true, compteurActuel: true, prochaineEcheance: true, uniteCompteur: true },
  });
  return list.filter((e) => e.prochaineEcheance !== null && e.compteurActuel >= e.prochaineEcheance);
}

/** 12 months x products consumption table for a year. */
export async function consommationMensuelle(year: number, siteId?: string) {
  const products = await prisma.lubricant.findMany({ orderBy: { ordre: "asc" } });
  const sorties = await loadSorties({ start: new Date(year, 0, 1), end: new Date(year + 1, 0, 1), siteId });
  const rows = Array.from({ length: 12 }, (_, m) => {
    const values: Record<string, number> = {};
    for (const p of products) values[p.id] = 0;
    for (const s of sorties) if (s.date.getMonth() === m) values[s.produitId] = (values[s.produitId] ?? 0) + toNum(s.quantite);
    return { mois: m, values };
  });
  const total: Record<string, number> = {};
  for (const p of products) total[p.id] = rows.reduce((s, r) => s + r.values[p.id], 0);
  return { products, rows, total };
}

const SUIVI_TYPES: OperationType[] = ["SOUFFLAGE", "GRAISSAGE", "LAVAGE"];

/** One row per code parking with Oui/Non for soufflage, graissage, lavage. "Non" rows first. */
export async function suiviEntretien(start: Date, end: Date, siteId?: string) {
  const [equipments, ops] = await Promise.all([
    prisma.equipment.findMany({
      where: { actif: true, ...(siteId ? { siteId } : {}) },
      include: { site: true },
      orderBy: { codeParking: "asc" },
    }),
    prisma.operation.findMany({
      where: { ...currentOperation, type: { in: SUIVI_TYPES }, date: { gte: start, lt: end }, ...(siteId ? { siteId } : {}) },
      select: { codeParking: true, type: true },
    }),
  ]);
  const done = new Set(ops.map((o) => `${o.codeParking}|${o.type}`));
  const rows = equipments.map((e) => {
    const status = {
      SOUFFLAGE: done.has(`${e.codeParking}|SOUFFLAGE`),
      GRAISSAGE: done.has(`${e.codeParking}|GRAISSAGE`),
      LAVAGE: done.has(`${e.codeParking}|LAVAGE`),
    };
    const manquants = Object.values(status).filter((v) => !v).length;
    return { codeParking: e.codeParking, famille: e.famille, type: e.type, site: e.site.nom, status, manquants };
  });
  rows.sort((a, b) => b.manquants - a.manquants || a.codeParking.localeCompare(b.codeParking));
  return rows;
}

/** Data of the per-operation report: treated equipment, totals, untreated equipment. */
export async function rapportOperation(type: OperationType, start: Date, end: Date, siteId?: string) {
  const [ops, equipments] = await Promise.all([
    prisma.operation.findMany({
      where: { ...currentOperation, type, date: { gte: start, lt: end }, ...(siteId ? { siteId } : {}) },
      include: {
        agent: { select: { nom: true } },
        site: { select: { nom: true } },
        produit: true,
        stockMovements: { include: { produit: true } },
      },
      orderBy: { date: "asc" },
    }),
    prisma.equipment.findMany({
      where: { actif: true, ...(siteId ? { siteId } : {}) },
      include: { site: true },
      orderBy: { codeParking: "asc" },
    }),
  ]);
  const treated = new Set(ops.map((o) => o.codeParking));
  const nonTraites = equipments.filter((e) => !treated.has(e.codeParking));
  const quantites = new Map<string, { nom: string; unite: string; total: number }>();
  let cout = 0;
  for (const o of ops) {
    cout += toNum(o.cout);
    for (const m of o.stockMovements) {
      const q = quantites.get(m.produitId) ?? { nom: m.produit.nom, unite: m.produit.unite, total: 0 };
      q.total += toNum(m.quantite);
      quantites.set(m.produitId, q);
      cout += toNum(m.quantite) * toNum(m.produit.prixUnitaire);
    }
  }
  return {
    ops,
    nonTraites,
    totals: { count: ops.length, materiels: treated.size, cout, quantites: [...quantites.values()] },
  };
}
