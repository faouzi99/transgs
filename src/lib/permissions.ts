import type { Role } from "@prisma/client";
import type { SessionUser } from "./auth";

/** Roles restricted to their own site. */
export const isSiteBound = (role: Role) => role === "AGENT" || role === "CHEF_SITE";

/**
 * Site filter to apply to every query for this user. Site-bound users always get their own
 * site, whatever they requested; ADMIN and DIRECTION get the requested site or all sites.
 */
export function siteScope(user: SessionUser, requested?: string | null): string | undefined {
  if (isSiteBound(user.role)) return user.siteId ?? "__none__";
  return requested || undefined;
}

/** Whether the user may write data (operations, stock) on the given site. */
export function canWriteOnSite(user: SessionUser, siteId: string): boolean {
  if (user.role === "ADMIN") return true;
  if (user.role === "AGENT" || user.role === "CHEF_SITE") return user.siteId === siteId;
  return false;
}

export const canWrite = (user: SessionUser) => user.role !== "DIRECTION";
export const canValidate = (user: SessionUser) => user.role === "CHEF_SITE" || user.role === "ADMIN";

export class ForbiddenError extends Error {
  constructor(message = "Action non autorisée") {
    super(message);
  }
}
