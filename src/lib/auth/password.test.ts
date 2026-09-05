import { describe, expect, it } from "vitest";

import {
  isPasswordAcceptable,
  loginIdSchema,
  passwordRules,
  passwordSchema,
} from "./password";

describe("loginIdSchema", () => {
  it("accepts a login ID inside the mockup's 6-12 character range", () => {
    expect(loginIdSchema.safeParse("adminuf").success).toBe(true);
    expect(loginIdSchema.safeParse("priyaacc").success).toBe(true);
  });

  it("rejects one that is too short or too long", () => {
    expect(loginIdSchema.safeParse("abc").success).toBe(false);
    expect(loginIdSchema.safeParse("a".repeat(13)).success).toBe(false);
  });

  it("matches the database CHECK at both boundaries", () => {
    // user_login_length is BETWEEN 6 AND 12, so these must agree exactly or a
    // valid-looking form submission dies on a constraint instead.
    expect(loginIdSchema.safeParse("a".repeat(6)).success).toBe(true);
    expect(loginIdSchema.safeParse("a".repeat(12)).success).toBe(true);
    expect(loginIdSchema.safeParse("a".repeat(5)).success).toBe(false);
  });

  it("rejects characters that would need escaping", () => {
    expect(loginIdSchema.safeParse("admin uf").success).toBe(false);
    expect(loginIdSchema.safeParse("admin/uf").success).toBe(false);
  });
});

describe("passwordSchema", () => {
  it("accepts the seeded demo passwords", () => {
    expect(passwordSchema.safeParse("Admin@2026x").success).toBe(true);
    expect(passwordSchema.safeParse("Priya@2026x").success).toBe(true);
  });

  it("rejects a password of 8 characters — the rule is MORE than 8", () => {
    expect(passwordSchema.safeParse("Abcd@123").success).toBe(false);
    expect(passwordSchema.safeParse("Abcd@1234").success).toBe(true);
  });

  it("requires each of the three character classes", () => {
    expect(passwordSchema.safeParse("alllower@123").success).toBe(false);
    expect(passwordSchema.safeParse("ALLUPPER@123").success).toBe(false);
    expect(passwordSchema.safeParse("NoSpecial123").success).toBe(false);
  });
});

describe("passwordRules", () => {
  it("reports every rule as unmet for an empty password", () => {
    expect(passwordRules("").every((r) => !r.satisfied)).toBe(true);
  });

  it("agrees with the schema on what is acceptable", () => {
    for (const candidate of ["Admin@2026x", "Abcd@1234", "short", "NoSpecial123", ""]) {
      expect(isPasswordAcceptable(candidate)).toBe(passwordSchema.safeParse(candidate).success);
    }
  });
});
