// Format-independent report description, rendered both to PDF and to Excel.

export type Tone = "ok" | "bad" | undefined;

export interface ReportSection {
  titre: string;
  colonnes: string[];
  lignes: (string | number)[][];
  tones?: Tone[][]; // optional per-cell colour (Oui in green, Non in red)
  alignRight?: number[]; // indexes of numeric columns
  vide?: string; // text when there are no rows
}

export interface ReportSpec {
  titre: string;
  entete: [string, string][];
  sections: ReportSection[];
  totaux?: [string, string][];
  pied: { site: string; periode: string; dateEdition: string; auteur: string };
}
