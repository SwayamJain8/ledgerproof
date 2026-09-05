import type { Metadata } from "next";
import Link from "next/link";

import { Wordmark } from "@/components/wordmark";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Sign up" };

export default function SignUpPage() {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* Same showroom panel as sign-in, so the two screens read as one place. */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-oak p-12 text-paper lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, #fff 0 1px, transparent 1px 7px), repeating-linear-gradient(0deg, #fff 0 1px, transparent 1px 23px)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-brass/10 blur-3xl"
        />

        <div className="relative text-paper">
          <Wordmark subdued />
        </div>

        <div className="relative max-w-lg">
          <p className="font-display text-[40px] leading-[1.12] font-normal tracking-[-0.015em] text-paper">
            A portal account sees its own invoices, and nothing else.
          </p>
          <p className="mt-6 max-w-md text-[14px] leading-relaxed text-paper/55">
            Signing up here creates a customer portal login. Staff accounts are
            created by an administrator, so an account made on this page can
            never post to the ledger.
          </p>
        </div>

        <dl className="relative grid grid-cols-3 gap-6 border-t border-paper/12 pt-6">
          {[
            ["Portal only", "Self-signup can never mint a staff account"],
            ["Scoped", "A portal user is tied to one contact"],
            ["Unlinked is safe", "It sees nothing until an admin links it"],
          ].map(([term, detail]) => (
            <div key={term}>
              <dt className="text-[10px] font-semibold tracking-[0.14em] text-brass uppercase">
                {term}
              </dt>
              <dd className="mt-1.5 text-[12px] leading-snug text-paper/45">{detail}</dd>
            </div>
          ))}
        </dl>
      </aside>

      <div className="flex items-center justify-center bg-paper px-6 py-12">
        <div className="w-full max-w-[23rem]">
          <div className="mb-8 lg:hidden">
            <Wordmark />
          </div>

          <p className="label-caps">Sign up</p>
          <h1 className="mt-2 font-display text-[28px] leading-tight font-normal tracking-[-0.01em] text-ink">
            Create an account
          </h1>
          <p className="mt-2 mb-7 text-[13px] text-ink-3">
            This creates a customer portal login. Staff accounts are issued by an
            administrator.
          </p>

          <SignUpForm />

          <p className="mt-7 text-[12.5px] text-ink-3">
            Already have an account?{" "}
            <Link href="/sign-in" className="text-walnut hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
