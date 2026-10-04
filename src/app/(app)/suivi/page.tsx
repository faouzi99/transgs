import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isSiteBound, siteScope } from "@/lib/permissions";
import { buildPeriod, periodRefValue } from "@/lib/dates";
import { str, type SearchParams } from "@/lib/params";
import { suiviEntretien } from "@/lib/stats";
import { FilterBar } from "@/components/filter-bar";
import { Empty, PageHeader, YesNo } from "@/components/ui";

export default async function SuiviPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const sp = await searchParams;
  const period = buildPeriod(str(sp.vue) === "jour" ? "jour" : "mois", str(sp.ref));
  const siteId = siteScope(user, str(sp.site));
  const [sites, rows] = await Promise.all([
    prisma.site.findMany({ orderBy: { nom: "asc" } }),
    suiviEntretien(period.start, period.end, siteId),
  ]);
  const aTraiter = rows.filter((r) => r.manquants > 0).length;
  const pdfQs = new URLSearchParams({ vue: period.view, ref: periodRefValue(period) });
  if (siteId) pdfQs.set("site", siteId);

  return (
    <div>
      <PageHeader
        title="Suivi soufflage / graissage / lavage"
        subtitle={`${period.label} · ${aTraiter} matériel(s) à traiter sur ${rows.length}`}
      />
      <FilterBar options={{ view: true, views: ["jour", "mois"], sites: isSiteBound(user.role) ? undefined : sites }}>
        <a href={`/api/suivi/pdf?${pdfQs}`} className="btn-primary ml-auto">Télécharger le PDF</a>
      </FilterBar>
      <div className="card overflow-x-auto p-0">
        {rows.length === 0 ? (
          <Empty>Aucun matériel.</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Code parking</th>
                <th>Type</th>
                <th>Site</th>
                <th className="text-center">Soufflage</th>
                <th className="text-center">Graissage</th>
                <th className="text-center">Lavage</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.codeParking} className={r.manquants ? "bg-bad/[0.03]" : ""}>
                  <td>
                    <Link href={`/materiel/${r.codeParking}`} className="font-bold text-accent-dark hover:underline">{r.codeParking}</Link>
                  </td>
                  <td>{r.type}</td>
                  <td>{r.site}</td>
                  <td className="text-center"><YesNo value={r.status.SOUFFLAGE} /></td>
                  <td className="text-center"><YesNo value={r.status.GRAISSAGE} /></td>
                  <td className="text-center"><YesNo value={r.status.LAVAGE} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="mt-2 text-xs text-muted">« Non » = matériel à traiter, remonté en tête de liste et du rapport.</p>
    </div>
  );
}
