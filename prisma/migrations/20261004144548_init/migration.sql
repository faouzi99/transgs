-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'AGENT', 'CHEF_SITE', 'DIRECTION');

-- CreateEnum
CREATE TYPE "Famille" AS ENUM ('D', 'E');

-- CreateEnum
CREATE TYPE "UniteCompteur" AS ENUM ('KM', 'H');

-- CreateEnum
CREATE TYPE "OperationType" AS ENUM ('VIDANGE', 'REPARATION', 'SOUFFLAGE', 'GRAISSAGE', 'LAVAGE');

-- CreateEnum
CREATE TYPE "Unite" AS ENUM ('L', 'KG');

-- CreateEnum
CREATE TYPE "Sens" AS ENUM ('ENTREE', 'SORTIE');

-- CreateEnum
CREATE TYPE "ReportKind" AS ENUM ('OPERATION', 'SUIVI', 'CONSOMMATION');

-- CreateEnum
CREATE TYPE "ReportPeriod" AS ENUM ('JOUR', 'MOIS', 'ANNEE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "siteId" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Site" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "responsable" TEXT,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipment" (
    "codeParking" TEXT NOT NULL,
    "famille" "Famille" NOT NULL,
    "marque" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "immatriculation" TEXT,
    "annee" INTEGER,
    "siteId" TEXT NOT NULL,
    "compteurActuel" INTEGER NOT NULL DEFAULT 0,
    "uniteCompteur" "UniteCompteur" NOT NULL,
    "prochaineEcheance" INTEGER,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("codeParking")
);

-- CreateTable
CREATE TABLE "Operation" (
    "id" TEXT NOT NULL,
    "codeParking" TEXT NOT NULL,
    "type" "OperationType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "agentId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "compteur" INTEGER NOT NULL,
    "observation" TEXT,
    "cout" DECIMAL(12,2),
    "valideeParId" TEXT,
    "valideeLe" TIMESTAMP(3),
    "produitId" TEXT,
    "quantite" DECIMAL(10,2),
    "filtreChange" BOOLEAN,
    "prochaineEcheance" INTEGER,
    "panne" TEXT,
    "pieces" TEXT,
    "fournisseur" TEXT,
    "dureeImmobilisationJours" INTEGER,
    "coutPieces" DECIMAL(12,2),
    "coutMainOeuvre" DECIMAL(12,2),
    "correctionOfId" TEXT,
    "motifCorrection" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Operation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lubricant" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "unite" "Unite" NOT NULL,
    "seuilAlerte" DECIMAL(10,2) NOT NULL,
    "prixUnitaire" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "ordre" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Lubricant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "produitId" TEXT NOT NULL,
    "sens" "Sens" NOT NULL,
    "quantite" DECIMAL(10,2) NOT NULL,
    "siteId" TEXT NOT NULL,
    "codeParking" TEXT,
    "fournisseur" TEXT,
    "bonLivraison" TEXT,
    "operationId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "agentId" TEXT NOT NULL,
    "correctionOfId" TEXT,
    "motifCorrection" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inventory" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "produitId" TEXT NOT NULL,
    "mois" DATE NOT NULL,
    "quantitePhysique" DECIMAL(10,2) NOT NULL,
    "quantiteTheorique" DECIMAL(10,2) NOT NULL,
    "ecart" DECIMAL(10,2) NOT NULL,
    "justification" TEXT,
    "agentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "kind" "ReportKind" NOT NULL,
    "operationType" "OperationType",
    "period" "ReportPeriod" NOT NULL,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3) NOT NULL,
    "siteId" TEXT,
    "titre" TEXT NOT NULL,
    "pdf" BYTEA NOT NULL,
    "xlsx" BYTEA,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "data" JSONB,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Site_nom_key" ON "Site"("nom");

-- CreateIndex
CREATE INDEX "Equipment_siteId_idx" ON "Equipment"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "Operation_correctionOfId_key" ON "Operation"("correctionOfId");

-- CreateIndex
CREATE INDEX "Operation_siteId_date_idx" ON "Operation"("siteId", "date");

-- CreateIndex
CREATE INDEX "Operation_codeParking_date_idx" ON "Operation"("codeParking", "date");

-- CreateIndex
CREATE INDEX "Operation_type_date_idx" ON "Operation"("type", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Lubricant_nom_key" ON "Lubricant"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_correctionOfId_key" ON "StockMovement"("correctionOfId");

-- CreateIndex
CREATE INDEX "StockMovement_siteId_produitId_date_idx" ON "StockMovement"("siteId", "produitId", "date");

-- CreateIndex
CREATE INDEX "StockMovement_codeParking_date_idx" ON "StockMovement"("codeParking", "date");

-- CreateIndex
CREATE INDEX "StockMovement_operationId_idx" ON "StockMovement"("operationId");

-- CreateIndex
CREATE INDEX "Inventory_siteId_produitId_mois_idx" ON "Inventory"("siteId", "produitId", "mois");

-- CreateIndex
CREATE INDEX "Report_createdAt_idx" ON "Report"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_codeParking_fkey" FOREIGN KEY ("codeParking") REFERENCES "Equipment"("codeParking") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_valideeParId_fkey" FOREIGN KEY ("valideeParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Lubricant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_correctionOfId_fkey" FOREIGN KEY ("correctionOfId") REFERENCES "Operation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Lubricant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_codeParking_fkey" FOREIGN KEY ("codeParking") REFERENCES "Equipment"("codeParking") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "Operation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_correctionOfId_fkey" FOREIGN KEY ("correctionOfId") REFERENCES "StockMovement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Lubricant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
