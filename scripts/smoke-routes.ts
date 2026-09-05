import "dotenv/config";
import { createHmac } from "node:crypto";

import { prisma } from "../src/lib/db";

/**
 * Hit every route with a valid session and report the status.
 *
 * Catches the class of bug a typecheck cannot: a Prisma query that compiles but
 * throws at runtime, or a page that renders undefined into a component.
 */
const BASE = "http://localhost:3000";

const b64url = (input: Buffer) =>
  input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function main() {
  const user = await prisma.user.findFirstOrThrow({ where: { loginId: "adminuf" } });
  const body = b64url(
    Buffer.from(
      JSON.stringify({
        userId: user.id,
        name: user.name,
        loginId: user.loginId,
        role: user.role,
        exp: Math.floor(Date.now() / 1000) + 43200,
      }),
    ),
  );
  const token = `${body}.${b64url(createHmac("sha256", process.env.SESSION_SECRET!).update(body).digest())}`;

  const [invoice, bill, payment, entry, account] = await Promise.all([
    prisma.customerInvoice.findFirst({ where: { state: "POSTED" } }),
    prisma.vendorBill.findFirst({ where: { state: "POSTED" } }),
    prisma.payment.findFirst({ where: { state: "CONFIRMED" } }),
    prisma.journalEntry.findFirst({ where: { state: "POSTED" } }),
    prisma.account.findFirst({ where: { subtype: "RECEIVABLE" } }),
  ]);

  const routes = [
    "/",
    "/purchase-orders",
    "/sales-orders",
    "/bills",
    "/bills/new",
    `/bills/${bill!.id}`,
    "/invoices",
    "/invoices/new",
    `/invoices/${invoice!.id}`,
    "/payments/send",
    "/payments/receive",
    `/payments/${payment!.id}`,
    "/journal-entries",
    `/journal-entries/${entry!.id}`,
    "/accounts",
    "/journals",
    "/taxes",
    "/contacts",
    "/products",
    "/analytics",
    "/budgets",
    "/reports/balance-sheet",
    "/reports/profit-loss",
    "/reports/trial-balance",
    "/reports/partner-ledger",
    "/reports/budget",
    "/reports/integrity",
    `/reports/ledger/${account!.id}`,
    "/settings",
  ];

  let failures = 0;
  for (const route of routes) {
    const response = await fetch(`${BASE}${route}`, {
      headers: { cookie: `uf_session=${token}` },
      redirect: "manual",
    });
    const ok = response.status === 200;
    if (!ok) failures += 1;
    console.log(`${ok ? "  ok  " : " FAIL "} ${response.status}  ${route}`);
  }

  console.log(
    failures === 0
      ? `\nAll ${routes.length} routes returned 200.`
      : `\n${failures} of ${routes.length} routes failed.`,
  );
  process.exitCode = failures === 0 ? 0 : 1;
}

main().finally(() => prisma.$disconnect());
