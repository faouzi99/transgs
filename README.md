# TRANSWIN — suivi maintenance, engins et lubrifiants

Application web full-stack pour suivre les opérations de maintenance (vidange, réparation, soufflage,
graissage, lavage), le parc (camions **D**, engins **E**) et le stock de lubrifiants des 5 sites TRANSWIN.

Interface en français, code en anglais. Stack : Next.js 15 (App Router) · TypeScript · Tailwind CSS ·
PostgreSQL + Prisma · Recharts · @react-pdf/renderer (PDF côté serveur) · xlsx (Excel) · zod.

## Installation

Prérequis : Node.js 20+ et PostgreSQL 14+.

```bash
npm install
cp .env.example .env        # puis adapter DATABASE_URL
npx prisma migrate deploy   # crée les tables
npm run db:seed             # données de démonstration
```

## Variables d'environnement

| Variable | Exemple | Rôle |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql://transwin:transwin@localhost:5432/transwin?schema=public` | Connexion PostgreSQL |
| `TZ` | `Africa/Casablanca` | Fuseau utilisé pour les bornes jour / mois des rapports et tableaux de bord. **À définir dans l'environnement du processus** (ex. `TZ=Africa/Casablanca npm start`). |
| `SESSION_TTL_HOURS` | `12` | Durée de validité d'une session |

## Lancement

```bash
npm run dev                                  # développement : http://localhost:3000
npm run build && TZ=Africa/Casablanca npm start   # production
```

Autres scripts : `npm run lint`, `npm run typecheck`, `npm run db:migrate` (nouvelle migration en dev),
`npm run db:reset` (réinitialise la base et relance le seed).

## Comptes de démonstration

Mot de passe commun : **`Transwin2026!`**

| Rôle | Email | Site |
| --- | --- | --- |
| ADMIN | `admin@transwin.ma` | tous |
| DIRECTION | `direction@transwin.ma` | tous (lecture seule) |
| CHEF_SITE | `chef.mea@transwin.ma` | MEA |
| AGENT | `agent.mea@transwin.ma` | MEA |
| Compte désactivé | `ancien.agent@transwin.ma` | montre le message « compte désactivé » |

Chaque site a aussi son chef et son agent : `chef.bni@`, `chef.sidi@`, `chef.daoui@`, `chef.atelier@`
et `agent.bni@`, `agent.sidi@`, `agent.daoui@`, `agent.atelier@` (`@transwin.ma`).

Le seed crée 5 sites, 4 lubrifiants, 15 matériels (7 camions D, 8 engins E) et 3 mois d'opérations et de
mouvements de stock. Il contient volontairement un stock sous le seuil (15W40 à l'atelier), un matériel
hors norme (E204, hydraulique et graisse) et une correction d'opération (D101).

## Règles appliquées

- **Pas d'inscription** : seul l'ADMIN crée les comptes, attribue rôle et site, désactive un compte.
  La désactivation coupe immédiatement toutes les sessions de l'utilisateur.
- **Cloisonnement par site côté serveur** : AGENT et CHEF_SITE ne lisent et n'écrivent que leur site
  (requêtes, exports, rapports archivés) ; DIRECTION lit tout sans écrire ; ADMIN a tout.
- **Rien ne s'efface** : une opération, une entrée de stock ou un inventaire n'est jamais modifié ni
  supprimé. Une correction crée une nouvelle écriture (`correctionOfId`) avec son motif ; l'ancienne reste
  visible, barrée, dans l'historique. Toutes les écritures portent leur auteur et leur horodatage.
  Les changements de référentiel faits par l'ADMIN sont tracés dans le journal (Administration → Journal).
- Un AGENT ne peut plus corriger une saisie validée ; le CHEF_SITE valide et peut corriger. Les saisies
  d'un CHEF_SITE ou d'un ADMIN sont validées d'office.
- **Sortie de lubrifiant** : toujours créée par une opération, donc liée à un code parking. Le stock
  disponible du site est vérifié avant l'enregistrement.
- **Vidange** : décrémente le stock du produit choisi et recalcule la prochaine échéance
  (`compteur + périodicité`, réglable par famille D/E dans Administration).
- **Solde** calculé en temps réel par produit et par site ; alerte sous le seuil.
- **Inventaire mensuel** : solde théorique recalculé côté serveur, écart affiché, justification obligatoire
  si l'écart n'est pas nul.
- **Hors norme** : un matériel dont la consommation d'un produit dépasse de plus de X % (50 % par défaut,
  réglable) la moyenne des matériels du même type sur la période.
- Les rapports générés (opération, suivi soufflage/graissage/lavage, consommation) sont archivés en base
  (PDF + Excel) et rouverts sans régénération depuis l'écran Rapports.

## Structure

```
prisma/schema.prisma      modèle de données
prisma/seed.ts            données de démonstration
src/lib/                  auth, permissions, règles métier (operations.ts, stock.ts), statistiques, PDF, Excel
src/app/(app)/            écrans (tableau de bord, matériel, opérations, stock, suivi, analyses, rapports, consommation, admin)
src/app/actions/          server actions (écritures)
src/app/api/              téléchargements PDF / Excel
```
