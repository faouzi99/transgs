"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { hashPassword, requireUser, type SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  equipmentSchema,
  fieldErrors,
  lubricantSchema,
  settingsSchema,
  siteSchema,
  userCreateSchema,
  userUpdateSchema,
  type ActionState,
} from "@/lib/validation";

const admin = () => requireUser(["ADMIN"]);

async function audit(user: SessionUser, action: string, entity: string, entityId: string, data?: unknown) {
  await prisma.auditLog.create({
    data: { userId: user.id, action, entity, entityId, data: data === undefined ? Prisma.JsonNull : (data as Prisma.InputJsonValue) },
  });
}

const done = (message: string): ActionState => {
  revalidatePath("/admin");
  return { ok: true, message };
};

const isUnique = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

export async function createUserAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await admin();
  const parsed = userCreateSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { errors: fieldErrors(parsed.error), message: "Vérifiez le formulaire." };
  const v = parsed.data;
  try {
    const u = await prisma.user.create({
      data: {
        nom: v.nom,
        email: v.email,
        hash: await hashPassword(v.password),
        role: v.role,
        siteId: v.role === "AGENT" || v.role === "CHEF_SITE" ? v.siteId : v.siteId ?? null,
        createdById: me.id,
      },
    });
    await audit(me, "CREATE", "User", u.id, { nom: v.nom, email: v.email, role: v.role, siteId: v.siteId });
  } catch (e) {
    if (isUnique(e)) return { errors: { email: "Email déjà utilisé" }, message: "Email déjà utilisé." };
    throw e;
  }
  return done(`Compte créé pour ${v.nom}.`);
}

export async function updateUserAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await admin();
  const parsed = userUpdateSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { errors: fieldErrors(parsed.error), message: "Vérifiez le formulaire." };
  const v = parsed.data;
  if (v.id === me.id && v.role !== "ADMIN") return { message: "Vous ne pouvez pas retirer votre propre rôle administrateur." };
  await prisma.user.update({
    where: { id: v.id },
    data: { role: v.role, siteId: v.siteId ?? null, ...(v.password ? { hash: await hashPassword(v.password) } : {}) },
  });
  if (v.password) await prisma.session.deleteMany({ where: { userId: v.id } });
  await audit(me, "UPDATE", "User", v.id, { role: v.role, siteId: v.siteId, passwordReset: Boolean(v.password) });
  return done("Compte mis à jour.");
}

export async function toggleUserAction(fd: FormData) {
  const me = await admin();
  const id = String(fd.get("id"));
  if (id === me.id) return;
  const u = await prisma.user.findUniqueOrThrow({ where: { id } });
  await prisma.user.update({ where: { id }, data: { actif: !u.actif } });
  // A deactivated user is signed out everywhere immediately.
  if (u.actif) await prisma.session.deleteMany({ where: { userId: id } });
  await audit(me, u.actif ? "DEACTIVATE" : "REACTIVATE", "User", id);
  revalidatePath("/admin");
}

export async function saveSiteAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await admin();
  const parsed = siteSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { errors: fieldErrors(parsed.error), message: "Vérifiez le formulaire." };
  const v = parsed.data;
  try {
    const s = v.id
      ? await prisma.site.update({ where: { id: v.id }, data: { nom: v.nom, responsable: v.responsable ?? null } })
      : await prisma.site.create({ data: { nom: v.nom, responsable: v.responsable ?? null } });
    await audit(me, v.id ? "UPDATE" : "CREATE", "Site", s.id, v);
  } catch (e) {
    if (isUnique(e)) return { message: "Ce site existe déjà." };
    throw e;
  }
  return done("Site enregistré.");
}

export async function saveEquipmentAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await admin();
  const parsed = equipmentSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { errors: fieldErrors(parsed.error), message: "Vérifiez le formulaire." };
  const v = parsed.data;
  const famille = v.codeParking.startsWith("D") ? "D" : "E";
  const data = {
    famille,
    marque: v.marque,
    type: v.type,
    immatriculation: v.immatriculation ?? null,
    annee: v.annee !== undefined ? Math.round(v.annee) : null,
    siteId: v.siteId,
    compteurActuel: v.compteurActuel,
    uniteCompteur: famille === "D" ? "KM" : "H",
  } as const;
  try {
    if (v.original) {
      // The code parking is the key that links operations and stock: it cannot be renamed.
      await prisma.equipment.update({ where: { codeParking: v.original }, data: { ...data, actif: v.actif } });
    } else {
      await prisma.equipment.create({ data: { codeParking: v.codeParking, ...data } });
    }
    await audit(me, v.original ? "UPDATE" : "CREATE", "Equipment", v.original ?? v.codeParking, { ...data, actif: v.actif });
  } catch (e) {
    if (isUnique(e)) return { errors: { codeParking: "Code parking déjà utilisé" }, message: "Code parking déjà utilisé." };
    throw e;
  }
  return done(`Matériel ${v.original ?? v.codeParking} enregistré.`);
}

export async function saveLubricantAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await admin();
  const parsed = lubricantSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { errors: fieldErrors(parsed.error), message: "Vérifiez le formulaire." };
  const v = parsed.data;
  const data = {
    nom: v.nom,
    unite: v.unite,
    seuilAlerte: new Prisma.Decimal(v.seuilAlerte),
    prixUnitaire: new Prisma.Decimal(v.prixUnitaire),
  };
  try {
    const l = v.id
      ? await prisma.lubricant.update({ where: { id: v.id }, data })
      : await prisma.lubricant.create({ data: { ...data, ordre: (await prisma.lubricant.count()) + 1 } });
    await audit(me, v.id ? "UPDATE" : "CREATE", "Lubricant", l.id, v);
  } catch (e) {
    if (isUnique(e)) return { message: "Ce lubrifiant existe déjà." };
    throw e;
  }
  return done("Lubrifiant enregistré.");
}

export async function saveSettingsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await admin();
  const parsed = settingsSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { errors: fieldErrors(parsed.error), message: "Vérifiez le formulaire." };
  for (const [key, value] of Object.entries(parsed.data)) {
    await prisma.setting.upsert({ where: { key }, create: { key, value: String(value) }, update: { value: String(value) } });
  }
  await audit(me, "UPDATE", "Setting", "global", parsed.data);
  return done("Paramètres enregistrés. Les nouvelles vidanges utiliseront ces périodicités.");
}
