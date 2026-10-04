import type { Famille, OperationType } from "@prisma/client";
import { OPERATION_TYPES } from "./labels";

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export const parseFamille = (v: string | undefined): Famille | undefined => (v === "D" || v === "E" ? v : undefined);
export const parseType = (v: string | undefined): OperationType | undefined =>
  OPERATION_TYPES.includes(v as OperationType) ? (v as OperationType) : undefined;
