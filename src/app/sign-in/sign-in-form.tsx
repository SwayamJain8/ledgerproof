"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { signInAction, type AuthFormState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/primitives";
import { Field, FormError, Input } from "@/components/ui/form";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>
      {pending ? "Signing in\u2026" : "Sign in"}
    </Button>
  );
}

export function SignInForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState<AuthFormState, FormData>(signInAction, {});

  return (
    <form action={formAction} className="space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {state.error ? <FormError>{state.error}</FormError> : null}

      <Field label="Login ID" htmlFor="loginId">
        <Input
          id="loginId"
          name="loginId"
          autoComplete="username"
          autoFocus
          required
          placeholder="adminuf"
        />
      </Field>

      <Field label="Password" htmlFor="password">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
        />
      </Field>

      <div className="pt-1">
        <SubmitButton />
      </div>
    </form>
  );
}
