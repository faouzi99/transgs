# Projet : application web TRANSWIN — suivi maintenance, engins et lubrifiants

Construis une application web complète (full-stack) pour la société TRANSWIN.
Langue de l'interface : français. Code et commentaires en anglais.

## Stack demandée
- Next.js (App Router) + TypeScript + Tailwind CSS
- Base de données PostgreSQL via Prisma
- Auth : email + mot de passe (NextAuth credentials ou équivalent), sessions httpOnly
- Graphiques : Recharts
- Génération PDF côté serveur : @react-pdf/renderer ou Playwright
- Export Excel : xlsx

## Contexte métier
5 sites : MEA, BNI AMIR, SIDI CHENNAN, DAOUI, ATELIER OULAD AZZOUZ.
Le parc est identifié par un **code parking**, identifiant unique de chaque matériel :
- Préfixe **D** = camions (MAN, RENAULT) — compteur en **kilomètres**
- Préfixe **E** = engins (CATERPILLAR, SEM, HYUNDAI) — compteur en **heures de marche**

Opérations suivies : **vidange, réparation, soufflage, graissage, lavage**.
Lubrifiants : **huile 15W40 (L), huile hydraulique 68 (L), antigel (L), graisse (kg)**.

## Accès et rôles (règle stricte)
- **Aucune inscription libre.** Seul le rôle ADMIN crée un compte, attribue le site et le rôle, et peut désactiver un utilisateur qui quitte le poste.
- Rôles :
  - `ADMIN` — tout, plus l'écran Administration (comptes, rôles, référentiels, seuils)
  - `AGENT` — saisit opérations et sorties de lubrifiant **de son site uniquement** ; ne peut pas modifier une saisie validée
  - `CHEF_SITE` — valide les saisies de son site, consulte tout l'historique du site
  - `DIRECTION` — lecture seule, tous les sites, tableaux de bord
- Cloisonnement par site appliqué côté serveur (pas seulement dans l'UI), sauf DIRECTION et ADMIN.
- Chaque écriture est horodatée et signée par son auteur. **Rien ne s'efface** : une correction crée une nouvelle écriture, l'ancienne reste visible dans l'historique.

## Modèle de données (Prisma)
- `User` : id, nom, email, hash, role, siteId, actif, createdById, createdAt
- `Site` : id, nom, responsable
- `Equipment` : codeParking (unique), famille (D|E), marque, type, immatriculation, annee, siteId, compteurActuel, uniteCompteur (KM|H)
- `Operation` : id, codeParking, type (VIDANGE|REPARATION|SOUFFLAGE|GRAISSAGE|LAVAGE), date, agentId, siteId, compteur, observation, cout, valideePar, valideeLe
  - champs spécifiques vidange : produitId, quantite, filtreChange (bool), prochaineEcheance
  - champs spécifiques réparation : panne, pieces, fournisseur, dureeImmobilisationJours
- `Lubricant` : id, nom, unite (L|KG), seuilAlerte
- `StockMovement` : id, produitId, sens (ENTREE|SORTIE), quantite, siteId, codeParking (null si ENTREE), fournisseur, operationId, date, agentId
- `Inventory` : id, siteId, produitId, mois, quantitePhysique, quantiteTheorique, ecart, justification

Clé de liaison : `codeParking` relie Equipment, Operation et StockMovement.

## Règles métier obligatoires
1. Une **SORTIE** de lubrifiant est toujours liée à une opération **et** à un code parking. Jamais de sortie libre.
2. Une **vidange** enregistrée décrémente automatiquement le stock du produit choisi et recalcule `prochaineEcheance` du matériel (périodicité paramétrable par famille D/E).
3. Solde de stock calculé en temps réel par produit et par site ; alerte dès que le solde passe sous `seuilAlerte`.
4. Inventaire physique mensuel : saisie de la quantité réelle, affichage de l'écart avec le solde théorique, justification obligatoire si écart ≠ 0.
5. Détection **matériel hors norme** : consommation d'un matériel qui s'écarte significativement de la moyenne des matériels du même type → remonte en alerte sur le tableau de bord.

## Écrans
1. **Connexion** — email + mot de passe. Message clair si compte désactivé.
2. **Tableau de bord** — KPI : opérations du jour, vidanges du mois, stock 15W40, matériels en alerte.
   Graphiques : colonnes « opérations enregistrées par mois », barres « huile 15W40 consommée par site ».
   Vues **jour / mois / année**. Filtres communs à tous les graphiques : période, site, famille D ou E, type d'opération.
   Vue année : évolution mensuelle des consommations, coût de maintenance par site et par matériel, classement des matériels les plus coûteux, comparaison camions D vs engins E.
3. **Recherche matériel** — champ de recherche par code parking. La fiche affiche : identité, compteur, historique daté des opérations, lubrifiants consommés (cumul mois et année), prochaine échéance de vidange, coûts (pièces, main-d'œuvre, lubrifiant). La recherche accepte aussi un site ou une famille et sort la liste exportable.
4. **Saisie opération** — formulaire unique dont les champs changent selon le type.
   Champs communs : code parking, site, date et heure, agent, compteur, observation.
5. **Stock lubrifiants** — entrées (bon de livraison : produit, quantité, fournisseur, site), sorties, soldes par produit et par site, seuils d'alerte, inventaire mensuel, historique des mouvements filtrable.
6. **Suivi soufflage / graissage / lavage** — tableau avec une ligne par code parking et trois colonnes **Soufflage | Graissage | Lavage** en **Oui / Non** (Oui en vert, Non en rouge) sur la période choisie.
   Sélecteur de période : bascule **Jour / Mois**, champ date ou mois, champ site, bouton **Télécharger le PDF**.
   « Non » = matériel à traiter, remonté en tête du rapport.
7. **Analyses** — graphiques par code parking :
   - un classement par **produit séparé** (huile 15W40 en L, hydraulique 68 en L, antigel en L, graisse en kg), chacun son propre graphique à barres
   - évolution mensuelle d'un matériel choisi (courbe)
   - écart entre deux matériels de même type
   - consommation moyenne par famille D et E
   - coût de maintenance par matériel et par site
   - matériels hors norme
8. **Rapports** — rapport **PDF mensuel ou journalier par opération**, plus export Excel du même contenu.
   Le PDF contient : en-tête (opération, site, période), tableau des matériels traités avec date / agent / compteur, total de la période, liste des matériels non traités, pied de page (site, période, date d'édition, auteur du rapport). Les rapports générés sont archivés et reconsultables sans régénération.
9. **Tableau de consommation mensuelle** — 12 mois en lignes, un lubrifiant par colonne, chaque valeur avec son unité (L ou kg), ligne **Total** de l'année. Filtrable par site, exportable en PDF et Excel.
10. **Administration** (ADMIN seulement) — comptes et rôles, sites, référentiel matériel avec codes parking, lubrifiants et seuils d'alerte, périodicités de vidange.

## Qualité attendue
- Interface sobre et dense, lisible sur écran d'atelier : fond blanc, texte bleu nuit `#1C2430`, accent orange `#E08A1E`, gris `#5A6676`.
- Responsive, utilisable sur tablette.
- Validation des formulaires côté client et serveur (zod).
- Seed de démonstration : 5 sites, 4 lubrifiants, ~15 matériels (D et E), 3 mois d'opérations et de mouvements de stock, un compte de chaque rôle.
- README : installation, variables d'environnement, lancement, comptes de démonstration.
