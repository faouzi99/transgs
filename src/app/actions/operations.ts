"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { BusinessError, recordOperation, validateOperation } from "@/lib/operations";
import { ForbiddenError } from "@/lib/permissions";
import { fieldErrors, operationSchema, type ActionState } from "@/lib/validation";

export async function recordOperationAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser(["ADMIN", "AGENT", "CHEF_SITE"]);
  const parsed = operationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error), message: "Vérifiez les champs en rouge." };
  let id: string;
  try {
    id = (await recordOperation(user, parsed.data)).id;
  } catch (e) {
    if (e instanceof BusinessError) return { message: e.message, errors: e.field ? { [e.field]: e.message } : undefined };
    if (e instanceof ForbiddenError) return { message: e.message };
    throw e;
  }
  revalidatePath("/", "layout");
  redirect(`/operations/${id}?ok=1`);
}

export async function validateOperationAction(formData: FormData) {
  const user = await requireUser(["ADMIN", "CHEF_SITE"]);
  const ids = formData.getAll("id").map(String).filter(Boolean);
  for (const id of ids) {
    try {
      await validateOperation(user, id);
    } catch (e) {
      if (!(e instanceof BusinessError || e instanceof ForbiddenError)) throw e;
    }
  }
  revalidatePath("/", "layout");
}
