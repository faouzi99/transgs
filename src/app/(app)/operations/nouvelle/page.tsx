import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isSiteBound } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";
import { toDateTimeInput } from "@/lib/dates";
import { str, type SearchParams } from "@/lib/params";
import { OPERATION_LABEL } from "@/lib/labels";
import { fmtDateTime } from "@/lib/format";
import { OperationForm } from "@/components/forms/operation-form";
import { Notice, PageHeader } from "@/components/ui";

export default async function NouvelleOperationPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser(["ADMIN", "AGENT", "CHEF_SITE"]);
  const sp = await searchParams;
  const bound = isSiteBound(user.role);
  const siteFilter = bound ? { id: user.siteId ?? "__none__" } : {};

  const [sites, products, equipments, settings] = await Promise.all([
    prisma.site.findMany({ where: siteFilter, orderBy: { nom: "asc" } }),
    prisma.lubricant.findMany({ orderBy: { ordre: "asc" } }),
    prisma.equipment.findMany({
      where: { actif: true, ...(bound ? { siteId: user.siteId ?? "__none__" } : {}) },
      include: { site: true },
      orderBy: { codeParking: "asc" },
    }),
    getSettings(),
  ]);

  // Correction mode: prefill from the operation being corrected.
  let initial: Record<string, string> | undefined;
  let correctionOf: { id: string; label: string } | undefined;
  const corrigerId = str(sp.corriger);
  if (corrigerId) {
    const o = await prisma.operation.findUnique({ where: { id: corrigerId }, include: { correctedBy: true } });
    if (!o) return <Notice tone="bad">Opération introuvable.</Notice>;
    if (o.correctedBy) return <Notice tone="bad">Cette opération a déjà été corrigée : corrigez la dernière version.</Notice>;
    if (bound && o.siteId !== user.siteId) return <Notice tone="bad">Opération d&apos;un autre site.</Notice>;
    if (user.role === "AGENT" && o.valideeLe) {
      return <Notice tone="bad">Cette saisie est validée : seul le chef de site peut la corriger.</Notice>;
    }
    const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
    initial = {
      type: o.type,
      codeParking: o.codeParking,
      siteId: o.siteId,
      date: toDateTimeInput(o.date),
      compteur: s(o.compteur),
      observation: s(o.observation),
      cout: o.type === "REPARATION" ? "" : s(o.cout),
      produitId: s(o.produitId),
      quantite: s(o.quantite),
      filtreChange: s(o.filtreChange ?? true),
      panne: s(o.panne),
      pieces: s(o.pieces),
      fournisseur: s(o.fournisseur),
      dureeImmobilisationJours: s(o.dureeImmobilisationJours),
      coutPieces: s(o.coutPieces),
      coutMainOeuvre: s(o.coutMainOeuvre),
    };
    // Lubricant used outside a vidange is stored as a stock movement only.
    if (!o.produitId) {
      const m = await prisma.stockMovement.findFirst({ where: { operationId: o.id } });
      if (m) {
        initial.produitId = m.produitId;
        initial.quantite = s(m.quantite);
      }
    }
    correctionOf = { id: o.id, label: `${OPERATION_LABEL[o.type]} ${o.codeParking} du ${fmtDateTime(o.date)}` };
  } else if (str(sp.code)) {
    initial = { codeParking: str(sp.code)! };
    const eq = equipments.find((e) => e.codeParking === initial!.codeParking);
    if (eq) initial.siteId = eq.siteId;
  }

  return (
    <div className="max-w-5xl">
      <PageHeader
        title={correctionOf ? "Corriger une opération" : "Saisie opération"}
        subtitle={bound ? `Site ${user.siteNom}` : undefined}
      />
      {bound && !user.siteId && <Notice tone="bad">Aucun site attribué à votre compte. Contactez l&apos;administrateur.</Notice>}
      <div className="card">
        <OperationForm
          agentNom={user.nom}
          sites={sites}
          products={products.map((p) => ({ id: p.id, nom: p.nom, unite: p.unite }))}
          equipments={equipments.map((e) => ({
            codeParking: e.codeParking,
            siteId: e.siteId,
            famille: e.famille,
            uniteCompteur: e.uniteCompteur,
            compteurActuel: e.compteurActuel,
            label: `${e.marque} ${e.type} · ${e.site.nom}`,
          }))}
          periodicite={{ D: settings.periodicite_D, E: settings.periodicite_E }}
          defaultSiteId={bound ? user.siteId ?? undefined : undefined}
          nowLocal={toDateTimeInput(new Date())}
          initial={initial}
          correctionOf={correctionOf}
        />
      </div>
    </div>
  );
}
