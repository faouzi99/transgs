import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { prisma } from "./db";

export const SESSION_COOKIE = "transwin_session";
const TTL_HOURS = Number(process.env.SESSION_TTL_HOURS ?? 12);

export interface SessionUser {
  id: string;
  nom: string;
  email: string;
  role: Role;
  siteId: string | null;
  siteNom: string | null;
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export const hashPassword = (pwd: string) => bcrypt.hash(pwd, 10);
export const verifyPassword = (pwd: string, hash: string) => bcrypt.compare(pwd, hash);

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TTL_HOURS * 3600 * 1000);
  await prisma.session.create({ data: { id: hashToken(token), userId, expiresAt } });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { id: hashToken(token) } });
  jar.delete(SESSION_COOKIE);
}

/** Current user, or null. Deactivated accounts and expired sessions are rejected on every request. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { id: hashToken(token) },
    include: { user: { include: { site: true } } },
  });
  if (!session || session.expiresAt < new Date() || !session.user.actif) return null;
  const u = session.user;
  return { id: u.id, nom: u.nom, email: u.email, role: u.role, siteId: u.siteId, siteNom: u.site?.nom ?? null };
});

/** Require a signed-in user (optionally with one of the given roles); redirects otherwise. */
export async function requireUser(roles?: Role[]): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (roles && !roles.includes(user.role)) redirect("/?refus=1");
  return user;
}
