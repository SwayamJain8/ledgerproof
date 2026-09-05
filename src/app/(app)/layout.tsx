import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { trialBalance } from "@/lib/reports/ledger";
import { currentFiscalYear, formatDate, today } from "@/lib/app-context";
import { Sidebar } from "@/components/shell/sidebar";
import { UserMenu } from "@/components/shell/user-menu";
import { LedgerPulse } from "@/components/shell/ledger-pulse";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) {
    console.error("[DIAG] layout: session null");
    redirect("/sign-in");
  }

  const fy = currentFiscalYear();
  const tb = await trialBalance(prisma, today());
  const company = await prisma.companySettings.findUnique({ where: { id: 1 } });

  return (
    <div className="min-h-dvh lg:pl-60">
      <Sidebar role={session.role} footer={<UserMenu name={session.name} role={session.role} />} />

      {/* A slim strip rather than a full topbar. It carries the two facts that
          are true of the whole application at once: which period you are
          looking at, and whether the ledger currently balances. */}
      <header className="no-print sticky top-0 z-30 flex h-12 items-center justify-between gap-4 border-b border-rule bg-paper/85 px-5 backdrop-blur-sm lg:px-7">
        <div className="flex items-center gap-3 pl-11 lg:pl-0">
          <span className="font-display text-[13px] text-ink">
            {company?.name ?? "Urban Furniture"}
          </span>
          <span className="h-3 w-px bg-rule-2" />
          <span className="text-[12px] text-ink-3">{fy.label}</span>
          {company?.lockDate ? (
            <>
              <span className="h-3 w-px bg-rule-2" />
              <span className="text-[12px] text-ink-3">
                Locked to {formatDate(company.lockDate)}
              </span>
            </>
          ) : null}
        </div>

        <div className="flex items-center gap-4">
          <LedgerPulse
            balanced={tb.balanced}
            itemCount={tb.itemCount}
            entryCount={tb.entryCount}
          />
          <span className="hidden text-[12px] text-ink-3 sm:inline">{formatDate(today())}</span>
        </div>
      </header>

      <main className="print-full mx-auto max-w-[84rem] px-5 py-7 lg:px-7">{children}</main>
    </div>
  );
}
