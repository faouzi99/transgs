"use client";

import { useEffect, useRef } from "react";
import {
  equipmentSchema,
  lubricantSchema,
  settingsSchema,
  siteSchema,
  userCreateSchema,
  userUpdateSchema,
  type ActionState,
} from "@/lib/validation";
import { useZodForm } from "./use-zod-form";

const SCHEMAS = {
  userCreate: userCreateSchema,
  userUpdate: userUpdateSchema,
  site: siteSchema,
  equipment: equipmentSchema,
  lubricant: lubricantSchema,
  settings: settingsSchema,
};

/** Admin form: inputs are passed as children; errors are listed under the form. */
export function AdminForm({
  action,
  schema,
  children,
  submitLabel = "Enregistrer",
  resetOnSuccess,
  className = "grid gap-3 sm:grid-cols-2 lg:grid-cols-4",
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  schema: keyof typeof SCHEMAS;
  children: React.ReactNode;
  submitLabel?: string;
  resetOnSuccess?: boolean;
  className?: string;
}) {
  const { onSubmit, errors, message, pending, ok } = useZodForm(SCHEMAS[schema], action);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (ok && resetOnSuccess) ref.current?.reset();
  }, [ok, resetOnSuccess]);
  const list = Object.values(errors);
  return (
    <form ref={ref} onSubmit={onSubmit} className={className} noValidate>
      {children}
      <div className="flex flex-wrap items-center gap-2 self-end">
        <button className="btn-primary" disabled={pending}>{pending ? "…" : submitLabel}</button>
        {message && <span className={`text-sm ${ok ? "text-ok" : "text-bad"}`}>{message}</span>}
      </div>
      {list.length > 0 && (
        <ul className="col-span-full list-inside list-disc text-xs text-bad">
          {list.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </form>
  );
}
