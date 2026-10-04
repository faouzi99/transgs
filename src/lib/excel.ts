import "server-only";
import * as XLSX from "xlsx";
import type { ReportSpec } from "./report-spec";

type Cell = string | number | null;

/** Build an .xlsx file from named sheets of rows. */
export function workbook(sheets: { name: string; rows: Cell[][] }[]): Buffer {
  const wb = XLSX.utils.book_new();
  for (const sh of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(sh.rows);
    // Column widths from content length.
    const widths: number[] = [];
    for (const row of sh.rows) row.forEach((c, i) => (widths[i] = Math.max(widths[i] ?? 8, Math.min(50, String(c ?? "").length + 2))));
    ws["!cols"] = widths.map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws, sh.name.slice(0, 31));
  }
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/** Same content as the PDF: header, each section, totals and footer, on one sheet per section. */
export function reportWorkbook(spec: ReportSpec): Buffer {
  const head: Cell[][] = [[spec.titre], ...spec.entete.map(([k, v]) => [k, v] as Cell[]), []];
  const foot: Cell[][] = [
    [],
    ["Site", spec.pied.site],
    ["Période", spec.pied.periode],
    ["Date d'édition", spec.pied.dateEdition],
    ["Auteur du rapport", spec.pied.auteur],
  ];
  const sheets = spec.sections.map((sec, i) => ({
    name: sec.titre.replace(/[\\/?*[\]:]/g, " "),
    rows: [
      ...head,
      [sec.titre],
      sec.colonnes,
      ...(sec.lignes.length ? sec.lignes : [[sec.vide ?? "Aucune ligne."]]),
      ...(i === 0 && spec.totaux ? [[], ...spec.totaux.map(([k, v]) => [k, v] as Cell[])] : []),
      ...foot,
    ] as Cell[][],
  }));
  return workbook(sheets);
}

export const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
