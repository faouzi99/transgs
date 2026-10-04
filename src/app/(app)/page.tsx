import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isSiteBound, siteScope } from "@/lib/permissions";
import { buildPeriod, startOfDay, startOfMonth, addMonths } from "@/lib/dates";
import { parseFamille, parseType, str, type SearchParams } from "@/lib/params";
import { buckets, horsNorme, loadOperations, loadSorties, totalCost, vidangesEchues } from "@/lib/stats";
import { stockAlerts, stockBalances } from "@/lib/stock";
import { fmtInt, fmtMoney, fmtQty, toNum } from "@/lib/format";
import { FilterBar } from "@/components/filter-bar";
import { BarChartCard, LineChartCard } from "@/components/charts";
import { Kpi, Notice, PageHeader } from "@/components/ui";

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const sp = await searchParams;
  const period = buildPeriod(str(sp.vue), str(sp.ref));
  const siteId = siteScope(user, str(sp.site));
  const famille = parseFamille(str(sp.famille));
  const type = parseType(str(sp.type));
  const filters = { start: period.start, end: period.end, siteId, famille, type };

  const now = new Date();
  const [sites, products, ops, sorties, opsToday, vidangesMois, balances, alertesStock, hn, echues] = await Promise.all([
    prisma.site.findMany({ orderBy: { nom: "asc" } }),
    prisma.lubricant.findMany({ orderBy: { ordre: "asc" } }),
    loadOperations(filters),
    loadSorties(filters),
    prisma.operation.count({
      where: {
        correctedBy: { is: null },
        date: { gte: startOfDay(now), lt: new Date(startOfDay(now).getTime() + 86400000) },
        ...(siteId ? { siteId } : {}),
        ...(famille ? { equipment: { famille } } : {}),
        ...(type ? { type } : {}),
      },
    }),
    prisma.operation.count({
      where: {
        correctedBy: { is: null },
        type: "VIDANGE",
        date: { gte: startOfMonth(now), lt: addMonths(now, 1) },
        ...(siteId ? { siteId } : {}),
        ...(famille ? { equipment: { famille } } : {}),
      },
    }),
    stockBalances({ siteId }),
    stockAlerts(siteId),
    horsNorme({ start: new Date(now.getTime() - 90 * 86400000), end: now, siteId, famille }),
    vidangesEchues(siteId, famille),
  ]);

  const p15 = products.find((p) => p.nom.includes("15W40"));
  const stock15 = balances.filter((b) => b.produitId === p15?.id).reduce((s, b) => s + b.solde, 0);
  const materielsAlerte = new Set([...hn.map((h) => h.codeParking), ...echues.map((e) => e.codeParking)]);

  const bk = buckets(period.view, period.start);
  const opsSeries = bk.map((b) => ({ label: b.label, ops: ops.filter((o) => b.match(o.date)).length }));
  const siteName = new Map(sites.map((s) => [s.id, s.nom]));
  const visibleSites = sites.filter((s) => !siteId || s.id === siteId);
  const conso15BySite = visibleSites.map((s) => ({
    site: s.nom,
    q: sorties.filter((m) => m.siteId === s.id && m.produitId === p15?.id).reduce((a, m) => a + toNum(m.quantite), 0),
  }));

  const opsTitle = period.view === "annee" ? "Opérations enregistrées par mois" : period.view === "mois" ? "Opérations enregistrées par jour" : "Opérations enregistrées par heure";

  // Year view extras.
  let yearBlocks: React.ReactNode = null;
  if (period.view === "annee") {
    const monthly = bk.map((b) => {
      const row: Record<string, string | number> = { label: b.label };
      for (const p of products) {
        row[p.id] = sorties.filter((m) => m.produitId === p.id && b.match(m.date)).reduce((a, m) => a + toNum(m.quantite), 0);
      }
      return row;
    });
    const costBySite = visibleSites.map((s) => ({
      site: s.nom,
      cout: ops.filter((o) => o.siteId === s.id).reduce((a, o) => a + totalCost(o), 0),
    }));
    const costByEquipment = new Map<string, number>();
    for (const o of ops) costByEquipment.set(o.codeParking, (costByEquipment.get(o.codeParking) ?? 0) + totalCost(o));
    const top = [...costByEquipment.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([code, cout]) => ({ code, cout }));
    const fam = (f: "D" | "E") => {
      const o = ops.filter((x) => x.equipment.famille === f);
      const s = sorties.filter((x) => x.equipment?.famille === f);
      return {
        ops: o.length,
        cout: o.reduce((a, x) => a + totalCost(x), 0),
        conso: products.map((p) => ({ p, q: s.filter((x) => x.produitId === p.id).reduce((a, x) => a + toNum(x.quantite), 0) })),
      };
    };
    const famD = fam("D");
    const famE = fam("E");
    yearBlocks = (
      <>
        <h2 className="mb-2 mt-6 text-sm font-bold uppercase tracking-wide text-muted">Vue annuelle</h2>
        <div className="grid gap-4 xl:grid-cols-2">
          <LineChartCard
            title="Évolution mensuelle des consommations"
            data={monthly}
            xKey="label"
            series={products.map((p) => ({ key: p.id, label: `${p.nom} (${p.unite === "KG" ? "kg" : "L"})` }))}
          />
          <BarChartCard title="Coût de maintenance par site" data={costBySite} xKey="site" series={[{ key: "cout", label: "Coût" }]} unit="MAD" />
          <BarChartCard
            title="Matériels les plus coûteux (top 10)"
            data={top}
            xKey="code"
            horizontal
            series={[{ key: "cout", label: "Coût", color: "#1C2430" }]}
            unit="MAD"
          />
          <div className="card">
            <h2 className="card-title">Camions D vs engins E</h2>
            <table className="table">
              <thead>
                <tr>
                  <th></th>
                  <th className="num">Camions (D)</th>
                  <th className="num">Engins (E)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Opérations</td>
                  <td className="num">{fmtInt(famD.ops)}</td>
                  <td className="num">{fmtInt(famE.ops)}</td>
                </tr>
                <tr>
                  <td>Coût de maintenance</td>
                  <td className="num">{fmtMoney(famD.cout)}</td>
                  <td className="num">{fmtMoney(famE.cout)}</td>
                </tr>
                {products.map((p, i) => (
                  <tr key={p.id}>
                    <td>{p.nom}</td>
                    <td className="num">{fmtQty(famD.conso[i].q)} {p.unite === "KG" ? "kg" : "L"}</td>
                    <td className="num">{fmtQty(famE.conso[i].q)} {p.unite === "KG" ? "kg" : "L"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </>
    );
  }

  return (
    <div>
      <PageHeader
        title="Tableau de bord"
        subtitle={`${period.label}${siteId ? ` · ${siteName.get(siteId) ?? ""}` : " · Tous les sites"}`}
      />
      {sp.refus && <Notice tone="bad">Accès refusé : cette page est réservée à un autre rôle.</Notice>}
      <FilterBar options={{ view: true, sites: isSiteBound(user.role) ? undefined : sites, famille: true, type: true }} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Opérations du jour" value={fmtInt(opsToday)} href="/operations?vue=jour" />
        <Kpi label="Vidanges du mois" value={fmtInt(vidangesMois)} />
        <Kpi
          label="Stock huile 15W40"
          value={`${fmtQty(stock15)} L`}
          hint={siteId ? siteName.get(siteId) : "Tous sites"}
          tone={alertesStock.some((a) => a.produitId === p15?.id) ? "alert" : undefined}
          href="/stock"
        />
        <Kpi
          label="Matériels en alerte"
          value={fmtInt(materielsAlerte.size)}
          hint={`${hn.length} hors norme · ${echues.length} vidange(s) échue(s)`}
          tone={materielsAlerte.size ? "alert" : undefined}
          href="/analyses"
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <BarChartCard title={opsTitle} data={opsSeries} xKey="label" series={[{ key: "ops", label: "Opérations" }]} />
        <BarChartCard
          title="Huile 15W40 consommée par site"
          data={conso15BySite}
          xKey="site"
          horizontal
          series={[{ key: "q", label: "15W40", color: "#1C2430" }]}
          unit="L"
        />
      </div>

      {yearBlocks}

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="card">
          <h2 className="card-title">Alertes stock</h2>
          {alertesStock.length === 0 ? (
            <p className="text-sm text-muted">Aucun produit sous le seuil.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {alertesStock.map((a) => (
                <li key={a.siteId + a.produitId} className="flex justify-between gap-2">
                  <span>{a.produitNom} · {a.siteNom}</span>
                  <span className="font-semibold text-bad tabular-nums">
                    {fmtQty(a.solde)} / {fmtQty(a.seuil)} {a.unite === "KG" ? "kg" : "L"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card">
          <h2 className="card-title">Matériels hors norme (90 j)</h2>
          {hn.length === 0 ? (
            <p className="text-sm text-muted">Aucun écart significatif.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {hn.slice(0, 8).map((h) => (
                <li key={h.codeParking + h.produitNom} className="flex justify-between gap-2">
                  <Link href={`/materiel/${h.codeParking}`} className="font-semibold text-accent-dark hover:underline">
                    {h.codeParking}
                  </Link>
                  <span className="flex-1 truncate text-muted">{h.produitNom}</span>
                  <span className="font-semibold text-bad tabular-nums">+{fmtInt(h.ecartPct)} %</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card">
          <h2 className="card-title">Vidanges échues</h2>
          {echues.length === 0 ? (
            <p className="text-sm text-muted">Aucune vidange en retard.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {echues.map((e) => (
                <li key={e.codeParking} className="flex justify-between gap-2">
                  <Link href={`/materiel/${e.codeParking}`} className="font-semibold text-accent-dark hover:underline">
                    {e.codeParking}
                  </Link>
                  <span className="tabular-nums text-bad">
                    {fmtInt(e.compteurActuel)} / {fmtInt(e.prochaineEcheance)} {e.uniteCompteur === "KM" ? "km" : "h"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
