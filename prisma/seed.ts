// Demo data: 5 sites, 4 lubricants, 15 equipment, ~3 months of operations and stock movements,
// and one account per role. Run with `npm run db:seed` (idempotent: wipes business data first).
import { PrismaClient, Prisma, type OperationType, type Famille } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const DEMO_PASSWORD = "Transwin2026!";

// Deterministic PRNG so every seed gives the same data.
let rnd = 42;
const rand = () => {
  rnd = (rnd * 1664525 + 1013904223) % 4294967296;
  return rnd / 4294967296;
};
const between = (a: number, b: number) => a + rand() * (b - a);
const int = (a: number, b: number) => Math.round(between(a, b));
const D = (v: number) => new Prisma.Decimal(Math.round(v * 10) / 10);

const SITES = [
  { nom: "MEA", responsable: "Rachid El Amrani" },
  { nom: "BNI AMIR", responsable: "Youssef Bennani" },
  { nom: "SIDI CHENNAN", responsable: "Khalid Ouazzani" },
  { nom: "DAOUI", responsable: "Mohamed Tazi" },
  { nom: "ATELIER OULAD AZZOUZ", responsable: "Hassan Alaoui" },
];

const LUBRICANTS = [
  { nom: "Huile 15W40", unite: "L" as const, seuilAlerte: 150, prixUnitaire: 28, ordre: 1 },
  { nom: "Huile hydraulique 68", unite: "L" as const, seuilAlerte: 60, prixUnitaire: 25, ordre: 2 },
  { nom: "Antigel", unite: "L" as const, seuilAlerte: 15, prixUnitaire: 18, ordre: 3 },
  { nom: "Graisse", unite: "KG" as const, seuilAlerte: 20, prixUnitaire: 45, ordre: 4 },
];

const EQUIPMENT: { code: string; marque: string; type: string; site: string; immat?: string; annee: number }[] = [
  { code: "D101", marque: "MAN", type: "Camion benne", site: "MEA", immat: "12345-A-6", annee: 2019 },
  { code: "D102", marque: "MAN", type: "Camion benne", site: "BNI AMIR", immat: "23456-B-6", annee: 2020 },
  { code: "D103", marque: "RENAULT", type: "Camion benne", site: "SIDI CHENNAN", immat: "34567-A-6", annee: 2018 },
  { code: "D104", marque: "RENAULT", type: "Camion citerne", site: "DAOUI", immat: "45678-D-6", annee: 2017 },
  { code: "D105", marque: "MAN", type: "Tracteur routier", site: "ATELIER OULAD AZZOUZ", immat: "56789-A-6", annee: 2021 },
  { code: "D106", marque: "RENAULT", type: "Camion benne", site: "MEA", immat: "67890-B-6", annee: 2022 },
  { code: "D107", marque: "MAN", type: "Camion benne", site: "DAOUI", immat: "78901-A-6", annee: 2016 },
  { code: "E201", marque: "CATERPILLAR", type: "Pelle hydraulique", site: "MEA", annee: 2018 },
  { code: "E202", marque: "CATERPILLAR", type: "Chargeuse", site: "BNI AMIR", annee: 2019 },
  { code: "E203", marque: "SEM", type: "Chargeuse", site: "SIDI CHENNAN", annee: 2021 },
  { code: "E204", marque: "HYUNDAI", type: "Pelle hydraulique", site: "DAOUI", annee: 2017 },
  { code: "E205", marque: "CATERPILLAR", type: "Bulldozer", site: "MEA", annee: 2015 },
  { code: "E206", marque: "SEM", type: "Niveleuse", site: "ATELIER OULAD AZZOUZ", annee: 2020 },
  { code: "E207", marque: "HYUNDAI", type: "Chargeuse", site: "MEA", annee: 2022 },
  { code: "E208", marque: "CATERPILLAR", type: "Pelle hydraulique", site: "SIDI CHENNAN", annee: 2020 },
];

const PERIODICITE = { D: 10000, E: 250 };
const FOURNISSEURS = ["Petrom", "Total Energies Maroc", "Shell Vivo Lubricants", "Afriquia SMDC"];
const PANNES = [
  { panne: "Fuite flexible hydraulique", pieces: "Flexible HP 1/2\", raccords", fournisseur: "Hydro Atlas" },
  { panne: "Plaquettes de frein usées", pieces: "Jeu de plaquettes AV", fournisseur: "Auto Pièces Casa" },
  { panne: "Alternateur HS", pieces: "Alternateur 24V", fournisseur: "Electro Diesel" },
  { panne: "Surchauffe moteur", pieces: "Thermostat, durite", fournisseur: "Auto Pièces Casa" },
  { panne: "Dent de godet cassée", pieces: "Dents de godet x5", fournisseur: "Mine Equip" },
];

