import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { formatDate } from "@/lib/app-context";
import { Badge, Detail, PageHeader, Panel, PanelHeader, Table, Td, Th } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Settings" };

/**
 * The company-wide fallbacks — the LAST rung of chains R3 and R4.
 *
 * Read-only for now: these are the accounts the engine reaches for when
 * nothing more specific is configured, and repointing them mid-demo would
 * change the meaning of every future tax and counterparty line at once.
 */
export default async function SettingsPage() {
  const session = await getSession();
  if (session?.role !== "ADMIN") redirect("/");

  // CompanySettings holds bare account ids rather than relations, so resolve
  // the names in one pass instead of four lookups.
  const [company, users, sequences, accounts] = await Promise.all([
    prisma.companySettings.findUnique({ where: { id: 1 } }),
    prisma.user.findMany({ orderBy: { name: "asc" } }),
    prisma.sequence.findMany({ orderBy: { code: "asc" } }),
    prisma.account.findMany({ select: { id: true, code: true, name: true } }),
  ]);

  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const named = (id: string | null | undefined) => (id ? accountById.get(id) : undefined);

  const fallbacks = [
    ["Receivable", "R4.2", named(company?.defaultReceivableAccountId)],
    ["Payable", "R4.2", named(company?.defaultPayableAccountId)],
    ["Tax collected (output)", "R3.2", named(company?.defaultTaxCollectedAccountId)],
    ["Tax paid (input)", "R3.2", named(company?.defaultTaxPaidAccountId)],
    ["Current year earnings", "Balance Sheet", named(company?.currentYearEarningsAccountId)],
    ["Retained earnings", "Balance Sheet", named(company?.retainedEarningsAccountId)],
  ] as const;

  return (
    <>
      <PageHeader
        eyebrow="Configuration"
        title="Settings"
        description="Company-wide defaults, users and document numbering."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Company" />
          <dl className="grid grid-cols-2 gap-4 px-4 py-4">
            <Detail label="Name">{company?.name ?? "\u2014"}</Detail>
            <Detail label="Currency">{company?.currency ?? "INR"}</Detail>
            <Detail label="Fiscal year starts">
              {
                [
                  "January",
                  "February",
                  "March",
                  "April",
                  "May",
                  "June",
                  "July",
                  "August",
                  "September",
                  "October",
                  "November",
                  "December",
                ][(company?.fiscalYearStartMonth ?? 4) - 1]
              }
            </Detail>
            <Detail label="Books locked to">
              {company?.lockDate ? formatDate(company.lockDate) : "Not locked"}
            </Detail>
          </dl>
          <p className="border-t border-rule px-4 py-2.5 text-[11.5px] leading-relaxed text-ink-3">
            The lock date is enforced inside the posting engine: no entry may be dated on or before
            it, which is how a closed period stays closed.
          </p>
        </Panel>

        <Panel>
          <PanelHeader
            title="Fallback accounts"
            subtitle="The last rung of chains R3 and R4"
          />
          <Table>
            <thead>
              <tr>
                <Th>Role</Th>
                <Th className="w-32">Used by</Th>
                <Th>Account</Th>
              </tr>
            </thead>
            <tbody>
              {fallbacks.map(([role, rung, account]) => (
                <tr key={role}>
                  <Td className="font-medium text-ink">{role}</Td>
                  <Td>
                    <Badge tone="neutral">{rung}</Badge>
                  </Td>
                  <Td className="text-ink-3">
                    {account ? `${account.code} ${account.name}` : "\u2014"}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Panel>

        <Panel>
          <PanelHeader title="Users" />
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th className="w-32">Login ID</Th>
                <Th className="w-32">Role</Th>
                <Th className="w-32">Last signed in</Th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <Td className="font-medium text-ink">{user.name}</Td>
                  <Td className="tnum text-ink-3">{user.loginId}</Td>
                  <Td>
                    <Badge tone={user.role === "ADMIN" ? "posted" : "neutral"}>{user.role}</Badge>
                  </Td>
                  <Td className="text-ink-3">
                    {user.lastLoginAt ? formatDate(user.lastLoginAt) : "Never"}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Panel>

        <Panel>
          <PanelHeader
            title="Document numbering"
            subtitle="Allocated at Confirm, inside the posting transaction"
          />
          <Table>
            <thead>
              <tr>
                <Th>Sequence</Th>
                <Th className="w-24">Prefix</Th>
                <Th numeric className="w-20">
                  Year
                </Th>
                <Th numeric className="w-24">
                  Next
                </Th>
              </tr>
            </thead>
            <tbody>
              {sequences.map((sequence) => (
                <tr key={sequence.id}>
                  <Td className="font-medium text-ink">{sequence.code}</Td>
                  <Td className="tnum text-ink-3">{sequence.prefix}</Td>
                  <Td numeric className="tnum text-ink-3">
                    {sequence.fiscalYear}
                  </Td>
                  <Td numeric className="tnum">
                    {sequence.nextNumber}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <p className="border-t border-rule px-4 py-2.5 text-[11.5px] leading-relaxed text-ink-3">
            A draft that is never confirmed burns no number, and a failed post rolls the counter
            back with the rest of the transaction. That is what makes the numbering gapless.
          </p>
        </Panel>
      </div>
    </>
  );
}
