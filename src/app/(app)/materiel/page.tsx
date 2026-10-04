import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isSiteBound, siteScope } from "@/lib/permissions";
import { parseFamille, str, type SearchParams } from "@/lib/params";
import { fmtDate, fmtInt } from "@/lib/format";
import { PageHeader, Empty } from "@/components/ui";

export default async function MaterielSearchPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = str(sp.q)?.trim().toUpperCase();
  const siteId = siteScope(user, str(sp.site));
  const famille = parseFamille(str(sp.famille));

  const where: Prisma.EquipmentWhereInput = {
    ...(q ? { codeParking: { contains: q, mode: "insensitive" } } : {}),
    ...(siteId ? { siteId } : {}),
    ...(famille ? { famille } : {}),
  };

  // Exact code parking => open the equipment sheet directly.
  if (q) {
    const exact = await prisma.equipment.findFirst({ where: { ...where, codeParking: q } });
    if (exact) redirect(`/materiel/${exact.codeParking}`);
  }

  const [sites, list] = await Promise.all([
    prisma.site.findMany({ orderBy: { nom: "asc" } }),
    prisma.equipment.findMany({
      where,
      include: { site: true, operations: { where: { correctedBy: { is: null } }, orderBy: { date: "desc" }, take: 1 } },
      orderBy: { codeParking: "asc" },
    }),
  ]);

  const exportParams = new URLSearchParams();
  if (q) exportParams.set("q", q);
  if (siteId) exportParams.set("site", siteId);
  if (famille) exportParams.set("famille", famille);

  return (
    <div>
      <PageHeader
        title="Recherche matériel"
        subtitle="Par code parking, site ou famille"
        actions={
          <a className="btn" href={`/api/export/materiels?${exportParams}`}>
            Exporter Excel
          </a>
        }
      />
      <form className="mb-4 flex flex-wrap items-end gap-3 rounded border border-line bg-slate-50 p-3" method="get">
        <div className="min-w-56 flex-1">
          <label className="label" htmlFor="q">Code parking</label>
          <input id="q" name="q" defaultValue={q} placeholder="Ex. D101, E204…" className="input text-lg font-semibold uppercase" autoFocus />
        </div>
        {!isSiteBound(user.role) && (
          <div>
            <label className="label" htmlFor="site">Site</label>
            <select id="site" name="site" defaultValue={str(sp.site) ?? ""} className="input w-52">
              <option value="">Tous les sites</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>{s.nom}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="label" htmlFor="famille">Famille</label>
          <select id="famille" name="famille" defaultValue={famille ?? ""} className="input w-40">
            <option value="">D et E</option>
            <option value="D">Camions (D)</option>
            <option value="E">Engins (E)</option>
          </select>
        </div>
        <button className="btn-primary">Rechercher</button>
      </form>

      <div className="card overflow-x-auto p-0">
        {list.length === 0 ? (
          <Empty>Aucun matériel trouvé.</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Code parking</th>
                <th>Famille</th>
                <th>Marque</th>
                <th>Type</th>
                <th>Immatriculation</th>
                <th>Site</th>
                <th className="num">Compteur</th>
                <th className="num">Proch. vidange</th>
                <th>Dernière opération</th>
              </tr>
            </thead>
            <tbody>
              {list.map((e) => {
                const due = e.prochaineEcheance !== null && e.compteurActuel >= e.prochaineEcheance;
                const u = e.uniteCompteur === "KM" ? "km" : "h";
                return (
                  <tr key={e.codeParking} className={e.actif ? "" : "opacity-50"}>
                    <td>
                      <Link href={`/materiel/${e.codeParking}`} className="font-bold text-accent-dark hover:underline">
                        {e.codeParking}
                      </Link>
                    </td>
                    <td>{e.famille}</td>
                    <td>{e.marque}</td>
                    <td>{e.type}</td>
                    <td>{e.immatriculation ?? "—"}</td>
                    <td>{e.site.nom}</td>
                    <td className="num">{fmtInt(e.compteurActuel)} {u}</td>
                    <td className={`num ${due ? "font-semibold text-bad" : ""}`}>
                      {e.prochaineEcheance !== null ? `${fmtInt(e.prochaineEcheance)} ${u}` : "—"}
                    </td>
                    <td>{e.operations[0] ? fmtDate(e.operations[0].date) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <p className="mt-2 text-xs text-muted">{list.length} matériel(s)</p>
    </div>
  );
}
