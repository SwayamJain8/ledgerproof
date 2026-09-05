import { z } from "zod";

/**
 * Credential rules, in one place.
 *
 * The mockup states these on both the Create User and Sign Up screens:
 *   - login ID is unique and 6-12 characters
 *   - password is longer than 8 characters and mixes lower case, upper case
 *     and a special character
 *
 * The login-ID length is ALSO a database CHECK (`user_login_length`), so a
 * bad value cannot be written even by a script that skips this file. This
 * module is the friendly half of that pair: it exists to produce a readable
 * message, not to be the only guard.
 */

export const LOGIN_ID_MIN = 6;
export const LOGIN_ID_MAX = 12;
export const PASSWORD_MIN = 9; // "greater than 8 characters"

export const loginIdSchema = z
  .string()
  .trim()
  .min(LOGIN_ID_MIN, `The login ID must be at least ${LOGIN_ID_MIN} characters.`)
  .max(LOGIN_ID_MAX, `The login ID must be at most ${LOGIN_ID_MAX} characters.`)
  .regex(/^[a-zA-Z0-9._-]+$/, "The login ID may use letters, digits, dot, dash and underscore only.");

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `The password must be more than ${PASSWORD_MIN - 1} characters.`)
  .regex(/[a-z]/, "The password needs at least one lower-case letter.")
  .regex(/[A-Z]/, "The password needs at least one upper-case letter.")
  .regex(/[^a-zA-Z0-9]/, "The password needs at least one special character.");

/**
 * Every rule with a pass/fail flag, for a live checklist under the field.
 *
 * Returned even when the password is empty so the user sees what is expected
 * before typing rather than after failing.
 */
export interface PasswordRule {
  label: string;
  satisfied: boolean;
}

export function passwordRules(password: string): PasswordRule[] {
  return [
    { label: `More than ${PASSWORD_MIN - 1} characters`, satisfied: password.length >= PASSWORD_MIN },
    { label: "A lower-case letter", satisfied: /[a-z]/.test(password) },
    { label: "An upper-case letter", satisfied: /[A-Z]/.test(password) },
    { label: "A special character", satisfied: /[^a-zA-Z0-9]/.test(password) },
  ];
}

export function isPasswordAcceptable(password: string): boolean {
  return passwordRules(password).every((r) => r.satisfied);
}
