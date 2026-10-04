import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isSiteBound } from "@/lib/permissions";
import { toDateInput, toMonthInput } from "@/lib/dates";
import { str, type SearchParams } from "@/lib/params";
import { fmtDateTime } from "@/lib/format";
import { Empty, Notice, PageHeader } from "@/components/ui";
import { GenerateReportForm } from "./generate-form";

const KIND_LABEL = { OPERATION: "Opération", SUIVI: "Suivi entretien", CONSOMMATION: "Consommation" } as const;

export default async function RapportsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const sp = await searchParams;
  const bound = isSiteBound(user.role);
  const kind = str(sp.kind);
  const where: Prisma.ReportWhereInput = {
    ...(bound ? { siteId: user.siteId ?? "__none__" } : {}),
    ...(kind === "OPERATION" || kind === "SUIVI" || kind === "CONSOMMATION" ? { kind } : {}),
  };
  const [sites, reports] = await Promise.all([
    prisma.site.findMany({ orderBy: { nom: "asc" } }),
    prisma.report.findMany({
      where,
      select: { id: true, kind: true, titre: true, createdAt: true, author: { select: { nom: true } }, site: { select: { nom: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);
  const nouveau = str(sp.nouveau);
  const now = new Date();

  return (
    <div>
      <PageHeader title="Rapports" subtitle="Rapport PDF journalier ou mensuel par opération, avec export Excel du même contenu" />
      {nouveau && (
        <Notice tone="ok">
          Rapport généré et archivé.{" "}
          <a className="font-semibold underline" href={`/api/rapports/${nouveau}/pdf`} target="_blank">Ouvrir le PDF</a> ·{" "}
          <a className="font-semibold underline" href={`/api/rapports/${nouveau}/xlsx`}>Télécharger l&apos;Excel</a>
        </Notice>
      )}
      <div className="card mb-4">
        <h2 className="card-title">Nouveau rapport</h2>
        <GenerateReportForm sites={bound ? undefined : sites} defaults={{ jour: toDateInput(now), mois: toMonthInput(now) }} />
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold">Archives :</span>
        {[["", "Tous"], ["OPERATION", "Opérations"], ["SUIVI", "Suivi entretien"], ["CONSOMMATION", "Consommation"]].map(([k, l]) => (
          <a key={k} href={k ? `/rapports?kind=${k}` : "/rapports"} className={`badge ${kind === k || (!kind && !k) ? "bg-ink text-white" : "bg-slate-100 text-ink"}`}>
            {l}
          </a>
        ))}
      </div>
      <div className="card overflow-x-auto p-0">
        {reports.length === 0 ? (
          <Empty>Aucun rapport archivé.</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Généré le</th>
                <th>Type</th>
                <th>Rapport</th>
                <th>Auteur</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} className={r.id === nouveau ? "bg-accent-light/50" : ""}>
                  <td className="whitespace-nowrap">{fmtDateTime(r.createdAt)}</td>
                  <td>{KIND_LABEL[r.kind]}</td>
                  <td>{r.titre}</td>
                  <td>{r.author.nom}</td>
                  <td className="whitespace-nowrap">
                    <a className="btn btn-sm" href={`/api/rapports/${r.id}/pdf`} target="_blank">PDF</a>{" "}
                    <a className="btn btn-sm" href={`/api/rapports/${r.id}/xlsx`}>Excel</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
