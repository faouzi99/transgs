import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isSiteBound, siteScope } from "@/lib/permissions";
import { buildPeriod } from "@/lib/dates";
import { parseFamille, str, type SearchParams } from "@/lib/params";
import { horsNorme, loadOperations, loadSorties, totalCost } from "@/lib/stats";
import { getSettings } from "@/lib/settings";
import { fmtInt, fmtQty, MONTHS_SHORT_FR, toNum } from "@/lib/format";
import { FilterBar } from "@/components/filter-bar";
import { ParamSelect } from "@/components/param-select";
import { BarChartCard, LineChartCard } from "@/components/charts";
import { Notice, PageHeader } from "@/components/ui";

export default async function AnalysesPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const sp = await searchParams;
  const period = buildPeriod(str(sp.vue) ?? "annee", str(sp.ref));
  const siteId = siteScope(user, str(sp.site));
  const famille = parseFamille(str(sp.famille));
  const f = { start: period.start, end: period.end, siteId, famille };

  const [sites, products, equipments, sorties, ops, hn, settings] = await Promise.all([
    prisma.site.findMany({ orderBy: { nom: "asc" } }),
    prisma.lubricant.findMany({ orderBy: { ordre: "asc" } }),
    prisma.equipment.findMany({
      where: { ...(siteId ? { siteId } : {}), ...(famille ? { famille } : {}) },
      orderBy: { codeParking: "asc" },
    }),
    loadSorties(f),
    loadOperations(f),
    horsNorme(f),
    getSettings(),
  ]);
  const unit = (p: { unite: string }) => (p.unite === "KG" ? "kg" : "L");

  // 1. Ranking per product, one chart each.
  const perProduct = products.map((p) => {
    const m = new Map<string, number>();
    for (const s of sorties) if (s.produitId === p.id && s.codeParking) m.set(s.codeParking, (m.get(s.codeParking) ?? 0) + toNum(s.quantite));
    const data = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([code, q]) => ({ code, q }));
    return { p, data };
  });

  // 2. Monthly evolution of one equipment over the year of the period.
  const year = period.start.getFullYear();
  const choisi = str(sp.materiel) ?? equipments[0]?.codeParking;
  const yearSorties = choisi
    ? await prisma.stockMovement.findMany({
        where: {
          codeParking: choisi,
          sens: "SORTIE",
          date: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) },
          correctedBy: { is: null },
          OR: [{ operationId: null }, { operation: { correctedBy: { is: null } } }],
        },
        select: { date: true, produitId: true, quantite: true },
      })
    : [];
  const evolution = MONTHS_SHORT_FR.map((label, m) => {
    const row: Record<string, string | number> = { label };
    for (const p of products) row[p.id] = yearSorties.filter((s) => s.produitId === p.id && s.date.getMonth() === m).reduce((a, s) => a + toNum(s.quantite), 0);
    return row;
  });

  // 3. Gap between two equipment of the same type.
  const a = str(sp.a);
  const b = str(sp.b);
  const eqA = equipments.find((e) => e.codeParking === a);
  const eqB = equipments.find((e) => e.codeParking === b);
  const consoOf = (code: string, pid: string) =>
    sorties.filter((s) => s.codeParking === code && s.produitId === pid).reduce((x, s) => x + toNum(s.quantite), 0);
  const ecart =
    eqA && eqB
      ? products.map((p) => ({ produit: `${p.nom} (${unit(p)})`, A: consoOf(eqA.codeParking, p.id), B: consoOf(eqB.codeParking, p.id) }))
      : null;

  // 4. Average consumption per equipment, by family.
  const countByFam = { D: equipments.filter((e) => e.famille === "D").length, E: equipments.filter((e) => e.famille === "E").length };
  const moyenneFamille = products.map((p) => {
    const sum = (fam: "D" | "E") => sorties.filter((s) => s.produitId === p.id && s.equipment?.famille === fam).reduce((x, s) => x + toNum(s.quantite), 0);
    return {
      produit: `${p.nom} (${unit(p)})`,
      D: countByFam.D ? sum("D") / countByFam.D : 0,
      E: countByFam.E ? sum("E") / countByFam.E : 0,
    };
  });

  // 5. Maintenance cost per equipment and per site.
  const costByEq = new Map<string, number>();
  const costBySite = new Map<string, number>();
  for (const o of ops) {
    costByEq.set(o.codeParking, (costByEq.get(o.codeParking) ?? 0) + totalCost(o));
    costBySite.set(o.siteId, (costBySite.get(o.siteId) ?? 0) + totalCost(o));
  }
  const costEqData = [...costByEq.entries()].sort((x, y) => y[1] - x[1]).map(([code, cout]) => ({ code, cout }));
  const costSiteData = sites.filter((s) => !siteId || s.id === siteId).map((s) => ({ site: s.nom, cout: costBySite.get(s.id) ?? 0 }));

  const eqOptions = equipments.map((e) => ({ value: e.codeParking, label: `${e.codeParking} — ${e.type}` }));
  const sameTypeOptions = eqA ? equipments.filter((e) => e.type === eqA.type && e.codeParking !== eqA.codeParking) : equipments;

  return (
    <div>
      <PageHeader title="Analyses" subtitle={`${period.label} · graphiques par code parking`} />
      <FilterBar options={{ view: true, views: ["mois", "annee"], defaultView: "annee", sites: isSiteBound(user.role) ? undefined : sites, famille: true }} />

      <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">Classement par produit</h2>
      <div className="grid gap-4 xl:grid-cols-2">
        {perProduct.map(({ p, data }) => (
          <BarChartCard
            key={p.id}
            title={`${p.nom} — ${unit(p)} par matériel`}
            data={data}
            xKey="code"
            horizontal
            series={[{ key: "q", label: p.nom }]}
            unit={unit(p)}
          />
        ))}
      </div>

      <h2 className="mb-2 mt-6 text-sm font-bold uppercase tracking-wide text-muted">Évolution mensuelle d&apos;un matériel ({year})</h2>
      <div className="mb-2 flex flex-wrap gap-3">
        <ParamSelect name="materiel" label="Matériel" options={eqOptions} className="w-64" />
      </div>
      <LineChartCard
        title={`${choisi ?? "—"} — consommation par mois`}
        data={evolution}
        xKey="label"
        series={products.map((p) => ({ key: p.id, label: `${p.nom} (${unit(p)})` }))}
      />

      <h2 className="mb-2 mt-6 text-sm font-bold uppercase tracking-wide text-muted">Écart entre deux matériels de même type</h2>
      <div className="mb-2 flex flex-wrap gap-3">
        <ParamSelect name="a" label="Matériel A" options={eqOptions} placeholder="— Choisir —" className="w-64" />
        <ParamSelect
          name="b"
          label="Matériel B (même type)"
          options={sameTypeOptions.map((e) => ({ value: e.codeParking, label: `${e.codeParking} — ${e.type}` }))}
          placeholder="— Choisir —"
          className="w-64"
        />
      </div>
      {eqA && eqB && eqA.type !== eqB.type && <Notice tone="bad">Les deux matériels ne sont pas du même type ({eqA.type} / {eqB.type}).</Notice>}
      {ecart ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <BarChartCard
            title={`${eqA!.codeParking} vs ${eqB!.codeParking}`}
            data={ecart}
            xKey="produit"
            series={[
              { key: "A", label: eqA!.codeParking },
              { key: "B", label: eqB!.codeParking },
            ]}
          />
          <div className="card overflow-x-auto">
            <h2 className="card-title">Écarts</h2>
            <table className="table">
              <thead>
                <tr>
                  <th>Produit</th>
                  <th className="num">{eqA!.codeParking}</th>
                  <th className="num">{eqB!.codeParking}</th>
                  <th className="num">Écart</th>
                  <th className="num">Écart %</th>
                </tr>
              </thead>
              <tbody>
                {ecart.map((r) => {
                  const d = r.A - r.B;
                  const pct = r.B ? (d / r.B) * 100 : null;
                  return (
                    <tr key={r.produit}>
                      <td>{r.produit}</td>
                      <td className="num">{fmtQty(r.A)}</td>
                      <td className="num">{fmtQty(r.B)}</td>
                      <td className={`num font-semibold ${d > 0 ? "text-bad" : d < 0 ? "text-ok" : ""}`}>{d > 0 ? "+" : ""}{fmtQty(d)}</td>
                      <td className="num">{pct === null ? "—" : `${pct > 0 ? "+" : ""}${fmtInt(pct)} %`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted">Choisissez deux matériels pour comparer leurs consommations sur la période.</p>
      )}

      <h2 className="mb-2 mt-6 text-sm font-bold uppercase tracking-wide text-muted">Consommation moyenne et coûts</h2>
      <div className="grid gap-4 xl:grid-cols-2">
        <BarChartCard
          title="Consommation moyenne par matériel — famille D vs E"
          data={moyenneFamille}
          xKey="produit"
          series={[
            { key: "D", label: `Camions D (${countByFam.D})` },
            { key: "E", label: `Engins E (${countByFam.E})` },
          ]}
        />
        <BarChartCard title="Coût de maintenance par site" data={costSiteData} xKey="site" series={[{ key: "cout", label: "Coût" }]} unit="MAD" />
      </div>
      <div className="mt-4">
        <BarChartCard
          title="Coût de maintenance par matériel (opérations + lubrifiant)"
          data={costEqData}
          xKey="code"
          horizontal
          series={[{ key: "cout", label: "Coût", color: "#1C2430" }]}
          unit="MAD"
        />
      </div>

      <h2 className="mb-2 mt-6 text-sm font-bold uppercase tracking-wide text-muted">Matériels hors norme</h2>
      <div className="card overflow-x-auto p-0">
        <p className="px-4 pt-3 text-xs text-muted">
          Consommation supérieure de plus de {settings.hors_norme_pct} % à la moyenne des matériels du même type, sur la période.
        </p>
        {hn.length === 0 ? (
          <p className="p-4 text-sm text-muted">Aucun matériel hors norme.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Code parking</th>
                <th>Type</th>
                <th>Produit</th>
                <th className="num">Consommation</th>
                <th className="num">Moyenne du type</th>
                <th className="num">Écart</th>
              </tr>
            </thead>
            <tbody>
              {hn.map((h) => (
                <tr key={h.codeParking + h.produitNom}>
                  <td>
                    <Link href={`/materiel/${h.codeParking}`} className="font-bold text-accent-dark hover:underline">{h.codeParking}</Link>
                  </td>
                  <td>{h.type}</td>
                  <td>{h.produitNom}</td>
                  <td className="num">{fmtQty(h.valeur)} {h.unite === "KG" ? "kg" : "L"}</td>
                  <td className="num">{fmtQty(h.moyenne)} {h.unite === "KG" ? "kg" : "L"}</td>
                  <td className="num font-bold text-bad">+{fmtInt(h.ecartPct)} %</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
