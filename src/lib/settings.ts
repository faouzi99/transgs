import { prisma } from "./db";
import type { Famille } from "@prisma/client";

export const SETTING_DEFAULTS = {
  periodicite_D: "10000", // km between oil changes for trucks
  periodicite_E: "250", // running hours between oil changes for machines
  hors_norme_pct: "50", // % above the type average that flags an equipment
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;

export async function getSettings(): Promise<Record<SettingKey, number>> {
  const rows = await prisma.setting.findMany();
  const out = {} as Record<SettingKey, number>;
  for (const k of Object.keys(SETTING_DEFAULTS) as SettingKey[]) {
    const row = rows.find((r) => r.key === k);
    out[k] = Number(row?.value ?? SETTING_DEFAULTS[k]);
  }
  return out;
}

export async function getPeriodicite(famille: Famille): Promise<number> {
  const s = await getSettings();
  return famille === "D" ? s.periodicite_D : s.periodicite_E;
}
