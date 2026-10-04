import type { OperationType, Role, Famille } from "@prisma/client";

export const OPERATION_TYPES: OperationType[] = ["VIDANGE", "REPARATION", "SOUFFLAGE", "GRAISSAGE", "LAVAGE"];

export const OPERATION_LABEL: Record<OperationType, string> = {
  VIDANGE: "Vidange",
  REPARATION: "Réparation",
  SOUFFLAGE: "Soufflage",
  GRAISSAGE: "Graissage",
  LAVAGE: "Lavage",
};

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Administrateur",
  AGENT: "Agent",
  CHEF_SITE: "Chef de site",
  DIRECTION: "Direction",
};

export const FAMILLE_LABEL: Record<Famille, string> = {
  D: "Camions (D)",
  E: "Engins (E)",
};

export const UNITE_COMPTEUR_LABEL = { KM: "km", H: "h" } as const;
export const UNITE_LABEL = { L: "L", KG: "kg" } as const;
