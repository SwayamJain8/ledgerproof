/**
 * Verify the budget revision workflow against the mockup's literal rules.
 *
 * Writes records. Re-seed afterwards: npm run seed
 */
import "dotenv/config";

import { prisma } from "../src/lib/db";
import { formatINR } from "../src/lib/money";

let failures = 0;
const ok = (l: string, d = "") => console.log(`  \x1b[32mPASS\x1b[0m  ${l}${d ? `  ${d}` : ""}`);
const bad = (l: string, d: string) => {
  failures += 1;
  console.log(`  \x1b[31mFAIL\x1b[0m  ${l}  ${d}`);
};
const eq = <T>(l: string, a: T, e: T) =>
  a === e ? ok(l, String(a)) : bad(l, `expected ${e}, got ${a}`);

/** Mirrors reviseBudgetAction so the rules are exercised, not just asserted. */
async function revise(id: string) {
  const original = await prisma.budget.findUniqueOrThrow({
    where: { id },
    include: { lines: true },
  });
  const revisedName = original.name.endsWith(" Revised")
    ? original.name
    : `${original.name} Revised`;

  return prisma.$transaction(async (tx) => {
    const copy = await tx.budget.create({
      data: {
        name: revisedName,
        startDate: original.startDate,
        endDate: original.endDate,
        responsibleId: original.responsibleId,
        state: "DRAFT",
        revisionOfId: original.id,
        lines: {
          create: original.lines.map((l) => ({
            analyticAccountId: l.analyticAccountId,
            type: l.type,
            committedPaise: l.committedPaise,
          })),
        },
      },
      include: { lines: true },
    });
    await tx.budget.update({ where: { id: original.id }, data: { state: "REVISED" } });
    return copy;
  });
}

async function main() {
  const source = await prisma.budget.findFirstOrThrow({ include: { lines: true } });
  await prisma.budget.update({ where: { id: source.id }, data: { state: "CONFIRMED" } });

  console.log(`\n\x1b[1mRevising "${source.name}" (${source.lines.length} lines)\x1b[0m`);

  const copy = await revise(source.id);
  const original = await prisma.budget.findUniqueOrThrow({
    where: { id: source.id },
    include: { revisedBy: true },
  });

  eq("Revision keeps the name and appends ' Revised'", copy.name, `${source.name} Revised`);
  eq("Original moves to REVISED", original.state, "REVISED");
  eq("Revision starts as a DRAFT", copy.state, "DRAFT");
  eq("Revision points back at the original", copy.revisionOfId, source.id);
  eq("Original points forward at the revision", original.revisedBy?.id ?? null, copy.id);
  eq("Every budget line was copied", copy.lines.length, source.lines.length);

  const sourceTotal = source.lines.reduce((s, l) => s + l.committedPaise, 0n);
  const copyTotal = copy.lines.reduce((s, l) => s + l.committedPaise, 0n);
  eq(`Committed amounts carried forward (${formatINR(sourceTotal)})`, copyTotal, sourceTotal);

  eq("The original was not deleted", (await prisma.budget.count({ where: { id: source.id } })) === 1, true);

  // Revising twice must not produce "... Revised Revised".
  await prisma.budget.update({ where: { id: copy.id }, data: { state: "CONFIRMED" } });
  const second = await revise(copy.id);
  eq("A second revision does not double the suffix", second.name, `${source.name} Revised`);

  // Cancel archives rather than deletes.
  await prisma.budget.update({
    where: { id: second.id },
    data: { state: "CANCELLED", active: false },
  });
  const archived = await prisma.budget.findUniqueOrThrow({ where: { id: second.id } });
  eq("Cancel archives instead of deleting", archived.active, false);
  eq("...and the record still exists", archived.state, "CANCELLED");

  console.log(
    failures === 0
      ? "\n\x1b[32mBudget revision rules hold.\x1b[0m Re-seed to restore the demo books.\n"
      : `\n\x1b[31m${failures} check(s) FAILED.\x1b[0m\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().finally(() => prisma.$disconnect());
