import type { Metadata } from "next";
import { Check, X } from "lucide-react";

import { prisma } from "@/lib/db";
import { runIntegrityChecks } from "@/lib/reports/integrity";
import { formatDate, today } from "@/lib/app-context";
import { PageHeader, Panel } from "@/components/ui/primitives";
import { PrintButton } from "@/components/report-frame";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Books Integrity" };

export default async function IntegrityPage() {
  const asOf = today();
  const report = await runIntegrityChecks(prisma, asOf);
  const allPassed = report.failed === 0;

  const groups = [...new Set(report.checks.map((c) => c.group))];

  return (
    <>
      <PageHeader
        eyebrow="Reports"
        title="Books Integrity"
        description="Every invariant the system claims, re-checked against the database right now. Nothing here is cached and nothing is asserted from the code that produced it."
        actions={<PrintButton />}
      />

      {/* The verdict, first. */}
      <div
        className={`mb-4 flex flex-wrap items-center justify-between gap-4 rounded-md border px-5 py-4 ${
          allPassed ? "border-ledger/25 bg-ledger-2/60" : "border-oxide/30 bg-oxide-2"
        }`}
      >
        <div>
          <p
            className={`font-display text-[20px] leading-tight ${allPassed ? "text-ledger" : "text-oxide"}`}
          >
            {allPassed ? "The books tie out" : `${report.failed} checks failed`}
          </p>
          <p className="mt-1 text-[12.5px] text-ink-3">
            {report.passed} of {report.checks.length} checks passed, as at {formatDate(asOf)}.
          </p>
        </div>
        <p className="max-w-md text-[12px] leading-relaxed text-ink-3">
          The same assertions run headless via <code className="text-ink-2">npm run audit</code>,
          and the database enforces most of them itself through CHECK constraints and deferred
          triggers.
        </p>
      </div>

      <div className="space-y-4">
        {groups.map((group) => (
          <Panel key={group}>
            <h2 className="border-b border-rule px-4 py-2.5 font-display text-[14px] text-ink">
              {group}
            </h2>
            <ul>
              {report.checks
                .filter((check) => check.group === group)
                .map((check) => (
                  <li
                    key={check.id}
                    className="flex gap-3 border-b border-rule px-4 py-3 last:border-b-0"
                  >
                    <span
                      className={`mt-0.5 grid h-4.5 w-4.5 shrink-0 place-items-center rounded-full ${
                        check.passed ? "bg-ledger text-white" : "bg-oxide text-white"
                      }`}
                    >
                      {check.passed ? (
                        <Check className="h-3 w-3" strokeWidth={3} />
                      ) : (
                        <X className="h-3 w-3" strokeWidth={3} />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-ink">{check.title}</p>
                      <p className="mt-1 text-[12.5px] leading-relaxed text-ink-3">
                        {check.rationale}
                      </p>
                      <p className="tnum mt-1.5 text-[12px] text-ink-2">{check.evidence}</p>
                    </div>
                  </li>
                ))}
            </ul>
          </Panel>
        ))}
      </div>

      <Panel className="mt-4 p-4">
        <p className="label-caps mb-2">Enforced below the application</p>
        <p className="max-w-3xl text-[12.5px] leading-relaxed text-ink-2">
          These checks would still hold if the application were bypassed entirely. A posted entry
          that does not balance is rejected at <code className="text-ink">COMMIT</code> by a
          deferrable constraint trigger; a posted journal item cannot be updated or deleted; and a
          posted entry cannot even be demoted to draft without the audited{" "}
          <code className="text-ink">Reset to Draft</code> path, which checks admin rights, the
          period lock and outstanding payments before it unlatches the guard for a single
          transaction.
        </p>
      </Panel>
    </>
  );
}
