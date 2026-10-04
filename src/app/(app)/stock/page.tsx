import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canWrite, isSiteBound, siteScope } from "@/lib/permissions";
import { addMonths, buildPeriod, parseMonth, startOfMonth, toDateTimeInput, toMonthInput } from "@/lib/dates";
import { str, type SearchParams } from "@/lib/params";
import { currentMovement, stockBalances } from "@/lib/stock";
import { fmtDateTime, fmtQty, toNum } from "@/lib/format";
import { OPERATION_LABEL } from "@/lib/labels";
import { FilterBar } from "@/components/filter-bar";
import { EntreeForm } from "@/components/forms/entree-form";
import { InventaireRow } from "@/components/forms/inventaire-row";
import { Empty, Notice, PageHeader } from "@/components/ui";
import { ProduitSensClient } from "./produit-sens";

const TABS = [
  { k: "soldes", l: "Soldes" },
  { k: "entrees", l: "Entrées" },
  { k: "sorties", l: "Sorties" },
  { k: "inventaire", l: "Inventaire mensuel" },
  { k: "mouvements", l: "Historique des mouvements" },
] as const;

export default async function StockPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const sp = await searchParams;
  const tab = TABS.find((t) => t.k === str(sp.onglet))?.k ?? "soldes";
  const siteId = siteScope(user, str(sp.site));
  const bound = isSiteBound(user.role);

  const [allSites, products] = await Promise.all([
    prisma.site.findMany({ orderBy: { nom: "asc" } }),
    prisma.lubricant.findMany({ orderBy: { ordre: "asc" } }),
  ]);
  const sites = allSites.filter((s) => !siteId || s.id === siteId);
  const writableSites = bound ? allSites.filter((s) => s.id === user.siteId) : allSites;
  const u = (unite: string) => (unite === "KG" ? "kg" : "L");

  const tabLink = (k: string) => {
    const p = new URLSearchParams();
    if (str(sp.site)) p.set("site", str(sp.site)!);
    p.set("onglet", k);
    return `/stock?${p}`;
  };

  let body: React.ReactNode = null;

  if (tab === "soldes") {
    const balances = await stockBalances({ siteId });
    body = (
      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead>
            <tr>
              <th>Site</th>
              {products.map((p) => (
                <th key={p.id} className="num">{p.nom} ({u(p.unite)})</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sites.map((s) => (
              <tr key={s.id}>
                <td className="font-semibold">{s.nom}</td>
                {products.map((p) => {
                  const solde = balances.find((b) => b.siteId === s.id && b.produitId === p.id)?.solde ?? 0;
                  const alert = solde < toNum(p.seuilAlerte);
                  return (
                    <td key={p.id} className={`num ${alert ? "bg-bad/5 font-bold text-bad" : ""}`}>
                      {fmtQty(solde)}
                      {alert && <span className="ml-1 text-xs">⚠</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
            {sites.length > 1 && (
              <tr className="border-t-2 border-ink font-bold">
                <td>Total</td>
                {products.map((p) => (
                  <td key={p.id} className="num">
                    {fmtQty(balances.filter((b) => b.produitId === p.id).reduce((a, b) => a + b.solde, 0))}
                  </td>
                ))}
              </tr>
            )}
            <tr className="text-xs text-muted">
              <td>Seuil d&apos;alerte (par site)</td>
              {products.map((p) => (
                <td key={p.id} className="num">{fmtQty(p.seuilAlerte)}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  if (tab === "entrees" || tab === "sorties" || tab === "mouvements") {
    const period = buildPeriod(str(sp.vue), str(sp.ref));
    const sens = tab === "entrees" ? "ENTREE" : tab === "sorties" ? "SORTIE" : str(sp.sens) === "ENTREE" || str(sp.sens) === "SORTIE" ? (str(sp.sens) as "ENTREE" | "SORTIE") : undefined;
    const produitId = str(sp.produit);
    const where: Prisma.StockMovementWhereInput = {
      date: { gte: period.start, lt: period.end },
      ...(siteId ? { siteId } : {}),
      ...(sens ? { sens } : {}),
      ...(produitId ? { produitId } : {}),
      // Entrées/sorties tabs show the movements in force; the history tab shows everything.
      ...(tab === "mouvements" ? {} : currentMovement),
    };
    const movements = await prisma.stockMovement.findMany({
      where,
      include: {
        produit: true,
        site: true,
        agent: { select: { nom: true } },
        operation: { select: { id: true, type: true, correctedBy: { select: { id: true } } } },
        correctedBy: { select: { id: true } },
      },
      orderBy: { date: "desc" },
      take: 1000,
    });

    let correction: React.ComponentProps<typeof EntreeForm>["correction"];
    const corrigerId = str(sp.corriger);
    if (tab === "entrees" && corrigerId) {
      const m = await prisma.stockMovement.findUnique({ where: { id: corrigerId }, include: { produit: true } });
      if (m && m.sens === "ENTREE" && (!bound || m.siteId === user.siteId)) {
        correction = {
          id: m.id,
          label: `${m.produit.nom} ${fmtQty(m.quantite)} du ${fmtDateTime(m.date)}`,
          produitId: m.produitId,
          quantite: String(m.quantite),
          fournisseur: m.fournisseur ?? "",
          bonLivraison: m.bonLivraison ?? "",
          siteId: m.siteId,
          date: toDateTimeInput(m.date),
        };
      }
    }

    const exportQs = new URLSearchParams();
    for (const k of ["vue", "ref", "site", "produit", "sens"]) if (str(sp[k])) exportQs.set(k, str(sp[k])!);
    if (tab !== "mouvements" && sens) exportQs.set("sens", sens);

    body = (
      <>
        {tab === "entrees" && canWrite(user) && (
          <div className="card mb-4">
            <h2 className="card-title">{correction ? "Corriger une entrée" : "Nouvelle entrée — bon de livraison"}</h2>
            <EntreeForm
              key={correction?.id ?? "new"}
              sites={writableSites}
              products={products.map((p) => ({ id: p.id, nom: p.nom, unite: p.unite }))}
              nowLocal={toDateTimeInput(new Date())}
              correction={correction}
            />
          </div>
        )}
        {tab === "sorties" && (
          <Notice>
            Une sortie de lubrifiant est toujours liée à une opération et à un code parking : elle se saisit depuis{" "}
            {canWrite(user) ? <Link href="/operations/nouvelle" className="font-semibold underline">la saisie opération</Link> : "la saisie opération"}.
          </Notice>
        )}
        <FilterBar options={{ view: true, sites: bound ? undefined : allSites }}>
          <ProduitSensClient products={products.map((p) => ({ id: p.id, nom: p.nom }))} showSens={tab === "mouvements"} produit={produitId} sens={str(sp.sens)} />
          <a href={`/api/export/mouvements?${exportQs}`} className="btn ml-auto">Exporter Excel</a>
        </FilterBar>
        <div className="card overflow-x-auto p-0">
          {movements.length === 0 ? (
            <Empty>Aucun mouvement sur la période.</Empty>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Sens</th>
                  <th>Produit</th>
                  <th className="num">Quantité</th>
                  <th>Site</th>
                  <th>Code parking / fournisseur</th>
                  <th>Opération</th>
                  <th>Saisi par</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => {
                  const replaced = Boolean(m.correctedBy) || Boolean(m.operation?.correctedBy);
                  return (
                    <tr key={m.id} className={replaced ? "text-muted line-through decoration-muted/60" : ""}>
                      <td className="whitespace-nowrap">{fmtDateTime(m.date)}</td>
                      <td>
                        <span className={`badge ${m.sens === "ENTREE" ? "bg-ok/10 text-ok" : "bg-accent-light text-accent-dark"}`}>
                          {m.sens === "ENTREE" ? "Entrée" : "Sortie"}
                        </span>
                      </td>
                      <td>{m.produit.nom}</td>
                      <td className="num">{m.sens === "SORTIE" ? "−" : "+"}{fmtQty(m.quantite)} {u(m.produit.unite)}</td>
                      <td>{m.site.nom}</td>
                      <td>
                        {m.codeParking ? (
                          <Link href={`/materiel/${m.codeParking}`} className="font-semibold text-accent-dark hover:underline">{m.codeParking}</Link>
                        ) : (
                          <>
                            {m.fournisseur}
                            {m.bonLivraison && <span className="text-xs text-muted"> · {m.bonLivraison}</span>}
                          </>
                        )}
                        {m.motifCorrection && <div className="text-xs text-muted">Correction : {m.motifCorrection}</div>}
                      </td>
                      <td>
                        {m.operation ? (
                          <Link href={`/operations/${m.operation.id}`} className="hover:underline">{OPERATION_LABEL[m.operation.type]}</Link>
                        ) : "—"}
                      </td>
                      <td>{m.agent.nom}</td>
                      <td>
                        {tab === "entrees" && m.sens === "ENTREE" && !m.correctedBy && canWrite(user) && (
                          <Link className="btn btn-sm" href={`${tabLink("entrees")}&corriger=${m.id}`}>Corriger</Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </>
    );
  }

  if (tab === "inventaire") {
    const mois = parseMonth(str(sp.mois)) ?? startOfMonth(new Date());
    const invSiteId = siteId ?? str(sp.site) ?? (bound ? user.siteId ?? undefined : allSites[0]?.id);
    const invSite = allSites.find((s) => s.id === invSiteId);
    const end = addMonths(mois, 1);
    const before = end < new Date() ? end : new Date();
    const [balances, inventories] = await Promise.all([
      stockBalances({ siteId: invSiteId, before }),
      prisma.inventory.findMany({
        where: { siteId: invSiteId, mois },
        include: { agent: { select: { nom: true } } },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    const readOnly = !canWrite(user) || (bound && invSiteId !== user.siteId);
    body = (
      <>
        <form method="get" className="mb-4 flex flex-wrap items-end gap-3 rounded border border-line bg-slate-50 p-3">
          <input type="hidden" name="onglet" value="inventaire" />
          <div>
            <label className="label" htmlFor="i-mois">Mois</label>
            <input id="i-mois" name="mois" type="month" defaultValue={toMonthInput(mois)} className="input w-44" />
          </div>
          {!bound && (
            <div>
              <label className="label" htmlFor="i-site">Site</label>
              <select id="i-site" name="site" defaultValue={invSiteId} className="input w-52">
                {allSites.map((s) => (
                  <option key={s.id} value={s.id}>{s.nom}</option>
                ))}
              </select>
            </div>
          )}
          <button className="btn">Afficher</button>
        </form>
        <div className="card overflow-x-auto p-0">
          <h2 className="card-title px-4 pt-4">
            Inventaire {mois.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })} — {invSite?.nom}
          </h2>
          <p className="px-4 pb-2 text-xs text-muted">
            Solde théorique calculé au {fmtDateTime(before)}. Justification obligatoire si l&apos;écart n&apos;est pas nul.
            Chaque saisie est conservée ; la plus récente fait foi.
          </p>
          <table className="table">
            <thead>
              <tr>
                <th>Produit</th>
                <th className="num">Théorique</th>
                <th>Dernier inventaire</th>
                <th>Saisie (quantité réelle · écart · justification)</th>
              </tr>
            </thead>
            <tbody>
              {invSiteId &&
                products.map((p) => {
                  const last = inventories.find((i) => i.produitId === p.id);
                  return (
                    <InventaireRow
                      key={p.id}
                      siteId={invSiteId}
                      mois={toMonthInput(mois)}
                      produit={{ id: p.id, nom: p.nom, unite: p.unite }}
                      theorique={Math.round((balances.find((b) => b.produitId === p.id)?.solde ?? 0) * 100) / 100}
                      last={
                        last && {
                          physique: toNum(last.quantitePhysique),
                          ecart: toNum(last.ecart),
                          justification: last.justification,
                          par: last.agent.nom,
                          le: fmtDateTime(last.createdAt),
                        }
                      }
                      readOnly={readOnly}
                    />
                  );
                })}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  return (
    <div>
      <PageHeader title="Stock lubrifiants" subtitle={siteId ? sites[0]?.nom : "Tous les sites"} />
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <Link
            key={t.k}
            href={tabLink(t.k)}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold ${
              tab === t.k ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.l}
          </Link>
        ))}
      </div>
      {tab === "soldes" && !bound && <FilterBar options={{ sites: allSites }} />}
      {body}
    </div>
  );
}
