"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession, destroySession, verifyPassword } from "@/lib/auth";
import type { ActionState } from "@/lib/validation";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email invalide"),
  password: z.string().min(1, "Mot de passe obligatoire"),
});

export async function loginAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { message: "Email et mot de passe obligatoires" };
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  // Same message for unknown email and wrong password.
  if (!user || !(await verifyPassword(parsed.data.password, user.hash))) {
    return { message: "Email ou mot de passe incorrect." };
  }
  if (!user.actif) {
    return { message: "Ce compte est désactivé. Contactez l'administrateur TRANSWIN." };
  }
  await createSession(user.id);
  redirect("/");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
