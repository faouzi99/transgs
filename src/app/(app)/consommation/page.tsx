import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isSiteBound, siteScope } from "@/lib/permissions";
import { str, type SearchParams } from "@/lib/params";
import { consommationMensuelle } from "@/lib/stats";
import { fmtQty, MONTHS_FR } from "@/lib/format";
import { FilterBar } from "@/components/filter-bar";
import { PageHeader } from "@/components/ui";

export default async function ConsommationPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const sp = await searchParams;
  const year = Number(str(sp.annee)) || new Date().getFullYear();
  const siteId = siteScope(user, str(sp.site));
  const [sites, { products, rows, total }] = await Promise.all([
    prisma.site.findMany({ orderBy: { nom: "asc" } }),
    consommationMensuelle(year, siteId),
  ]);
  const unit = (u: string) => (u === "KG" ? "kg" : "L");
  const qs = new URLSearchParams({ annee: String(year) });
  if (siteId) qs.set("site", siteId);

  return (
    <div>
      <PageHeader
        title="Tableau de consommation mensuelle"
        subtitle={`${year} · ${siteId ? sites.find((s) => s.id === siteId)?.nom : "Tous les sites"}`}
      />
      <FilterBar options={{ year: true, sites: isSiteBound(user.role) ? undefined : sites }}>
        <div className="ml-auto flex gap-2">
          <a href={`/api/consommation/pdf?${qs}`} className="btn">PDF</a>
          <a href={`/api/consommation/xlsx?${qs}`} className="btn">Excel</a>
        </div>
      </FilterBar>
      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead>
            <tr>
              <th>Mois</th>
              {products.map((p) => (
                <th key={p.id} className="num">{p.nom} ({unit(p.unite)})</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.mois}>
                <td className="font-medium">{MONTHS_FR[r.mois]}</td>
                {products.map((p) => (
                  <td key={p.id} className={`num ${r.values[p.id] === 0 ? "text-muted" : ""}`}>
                    {fmtQty(r.values[p.id])} {unit(p.unite)}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="border-t-2 border-ink bg-slate-50 font-bold">
              <td>Total {year}</td>
              {products.map((p) => (
                <td key={p.id} className="num">{fmtQty(total[p.id])} {unit(p.unite)}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
