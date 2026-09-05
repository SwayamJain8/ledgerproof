"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { endSession, startSession } from "./session";
import { loginIdSchema, passwordSchema } from "./password";

export interface AuthFormState {
  error?: string;
}

const signInSchema = z.object({
  loginId: z.string().trim().min(1, "Enter your login ID."),
  password: z.string().min(1, "Enter your password."),
  next: z.string().optional(),
});

export async function signInAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }
  const { loginId, password, next } = parsed.data;

  const user = await prisma.user.findFirst({
    where: { loginId, active: true },
    select: { id: true, name: true, loginId: true, role: true, passwordHash: true },
  });

  // One message for both branches: telling an attacker which login IDs exist is
  // free reconnaissance. The bcrypt compare still runs on a dummy hash so the
  // response time does not leak the answer either.
  const hash = user?.passwordHash ?? "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva";
  const valid = await bcrypt.compare(password, hash);
  if (!user || !valid) {
    return { error: "That login ID and password do not match." };
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await startSession({
    userId: user.id,
    name: user.name,
    loginId: user.loginId,
    role: user.role,
  });

  redirect(next && next.startsWith("/") ? next : "/");
}

export async function signOutAction() {
  await endSession();
  redirect("/sign-in");
}

const signUpSchema = z
  .object({
    name: z.string().trim().min(1, "Enter your name."),
    loginId: loginIdSchema,
    email: z.string().trim().toLowerCase().email("Enter a valid email address."),
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: "The two passwords do not match.",
    path: ["confirm"],
  });

/**
 * Self-service sign up.
 *
 * Always creates a PORTAL user, never an ADMIN or ACCOUNTANT — the role is not
 * taken from the form at all, so no amount of tampering with the request can
 * mint an accountant. Internal staff are created by an administrator instead.
 *
 * A PORTAL user has no Contact attached yet, so it sees nothing until an
 * administrator links it to one. That is deliberate: an unlinked account is
 * harmless, whereas guessing at a link from a matching email would let anyone
 * read a customer's ledger by signing up with their address.
 */
export async function signUpAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }
  const { name, loginId, email, password } = parsed.data;

  const clash = await prisma.user.findFirst({
    where: { OR: [{ loginId }, { email }] },
    select: { loginId: true },
  });
  if (clash) {
    return {
      error:
        clash.loginId === loginId
          ? "That login ID is already taken."
          : "An account with that email already exists.",
    };
  }

  const user = await prisma.user.create({
    data: {
      name,
      loginId,
      email,
      passwordHash: bcrypt.hashSync(password, 10),
      role: "PORTAL",
    },
    select: { id: true, name: true, loginId: true, role: true },
  });

  await startSession({
    userId: user.id,
    name: user.name,
    loginId: user.loginId,
    role: user.role,
  });

  redirect("/");
}
