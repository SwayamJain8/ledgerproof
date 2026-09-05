import type { Metadata } from "next";

import { Wordmark } from "@/components/wordmark";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* ── The showroom side. Stained oak, brass rules, and the one sentence
             that says what this system actually is. ── */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-oak p-12 text-paper lg:flex">
        {/* Grain: a set of vertical hairlines, like quarter-sawn timber. */}
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
            Every rupee that moves through the showroom, written down twice.
          </p>
          <p className="mt-6 max-w-md text-[14px] leading-relaxed text-paper/55">
            Orders, bills, invoices and payments all post to one ledger. The
            Balance Sheet, the P&amp;L and every budget figure are derived from
            it — never typed, never cached, never guessed.
          </p>
        </div>

        <dl className="relative grid grid-cols-3 gap-6 border-t border-paper/12 pt-6">
          {[
            ["Double entry", "Debits equal credits, or it does not commit"],
            ["Append only", "Posted entries are cancelled by reversal"],
            ["Config driven", "Accounts resolved from settings, not code"],
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

      {/* ── The desk side. ── */}
      <div className="flex items-center justify-center bg-paper px-6 py-12">
        <div className="w-full max-w-[23rem]">
          <div className="mb-8 lg:hidden">
            <Wordmark />
          </div>

          <p className="label-caps">Sign in</p>
          <h1 className="mt-2 font-display text-[28px] leading-tight font-normal tracking-[-0.01em] text-ink">
            Welcome back
          </h1>
          <p className="mt-2 mb-7 text-[13px] text-ink-3">
            Use the login ID issued to you by your administrator.
          </p>

          <SignInForm next={next} />

          {/* Judges and demo viewers should not have to hunt for credentials. */}
          <div className="mt-8 rounded-md border border-dashed border-rule-2 bg-surface-2 px-3.5 py-3">
            <p className="label-caps mb-2">Demo access</p>
            <dl className="space-y-1 text-[12px] text-ink-2">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-3">Administrator</dt>
                <dd className="tnum">
                  adminuf <span className="text-ink-4">/</span> Admin@2026x
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-3">Accountant</dt>
                <dd className="tnum">
                  priyaacc <span className="text-ink-4">/</span> Priya@2026x
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </main>
  );
}
