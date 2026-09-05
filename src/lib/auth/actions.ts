"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { endSession, startSession } from "./session";

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
