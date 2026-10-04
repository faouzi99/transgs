// Zod schemas shared by client forms and server actions. Inputs come from FormData,
// so every field arrives as a string and is coerced here.
import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .transform((v) => (v ? v : undefined));

const optionalNumber = z
  .union([z.literal(""), z.coerce.number().nonnegative("Valeur positive attendue")])
  .optional()
  .transform((v) => (v === "" || v === undefined ? undefined : v));

/** Required number: an empty field is an error, not 0. */
const requiredNumber = (message: string) =>
  z.preprocess((v) => (v === "" || v === null ? undefined : v), z.coerce.number({ required_error: message, invalid_type_error: message }));

const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.literal("false"), z.literal("")])
  .optional()
  .transform((v) => v === "on" || v === "true");

export const operationSchema = z
  .object({
    codeParking: z.string().trim().min(1, "Code parking obligatoire").toUpperCase(),
    type: z.enum(["VIDANGE", "REPARATION", "SOUFFLAGE", "GRAISSAGE", "LAVAGE"], {
      errorMap: () => ({ message: "Type d'opération obligatoire" }),
    }),
    siteId: z.string().min(1, "Site obligatoire"),
    date: z.string().min(1, "Date obligatoire").refine((s) => !Number.isNaN(Date.parse(s)), "Date invalide"),
    compteur: requiredNumber("Compteur obligatoire").pipe(z.number().int("Nombre entier").nonnegative("Valeur positive attendue")),
    observation: optionalText,
    cout: optionalNumber,
    produitId: optionalText,
    quantite: optionalNumber,
    filtreChange: checkbox,
    panne: optionalText,
    pieces: optionalText,
    fournisseur: optionalText,
    dureeImmobilisationJours: optionalNumber,
    coutPieces: optionalNumber,
    coutMainOeuvre: optionalNumber,
    correctionOfId: optionalText,
    motifCorrection: optionalText,
  })
  .superRefine((v, ctx) => {
    if (v.type === "VIDANGE") {
      if (!v.produitId) ctx.addIssue({ code: "custom", path: ["produitId"], message: "Produit obligatoire pour une vidange" });
      if (!v.quantite) ctx.addIssue({ code: "custom", path: ["quantite"], message: "Quantité obligatoire pour une vidange" });
    }
    if (v.type === "REPARATION" && !v.panne) {
      ctx.addIssue({ code: "custom", path: ["panne"], message: "Décrire la panne" });
    }
    if ((v.produitId && !v.quantite) || (!v.produitId && v.quantite)) {
      ctx.addIssue({ code: "custom", path: ["quantite"], message: "Produit et quantité vont ensemble" });
    }
    if (v.correctionOfId && !v.motifCorrection) {
      ctx.addIssue({ code: "custom", path: ["motifCorrection"], message: "Motif de correction obligatoire" });
    }
  });
export type OperationInput = z.infer<typeof operationSchema>;

export const entreeSchema = z.object({
  produitId: z.string().min(1, "Produit obligatoire"),
  quantite: requiredNumber("Quantité obligatoire").pipe(z.number().positive("Quantité > 0")),
  fournisseur: z.string().trim().min(1, "Fournisseur obligatoire"),
  bonLivraison: optionalText,
  siteId: z.string().min(1, "Site obligatoire"),
  date: z.string().min(1, "Date obligatoire").refine((s) => !Number.isNaN(Date.parse(s)), "Date invalide"),
  correctionOfId: optionalText,
  motifCorrection: optionalText,
});

export const inventaireSchema = z
  .object({
    siteId: z.string().min(1, "Site obligatoire"),
    produitId: z.string().min(1, "Produit obligatoire"),
    mois: z.string().regex(/^\d{4}-\d{2}$/, "Mois invalide"),
    quantitePhysique: requiredNumber("Quantité obligatoire").pipe(z.number().nonnegative("Valeur positive attendue")),
    quantiteTheorique: z.coerce.number(),
    justification: optionalText,
  })
  .superRefine((v, ctx) => {
    const ecart = Math.round((v.quantitePhysique - v.quantiteTheorique) * 100) / 100;
    if (ecart !== 0 && !v.justification) {
      ctx.addIssue({ code: "custom", path: ["justification"], message: "Justification obligatoire si l'écart n'est pas nul" });
    }
  });

export const userCreateSchema = z
  .object({
    nom: z.string().trim().min(2, "Nom obligatoire"),
    email: z.string().trim().toLowerCase().email("Email invalide"),
    password: z.string().min(8, "8 caractères minimum"),
    role: z.enum(["ADMIN", "AGENT", "CHEF_SITE", "DIRECTION"]),
    siteId: optionalText,
  })
  .superRefine((v, ctx) => {
    if ((v.role === "AGENT" || v.role === "CHEF_SITE") && !v.siteId) {
      ctx.addIssue({ code: "custom", path: ["siteId"], message: "Site obligatoire pour ce rôle" });
    }
  });

export const userUpdateSchema = z
  .object({
    id: z.string().min(1),
    role: z.enum(["ADMIN", "AGENT", "CHEF_SITE", "DIRECTION"]),
    siteId: optionalText,
    password: z
      .string()
      .optional()
      .transform((v) => (v ? v : undefined))
      .refine((v) => !v || v.length >= 8, "8 caractères minimum"),
  })
  .superRefine((v, ctx) => {
    if ((v.role === "AGENT" || v.role === "CHEF_SITE") && !v.siteId) {
      ctx.addIssue({ code: "custom", path: ["siteId"], message: "Site obligatoire pour ce rôle" });
    }
  });

export const siteSchema = z.object({
  id: optionalText,
  nom: z.string().trim().min(2, "Nom obligatoire").toUpperCase(),
  responsable: optionalText,
});

export const equipmentSchema = z
  .object({
    original: optionalText,
    codeParking: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[DE][A-Z0-9-]+$/, "Le code parking commence par D (camion) ou E (engin)"),
    marque: z.string().trim().min(1, "Marque obligatoire"),
    type: z.string().trim().min(1, "Type obligatoire"),
    immatriculation: optionalText,
    annee: optionalNumber,
    siteId: z.string().min(1, "Site obligatoire"),
    compteurActuel: requiredNumber("Compteur obligatoire").pipe(z.number().int().nonnegative()),
    actif: checkbox,
  });

export const lubricantSchema = z.object({
  id: optionalText,
  nom: z.string().trim().min(2, "Nom obligatoire"),
  unite: z.enum(["L", "KG"]),
  seuilAlerte: z.coerce.number().nonnegative(),
  prixUnitaire: z.coerce.number().nonnegative(),
});

export const settingsSchema = z.object({
  periodicite_D: z.coerce.number().int().positive("Valeur > 0"),
  periodicite_E: z.coerce.number().int().positive("Valeur > 0"),
  hors_norme_pct: z.coerce.number().positive("Valeur > 0").max(500),
});

/** Flatten zod errors to { field: message } for form display. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export interface ActionState {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string>;
}
