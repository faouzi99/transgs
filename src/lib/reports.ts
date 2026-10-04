import "server-only";
import type { OperationType, ReportKind, ReportPeriod } from "@prisma/client";
import { prisma } from "./db";
import type { SessionUser } from "./auth";
import type { Period } from "./dates";
import type { ReportSpec, Tone } from "./report-spec";
import { consommationMensuelle, rapportOperation, suiviEntretien } from "./stats";
import { fmtDateTime, fmtInt, fmtMoney, fmtQty, MONTHS_FR } from "./format";
import { OPERATION_LABEL } from "./labels";
import { renderReportPdf } from "./pdf";
import { reportWorkbook } from "./excel";

async function siteLabel(siteId?: string) {
  if (!siteId) return "Tous les sites";
  return (await prisma.site.findUnique({ where: { id: siteId } }))?.nom ?? "—";
}

const footer = (site: string, periode: string, user: SessionUser) => ({
  site,
  periode,
  dateEdition: fmtDateTime(new Date()),
  auteur: user.nom,
});

/** Daily or monthly report for one operation type. */
export async function buildOperationReport(user: SessionUser, type: OperationType, period: Period, siteId?: string): Promise<ReportSpec> {
  const site = await siteLabel(siteId);
  const { ops, nonTraites, totals } = await rapportOperation(type, period.start, period.end, siteId);
  const u = (unite: string) => (unite === "KM" ? "km" : "h");
  const withLub = ops.some((o) => o.stockMovements.length > 0);
  return {
    titre: `Rapport ${period.view === "jour" ? "journalier" : "mensuel"} — ${OPERATION_LABEL[type]}`,
    entete: [
      ["Opération", OPERATION_LABEL[type]],
      ["Site", site],
      ["Période", period.label],
    ],
    sections: [
      {
        titre: "Matériels traités",
        colonnes: ["Date", "Code parking", "Site", "Agent", "Compteur", ...(withLub ? ["Lubrifiant"] : []), "Coût", "Validée"],
        alignRight: [4, withLub ? 6 : 5],
        lignes: ops.map((o) => {
          const eq = o.codeParking.startsWith("D") ? "KM" : "H";
          return [
            fmtDateTime(o.date),
            o.codeParking,
            o.site.nom,
            o.agent.nom,
            `${fmtInt(o.compteur)} ${u(eq)}`,
            ...(withLub
              ? [o.stockMovements.map((m) => `${m.produit.nom} ${fmtQty(m.quantite)} ${m.produit.unite === "KG" ? "kg" : "L"}`).join(", ") || "—"]
              : []),
            o.cout ? fmtMoney(o.cout) : "—",
            o.valideeLe ? "Oui" : "Non",
          ];
        }),
        vide: "Aucun matériel traité sur la période.",
      },
      {
        titre: "Matériels non traités",
        colonnes: ["Code parking", "Famille", "Marque", "Type", "Site"],
        lignes: nonTraites.map((e) => [e.codeParking, e.famille, e.marque, e.type, e.site.nom]),
        tones: nonTraites.map(() => ["bad", undefined, undefined, undefined, undefined] as Tone[]),
        vide: "Tous les matériels ont été traités.",
      },
    ],
    totaux: [
      ["Opérations enregistrées", fmtInt(totals.count)],
      ["Matériels traités", fmtInt(totals.materiels)],
      ["Matériels non traités", fmtInt(nonTraites.length)],
      ...totals.quantites.map((q) => [`${q.nom} consommé`, `${fmtQty(q.total)} ${q.unite === "KG" ? "kg" : "L"}`] as [string, string]),
      ["Coût total de la période", fmtMoney(totals.cout)],
    ],
    pied: footer(site, period.label, user),
  };
}

/** Soufflage / graissage / lavage follow-up. Rows with a "Non" come first. */
export async function buildSuiviReport(user: SessionUser, period: Period, siteId?: string): Promise<ReportSpec> {
  const site = await siteLabel(siteId);
  const rows = await suiviEntretien(period.start, period.end, siteId);
  const yn = (v: boolean) => (v ? "Oui" : "Non");
  const tone = (v: boolean): Tone => (v ? "ok" : "bad");
  const aTraiter = rows.filter((r) => r.manquants > 0).length;
  return {
    titre: `Suivi soufflage / graissage / lavage — ${period.view === "jour" ? "jour" : "mois"}`,
    entete: [
      ["Site", site],
      ["Période", period.label],
      ["Matériels à traiter", fmtInt(aTraiter)],
    ],
    sections: [
      {
        titre: "État par code parking",
        colonnes: ["Code parking", "Type", "Site", "Soufflage", "Graissage", "Lavage"],
        lignes: rows.map((r) => [r.codeParking, r.type, r.site, yn(r.status.SOUFFLAGE), yn(r.status.GRAISSAGE), yn(r.status.LAVAGE)]),
        tones: rows.map((r) => [r.manquants ? "bad" : undefined, undefined, undefined, tone(r.status.SOUFFLAGE), tone(r.status.GRAISSAGE), tone(r.status.LAVAGE)]),
        vide: "Aucun matériel.",
      },
    ],
    totaux: [
      ["Matériels suivis", fmtInt(rows.length)],
      ["Matériels à traiter (au moins un « Non »)", fmtInt(aTraiter)],
    ],
    pied: footer(site, period.label, user),
  };
}

/** 12 months x lubricants consumption table with a yearly total row. */
export async function buildConsommationReport(user: SessionUser, year: number, siteId?: string): Promise<ReportSpec> {
  const site = await siteLabel(siteId);
  const { products, rows, total } = await consommationMensuelle(year, siteId);
  const unit = (p: { unite: string }) => (p.unite === "KG" ? "kg" : "L");
  return {
    titre: `Consommation mensuelle des lubrifiants — ${year}`,
    entete: [
      ["Site", site],
      ["Année", String(year)],
    ],
    sections: [
      {
        titre: "Consommation par mois",
        colonnes: ["Mois", ...products.map((p) => `${p.nom} (${unit(p)})`)],
        alignRight: products.map((_, i) => i + 1),
        lignes: [
          ...rows.map((r) => [MONTHS_FR[r.mois], ...products.map((p) => `${fmtQty(r.values[p.id])} ${unit(p)}`)]),
          ["Total", ...products.map((p) => `${fmtQty(total[p.id])} ${unit(p)}`)],
        ],
      },
    ],
    pied: footer(site, String(year), user),
  };
}

/** Render a report to PDF + Excel and archive it so it can be re-opened without regeneration. */
export async function archiveReport(
  user: SessionUser,
  spec: ReportSpec,
  meta: { kind: ReportKind; operationType?: OperationType; period: ReportPeriod; start: Date; end: Date; siteId?: string },
) {
  const [pdf, xlsx] = await Promise.all([renderReportPdf(spec), Promise.resolve(reportWorkbook(spec))]);
  const row = await prisma.report.create({
    data: {
      kind: meta.kind,
      operationType: meta.operationType ?? null,
      period: meta.period,
      dateDebut: meta.start,
      dateFin: meta.end,
      siteId: meta.siteId ?? null,
      titre: `${spec.titre} · ${spec.pied.site} · ${spec.pied.periode}`,
      pdf: new Uint8Array(pdf),
      xlsx: new Uint8Array(xlsx),
      authorId: user.id,
    },
    select: { id: true },
  });
  return { id: row.id, pdf, xlsx };
}

export const periodEnum = (view: Period["view"]): ReportPeriod => (view === "jour" ? "JOUR" : view === "annee" ? "ANNEE" : "MOIS");
