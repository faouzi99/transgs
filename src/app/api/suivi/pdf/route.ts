import { getCurrentUser } from "@/lib/auth";
import { siteScope } from "@/lib/permissions";
import { buildPeriod } from "@/lib/dates";
import { archiveReport, buildSuiviReport, periodEnum } from "@/lib/reports";
import { fileResponse, unauthorized } from "@/lib/http";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const q = new URL(req.url).searchParams;
  const period = buildPeriod(q.get("vue") === "jour" ? "jour" : "mois", q.get("ref") ?? undefined);
  const siteId = siteScope(user, q.get("site"));
  const spec = await buildSuiviReport(user, period, siteId);
  const { pdf } = await archiveReport(user, spec, { kind: "SUIVI", period: periodEnum(period.view), start: period.start, end: period.end, siteId });
  return fileResponse(pdf, spec.titre + " " + spec.pied.periode, "pdf");
}
