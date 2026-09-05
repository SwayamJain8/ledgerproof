import "dotenv/config";
import { prisma } from "../src/lib/db";

prisma.vendorBill
  .findMany({
    where: { billReference: "E2E-TEST-001" },
    select: { id: true, name: true, state: true, totalPaise: true },
  })
  .then((rows) => {
    console.log(`rows: ${rows.length}`);
    for (const row of rows) {
      console.log(`  ${row.state}  ${row.name}  ${row.totalPaise} paise`);
    }
  })
  .finally(() => prisma.$disconnect());
