import "server-only";
import { XLSX_TYPE } from "./excel";

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

export function fileResponse(data: Uint8Array | Buffer, name: string, format: "pdf" | "xlsx", inline = false) {
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": format === "pdf" ? "application/pdf" : XLSX_TYPE,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${slug(name)}.${format}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

export const unauthorized = () => new Response("Non authentifié", { status: 401 });
export const forbidden = () => new Response("Accès refusé", { status: 403 });
