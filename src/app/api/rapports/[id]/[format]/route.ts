import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isSiteBound } from "@/lib/permissions";
import { fileResponse, forbidden, unauthorized } from "@/lib/http";

// Serves an archived report as generated at the time (no regeneration).
export async function GET(_: Request, { params }: { params: Promise<{ id: string; format: string }> }) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id, format } = await params;
  if (format !== "pdf" && format !== "xlsx") return new Response("Format inconnu", { status: 404 });
  const report = await prisma.report.findUnique({ where: { id } });
  if (!report) return new Response("Rapport introuvable", { status: 404 });
  if (isSiteBound(user.role) && report.siteId !== user.siteId) return forbidden();
  const data = format === "pdf" ? report.pdf : report.xlsx;
  if (!data) return new Response("Format indisponible", { status: 404 });
  return fileResponse(data, report.titre, format, format === "pdf");
}
