import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Sparkles, Trash2 } from "lucide-react";

import { Money } from "@/components/ui/money";
import {
  Badge,
  Button,
  EmptyState,
  PageHeader,
  Panel,
  PanelHeader,
  Table,
  Td,
  Th,
} from "@/components/ui/primitives";
import { FormError } from "@/components/ui/form";
import { formatDate } from "@/lib/app-context";
import { prisma } from "@/lib/db";
import { AUTO_MATCH_MIN_CONFIDENCE } from "@/lib/reconciliation/matcher";
import {
  clearStatementAction,
  currentMatches,
  matchLineAction,
  reconcileAllAction,
} from "./actions";
import { ImportStatementForm } from "./import-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Bank Reconciliation" };

function ConfidenceBadge({ value }: { value: number }) {
  const tone = value >= AUTO_MATCH_MIN_CONFIDENCE ? "paid" : value >= 60 ? "partial" : "unpaid";
  return <Badge tone={tone}>{value}%</Badge>;
}

export default async function ReconcilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; settled?: string }>;
}) {
  const { error, settled } = await searchParams;

  const [matches, matchedCount] = await Promise.all([
    currentMatches(),
    prisma.bankStatementLine.count({ where: { state: "MATCHED" } }),
  ]);

  const autoReady = matches.filter((m) => m.autoMatch).length;
  const needsHelp = matches.length - autoReady;

  return (
    <>
      <PageHeader
        eyebrow="Accounting"
        title="Bank Reconciliation"
        description="The bank statement is the one document that arrives from outside the system, written by someone who has never heard of your invoice numbering. Reconciling it means deciding, for each line, which open document that money is."
        actions={
          matches.length > 0 ? (
            <div className="flex items-center gap-2">
              <form action={clearStatementAction}>
                <Button type="submit">
                  <Trash2 className="h-3.5 w-3.5" />
                  Discard unmatched
                </Button>
              </form>
              {autoReady > 0 ? (
                <form action={reconcileAllAction}>
                  <Button type="submit" variant="primary">
                    <Sparkles className="h-3.5 w-3.5" />
                    Reconcile {autoReady} confident line{autoReady === 1 ? "" : "s"}
                  </Button>
                </form>
              ) : null}
            </div>
          ) : null
        }
      />

      {error ? (
        <div className="mb-4">
          <FormError>{decodeURIComponent(error)}</FormError>
        </div>
      ) : null}

      {settled ? (
        <div className="mb-4 rounded-md border border-line bg-surface-2 px-3 py-2 text-[12.5px] text-ink-2">
          Settled {settled} line{settled === "1" ? "" : "s"}. Each one posted a payment through the
          same engine the manual Register Payment button uses — reconciliation finds the payment, it
          never posts one a different way.
        </div>
      ) : null}

      <div className="space-y-4">
        <Panel>
          <PanelHeader
            title="Import a statement"
            subtitle={`${matchedCount} line${matchedCount === 1 ? "" : "s"} settled so far`}
          />
          <ImportStatementForm />
        </Panel>

        {matches.length === 0 ? (
          <Panel>
            <EmptyState
              title="Nothing waiting to be reconciled"
              hint="Import a bank statement above and every line will be scored against your open invoices and bills."
            />
          </Panel>
        ) : (
          <Panel>
            <PanelHeader
              title="Unmatched lines"
              subtitle={`${autoReady} confident, ${needsHelp} need a decision — scored on amount, reference, partner name and date`}
            />
            <Table>
              <thead>
                <tr>
                  <Th className="w-24">Date</Th>
                  <Th>Narration</Th>
                  <Th numeric className="w-32">
                    Amount
                  </Th>
                  <Th>Best match and why</Th>
                  <Th className="w-24">Confidence</Th>
                  <Th className="w-28" />
                </tr>
              </thead>
              <tbody>
                {matches.map(({ line, candidates, autoMatch }) => {
                  const best = autoMatch ?? candidates[0];
                  return (
                    <tr key={line.id} className="align-top">
                      <Td className="whitespace-nowrap text-ink-3">{formatDate(line.date)}</Td>
                      <Td className="font-mono text-[12px]">{line.narration}</Td>
                      <Td numeric>
                        <Money paise={line.amountPaise} />
                      </Td>
                      <Td>
                        {best ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-ink">{best.document.name}</span>
                              <span className="text-ink-3">{best.document.partnerName}</span>
                              {autoMatch ? null : (
                                <Badge tone="partial">needs a decision</Badge>
                              )}
                            </div>
                            <ul className="space-y-0.5 text-[11.5px] text-ink-3">
                              {best.signals.map((s) => (
                                <li key={s.label}>
                                  + {s.points} · {s.label}
                                </li>
                              ))}
                            </ul>
                            {candidates.length > 1 ? (
                              <p className="text-[11.5px] text-ink-3">
                                Runner-up: {candidates[1].document.name} at{" "}
                                {candidates[1].confidence}%
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-ink-3">
                            No open document matches — leave it for a manual entry.
                          </span>
                        )}
                      </Td>
                      <Td>{best ? <ConfidenceBadge value={best.confidence} /> : null}</Td>
                      <Td>
                        {best ? (
                          <div className="space-y-1">
                            {candidates.slice(0, 2).map((c) => (
                              <form key={c.document.id} action={matchLineAction}>
                                <input type="hidden" name="lineId" value={line.id} />
                                <input type="hidden" name="documentId" value={c.document.id} />
                                <input type="hidden" name="confidence" value={c.confidence} />
                                <Button type="submit" size="sm">
                                  <CheckCircle2 className="h-3 w-3" />
                                  {c.document.name}
                                </Button>
                              </form>
                            ))}
                          </div>
                        ) : null}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </Panel>
        )}
      </div>

      <p className="mt-4 max-w-3xl text-[12px] leading-relaxed text-ink-3">
        Every point of every score comes from arithmetic on the amount, a regular expression over the
        narration, or trigram similarity on the partner name — nothing is guessed, and the matcher is
        covered by unit tests you can run in a terminal. A line only clears itself when it scores{" "}
        {AUTO_MATCH_MIN_CONFIDENCE}% or more <em>and</em> is clearly ahead of the runner-up; anything
        ambiguous is handed to a human instead of resolved by a coin flip.{" "}
        <Link href="/payments/receive" className="text-walnut hover:underline">
          Payments received
        </Link>{" "}
        shows what the settlements produced.
      </p>
    </>
  );
}