async function main() {
  // Wipe in dependency order.
  await prisma.auditLog.deleteMany();
  await prisma.report.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.stockMovement.updateMany({ data: { correctionOfId: null } });
  await prisma.stockMovement.deleteMany();
  await prisma.operation.updateMany({ data: { correctionOfId: null } });
  await prisma.operation.deleteMany();
  await prisma.equipment.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.updateMany({ data: { createdById: null } });
  await prisma.user.deleteMany();
  await prisma.lubricant.deleteMany();
  await prisma.site.deleteMany();
  await prisma.setting.deleteMany();

  await prisma.setting.createMany({
    data: [
      { key: "periodicite_D", value: String(PERIODICITE.D) },
      { key: "periodicite_E", value: String(PERIODICITE.E) },
      { key: "hors_norme_pct", value: "50" },
    ],
  });

  const sites = new Map<string, string>();
  for (const s of SITES) sites.set(s.nom, (await prisma.site.create({ data: s })).id);

  const lub = new Map<string, string>();
  for (const l of LUBRICANTS) {
    const row = await prisma.lubricant.create({
      data: { ...l, seuilAlerte: D(l.seuilAlerte), prixUnitaire: D(l.prixUnitaire) },
    });
    lub.set(l.nom, row.id);
  }
  const L15 = lub.get("Huile 15W40")!;
  const LHYD = lub.get("Huile hydraulique 68")!;
  const LANT = lub.get("Antigel")!;
  const LGR = lub.get("Graisse")!;

  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const admin = await prisma.user.create({
    data: { nom: "Administrateur TRANSWIN", email: "admin@transwin.ma", hash, role: "ADMIN" },
  });
  const mk = (nom: string, email: string, role: "AGENT" | "CHEF_SITE" | "DIRECTION", site?: string) =>
    prisma.user.create({
      data: { nom, email, hash, role, siteId: site ? sites.get(site) : null, createdById: admin.id },
    });
  await mk("Direction Générale", "direction@transwin.ma", "DIRECTION");
  const chefs = new Map<string, string>();
  const agents = new Map<string, string>();
  for (const s of SITES) {
    const slug = s.nom.split(" ")[0].toLowerCase();
    chefs.set(s.nom, (await mk(s.responsable, `chef.${slug}@transwin.ma`, "CHEF_SITE", s.nom)).id);
    agents.set(s.nom, (await mk(`Agent ${s.nom}`, `agent.${slug}@transwin.ma`, "AGENT", s.nom)).id);
  }
  // A former employee, deactivated: shows the "compte désactivé" message.
  await prisma.user.create({
    data: { nom: "Ancien Agent", email: "ancien.agent@transwin.ma", hash, role: "AGENT", siteId: sites.get("MEA"), actif: false, createdById: admin.id },
  });

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 2, 1); // 3 calendar months incl. current
  const days = Math.ceil((now.getTime() - start.getTime()) / 86400000);

  // Monthly deliveries per site (ATELIER gets less: shows a stock alert).
  for (let m = 0; m < 3; m++) {
    const d = new Date(start.getFullYear(), start.getMonth() + m, 2, 9, 0);
    if (d > now) continue;
    for (const s of SITES) {
      const factor = s.nom.startsWith("ATELIER") ? 0.5 : 1;
      for (const [produitId, q] of [[L15, 130], [LHYD, 100], [LANT, 20], [LGR, 40]] as const) {
        await prisma.stockMovement.create({
          data: {
            produitId,
            sens: "ENTREE",
            quantite: D(q * factor),
            siteId: sites.get(s.nom)!,
            fournisseur: FOURNISSEURS[int(0, FOURNISSEURS.length - 1)],
            bonLivraison: `BL-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}-${int(100, 999)}`,
            date: d,
            agentId: agents.get(s.nom)!,
          },
        });
      }
    }
  }

  const validationCutoff = new Date(now.getTime() - 5 * 86400000);

  for (const e of EQUIPMENT) {
    const famille = e.code[0] as Famille;
    const siteId = sites.get(e.site)!;
    const agentId = agents.get(e.site)!;
    const chefId = chefs.get(e.site)!;
    const unite = famille === "D" ? "KM" : "H";
    let compteur = famille === "D" ? int(80000, 320000) : int(4000, 14000);
    let echeance = compteur + int(PERIODICITE[famille] * 0.2, PERIODICITE[famille] * 0.9);

    await prisma.equipment.create({
      data: {
        codeParking: e.code,
        famille,
        marque: e.marque,
        type: e.type,
        immatriculation: e.immat ?? null,
        annee: e.annee,
        siteId,
        compteurActuel: compteur,
        uniteCompteur: unite,
        prochaineEcheance: echeance,
      },
    });

    const op = async (
      type: OperationType,
      date: Date,
      extra: Partial<Prisma.OperationUncheckedCreateInput> = {},
      sorties: [string, number][] = [],
    ) => {
      const validated = date < validationCutoff;
      const created = await prisma.operation.create({
        data: {
          codeParking: e.code,
          type,
          date,
          agentId,
          siteId,
          compteur,
          valideeParId: validated ? chefId : null,
          valideeLe: validated ? new Date(date.getTime() + 86400000) : null,
          ...extra,
        },
      });
      for (const [produitId, q] of sorties) {
        await prisma.stockMovement.create({
          data: { produitId, sens: "SORTIE", quantite: D(q), siteId, codeParking: e.code, operationId: created.id, date, agentId },
        });
      }
      return created;
    };

    for (let day = 0; day < days; day++) {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + day, int(7, 16), int(0, 59));
      if (date > now) break;
      if (date.getDay() === 0) continue; // Sunday off
      compteur += famille === "D" ? int(120, 320) : int(6, 11);

      if (compteur >= echeance) {
        const q = famille === "D" ? between(28, 38) : between(22, 32);
        const next = compteur + PERIODICITE[famille];
        await op(
          "VIDANGE",
          date,
          { produitId: L15, quantite: D(q), filtreChange: true, prochaineEcheance: next, cout: D(int(150, 300)), observation: "Vidange moteur + filtres" },
          [[L15, q]],
        );
        echeance = next;
        continue;
      }
      // Weekly greasing for machines (E204 consumes abnormally: shows "hors norme").
      if (famille === "E" && date.getDay() === 2) {
        const q = e.code === "E204" ? between(5, 7) : between(1.5, 3);
        await op("GRAISSAGE", date, { cout: D(50) }, [[LGR, q]]);
      }
      // Trucks are greased every two weeks.
      if (famille === "D" && day % 14 === 5) await op("GRAISSAGE", date, { cout: D(40) }, [[LGR, between(0.5, 1)]]);
      if (date.getDay() === 5 && rand() < 0.85) await op("LAVAGE", date, { cout: D(80) });
      if (day % 10 === 3 && rand() < 0.8) await op("SOUFFLAGE", date, { cout: D(40), observation: "Soufflage filtre à air" });
      if (rand() < 0.012) {
        const p = PANNES[int(0, PANNES.length - 1)];
        const coutPieces = int(400, 6000);
        const coutMainOeuvre = int(200, 1200);
        const sorties: [string, number][] = [];
        if (p.panne.includes("hydraulique")) sorties.push([LHYD, e.code === "E204" ? between(40, 60) : between(10, 20)]);
        if (p.panne.includes("Surchauffe")) sorties.push([LANT, between(8, 15)]);
        await op(
          "REPARATION",
          date,
          {
            panne: p.panne,
            pieces: p.pieces,
            fournisseur: p.fournisseur,
            dureeImmobilisationJours: int(0, 4),
            coutPieces: D(coutPieces),
            coutMainOeuvre: D(coutMainOeuvre),
            cout: D(coutPieces + coutMainOeuvre),
          },
          sorties,
        );
      }
      // Hydraulic top-ups on excavators.
      if (e.type === "Pelle hydraulique" && date.getDay() === 4) {
        const q = e.code === "E204" ? between(18, 25) : between(4, 8);
        await op("GRAISSAGE", date, { observation: "Graissage + appoint hydraulique", cout: D(50) }, [[LGR, between(1, 2)], [LHYD, q]]);
      }
    }
    await prisma.equipment.update({ where: { codeParking: e.code }, data: { compteurActuel: compteur, prochaineEcheance: echeance } });
  }

  // One correction example: the latest D101 lavage had a wrong counter.
  const toFix = await prisma.operation.findFirst({ where: { codeParking: "D101", type: "LAVAGE" }, orderBy: { date: "desc" } });
  if (toFix) {
    await prisma.operation.create({
      data: {
        codeParking: toFix.codeParking,
        type: toFix.type,
        date: toFix.date,
        agentId: chefs.get("MEA")!,
        siteId: toFix.siteId,
        compteur: toFix.compteur + 10,
        cout: toFix.cout,
        observation: "Lavage complet châssis",
        valideeParId: chefs.get("MEA")!,
        valideeLe: new Date(),
        correctionOfId: toFix.id,
        motifCorrection: "Compteur mal saisi",
      },
    });
  }

  console.log(`Seed OK. Demo password for every account: ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
