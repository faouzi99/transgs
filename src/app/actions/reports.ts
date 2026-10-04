"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { siteScope } from "@/lib/permissions";
import { buildPeriod } from "@/lib/dates";
import { archiveReport, buildOperationReport, periodEnum } from "@/lib/reports";
import type { ActionState } from "@/lib/validation";

const schema = z.object({
  type: z.enum(["VIDANGE", "REPARATION", "SOUFFLAGE", "GRAISSAGE", "LAVAGE"]),
  vue: z.enum(["jour", "mois"]),
  ref: z.string().min(4, "Période obligatoire"),
  site: z.string().optional(),
});

export async function generateOperationReportAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { message: "Choisissez l'opération et la période." };
  const { type, vue, ref, site } = parsed.data;
  const period = buildPeriod(vue, ref);
  const siteId = siteScope(user, site);
  const spec = await buildOperationReport(user, type, period, siteId);
  const { id } = await archiveReport(user, spec, {
    kind: "OPERATION",
    operationType: type,
    period: periodEnum(period.view),
    start: period.start,
    end: period.end,
    siteId,
  });
  revalidatePath("/rapports");
  redirect(`/rapports?nouveau=${id}`);
}
