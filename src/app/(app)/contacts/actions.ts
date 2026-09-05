"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";

const schema = z.object({
  name: z.string().trim().min(1, "Enter a name."),
  type: z.enum(["CUSTOMER", "VENDOR", "BOTH"]),
  email: z.string().trim().toLowerCase().email("That email does not look right.").or(z.literal("")),
  mobile: z.string().trim().max(15, "Mobile number is too long.").optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  pincode: z.string().trim().max(6, "A pincode is 6 digits.").optional(),
  street1: z.string().trim().optional(),
  receivableAccountId: z.string().optional(),
  payableAccountId: z.string().optional(),
});

export interface ContactFormState {
  error?: string;
}

/**
 * Create a contact.
 *
 * The two account fields are deliberately optional. Leaving them blank is the
 * normal case: the posting engine then falls through to the company default,
 * which is rung 2 of resolution chain R4. Setting one is how you give a single
 * customer their own receivable account without touching any code.
 */
export async function createContactAction(
  _prev: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  await requireSession();

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }
  const d = parsed.data;

  if (d.email) {
    const clash = await prisma.contact.findFirst({ where: { email: d.email } });
    if (clash) return { error: `${clash.name} already uses that email address.` };
  }

  await prisma.contact.create({
    data: {
      name: d.name,
      type: d.type,
      email: d.email || null,
      mobile: d.mobile || null,
      street1: d.street1 || null,
      city: d.city || null,
      state: d.state || null,
      pincode: d.pincode || null,
      country: "India",
      receivableAccountId: d.receivableAccountId || null,
      payableAccountId: d.payableAccountId || null,
    },
  });

  revalidatePath("/contacts");
  redirect("/contacts");
}
