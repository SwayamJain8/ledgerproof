"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, X } from "lucide-react";

import { signUpAction, type AuthFormState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/primitives";
import { Field, FormError, Input } from "@/components/ui/form";
import { LOGIN_ID_MAX, LOGIN_ID_MIN, passwordRules } from "@/lib/auth/password";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>
      {pending ? "Creating account…" : "Create account"}
    </Button>
  );
}

/**
 * The rules, checked as you type.
 *
 * Same predicates the server validates with, imported rather than re-written,
 * so the checklist can never drift from what actually gets accepted.
 */
function PasswordChecklist({ password }: { password: string }) {
  const rules = passwordRules(password);
  return (
    <ul className="mt-2 grid gap-1 sm:grid-cols-2">
      {rules.map((rule) => (
        <li
          key={rule.label}
          className={`flex items-center gap-1.5 text-[11.5px] ${
            rule.satisfied ? "text-ink-2" : "text-ink-3"
          }`}
        >
          {rule.satisfied ? (
            <Check className="h-3 w-3 text-walnut" />
          ) : (
            <X className="h-3 w-3 text-ink-4" />
          )}
          {rule.label}
        </li>
      ))}
    </ul>
  );
}

export function SignUpForm() {
  const [state, formAction] = useActionState<AuthFormState, FormData>(signUpAction, {});
  const [password, setPassword] = useState("");

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <FormError>{state.error}</FormError> : null}

      <Field label="Your name" htmlFor="name">
        <Input id="name" name="name" autoComplete="name" autoFocus required placeholder="Nimesh Pathak" />
      </Field>

      <Field
        label="Login ID"
        htmlFor="loginId"
        hint={`${LOGIN_ID_MIN}–${LOGIN_ID_MAX} characters, and unique`}
      >
        <Input
          id="loginId"
          name="loginId"
          autoComplete="username"
          required
          minLength={LOGIN_ID_MIN}
          maxLength={LOGIN_ID_MAX}
          placeholder="nimeshp"
        />
      </Field>

      <Field label="Email" htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="nimesh@example.in"
        />
      </Field>

      <Field label="Password" htmlFor="password">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <PasswordChecklist password={password} />
      </Field>

      <Field label="Confirm password" htmlFor="confirm">
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      </Field>

      <div className="pt-1">
        <SubmitButton />
      </div>
    </form>
  );
}
