"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import type { ZodTypeAny } from "zod";
import type { ActionState } from "@/lib/validation";

/**
 * Client-side validation with the same zod schema the server action uses.
 * Invalid forms are not submitted; server errors are merged in after submission.
 * Submission goes through onSubmit (not the form `action` prop) so React does not reset
 * the fields when the server rejects the input.
 */
export function useZodForm(schema: ZodTypeAny, action: (s: ActionState, f: FormData) => Promise<ActionState>) {
  const [state, formAction, pending] = useActionState(action, {});
  const [clientErrors, setClientErrors] = useState<Record<string, string> | null>(null);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const parsed = schema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) {
        const k = i.path.join(".") || "_form";
        if (!errs[k]) errs[k] = i.message;
      }
      setClientErrors(errs);
    } else {
      setClientErrors(null);
      startTransition(() => formAction(formData));
    }
  };

  const errors = clientErrors ?? state.errors ?? {};
  const message = clientErrors ? "Vérifiez les champs en rouge." : state.message;
  return { onSubmit, errors, message, pending, ok: state.ok && !clientErrors };
}

export function FieldError({ errors, name }: { errors: Record<string, string>; name: string }) {
  return errors[name] ? <p className="field-error">{errors[name]}</p> : null;
}
