import { getCurrentUser } from "@/lib/auth";
import { siteScope } from "@/lib/permissions";
import { archiveReport, buildConsommationReport } from "@/lib/reports";
import { fileResponse, unauthorized } from "@/lib/http";

export async function GET(req: Request, { params }: { params: Promise<{ format: string }> }) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { format } = await params;
  if (format !== "pdf" && format !== "xlsx") return new Response("Format inconnu", { status: 404 });
  const q = new URL(req.url).searchParams;
  const year = Number(q.get("annee")) || new Date().getFullYear();
  const siteId = siteScope(user, q.get("site"));
  const spec = await buildConsommationReport(user, year, siteId);
  const { pdf, xlsx } = await archiveReport(user, spec, {
    kind: "CONSOMMATION",
    period: "ANNEE",
    start: new Date(year, 0, 1),
    end: new Date(year + 1, 0, 1),
    siteId,
  });
  return fileResponse(format === "pdf" ? pdf : xlsx, spec.titre + " " + spec.pied.site, format);
}
