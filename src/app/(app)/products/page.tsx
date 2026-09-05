import type { Metadata } from "next";

import { prisma } from "@/lib/db";
import { Money } from "@/components/ui/money";
import { Badge, PageHeader, Panel, Table, Td, Th } from "@/components/ui/primitives";
import { KanbanCard, KanbanGrid, ViewRoot, ViewSwitch } from "@/components/ui/view-switch";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Products" };

export default async function ProductsPage() {
  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      orderBy: [{ categoryId: "asc" }, { name: "asc" }],
      include: {
        category: { select: { name: true } },
        incomeAccount: { select: { code: true, name: true } },
        expenseAccount: { select: { code: true, name: true } },
        salesTax: { select: { name: true } },
        purchaseTax: { select: { name: true } },
      },
    }),
    prisma.productCategory.findMany({
      orderBy: { name: "asc" },
      include: {
        incomeAccount: { select: { code: true, name: true } },
        expenseAccount: { select: { code: true, name: true } },
        _count: { select: { products: true } },
      },
    }),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Master data"
        title="Products"
        description="Each product may name its own income and expense accounts — rung 2 of chains R1 and R2. Where it does not, the category is tried next, and then the journal default."
        actions={<ViewSwitch storageKey="products" />}
      />

      <div className="space-y-4">
        <ViewRoot
          storageKey="products"
          list={
        <Panel>
          <h2 className="border-b border-rule px-4 py-3 font-display text-[15px] text-ink">
            Products
          </h2>
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th className="w-28">Type</Th>
                <Th className="w-32">Category</Th>
                <Th numeric className="w-32">
                  Sales price
                </Th>
                <Th numeric className="w-32">
                  Cost
                </Th>
                <Th className="w-28">Sales tax</Th>
                <Th className="w-28">Purch. tax</Th>
                <Th className="w-44">Income a/c</Th>
                <Th className="w-44">Expense a/c</Th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="transition-colors hover:bg-surface-2">
                  <Td className="font-medium text-ink">{product.name}</Td>
                  <Td>
                    <Badge tone="neutral">{product.type}</Badge>
                  </Td>
                  <Td className="text-ink-3">{product.category?.name ?? "\u2014"}</Td>
                  <Td numeric>
                    <Money paise={product.salesPricePaise} />
                  </Td>
                  <Td numeric>
                    <Money paise={product.costPaise} />
                  </Td>
                  <Td className="text-ink-3">{product.salesTax?.name ?? "\u2014"}</Td>
                  <Td className="text-ink-3">{product.purchaseTax?.name ?? "\u2014"}</Td>
                  <Td className="text-ink-3">
                    {product.incomeAccount ? (
                      `${product.incomeAccount.code} ${product.incomeAccount.name}`
                    ) : (
                      <span className="text-ink-4 italic">Inherit</span>
                    )}
                  </Td>
                  <Td className="text-ink-3">
                    {product.expenseAccount ? (
                      `${product.expenseAccount.code} ${product.expenseAccount.name}`
                    ) : (
                      <span className="text-ink-4 italic">Inherit</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Panel>
          }
          kanban={
            <Panel>
              <KanbanGrid>
                {products.map((product) => (
                  <KanbanCard
                    key={product.id}
                    title={product.name}
                    subtitle={product.category?.name ?? undefined}
                    badge={<Badge tone="neutral">{product.type}</Badge>}
                    rows={[
                      { label: "Sells for", value: <Money paise={product.salesPricePaise} /> },
                      { label: "Costs", value: <Money paise={product.costPaise} /> },
                      {
                        label: "Income a/c",
                        value: product.incomeAccount
                          ? `${product.incomeAccount.code} ${product.incomeAccount.name}`
                          : "Inherit",
                      },
                      {
                        label: "Expense a/c",
                        value: product.expenseAccount
                          ? `${product.expenseAccount.code} ${product.expenseAccount.name}`
                          : "Inherit",
                      },
                    ]}
                  />
                ))}
              </KanbanGrid>
            </Panel>
          }
        />

        <Panel>
          <h2 className="border-b border-rule px-4 py-3 font-display text-[15px] text-ink">
            Categories
            <span className="ml-2 text-[12px] font-normal text-ink-3">
              rung 3 of the resolution chain
            </span>
          </h2>
          <Table>
            <thead>
              <tr>
                <Th>Category</Th>
                <Th numeric className="w-24">
                  Products
                </Th>
                <Th className="w-52">Income a/c</Th>
                <Th className="w-52">Expense a/c</Th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.id}>
                  <Td className="font-medium text-ink">{category.name}</Td>
                  <Td numeric className="tnum text-ink-3">
                    {category._count.products}
                  </Td>
                  <Td className="text-ink-3">
                    {category.incomeAccount ? (
                      `${category.incomeAccount.code} ${category.incomeAccount.name}`
                    ) : (
                      <span className="text-ink-4 italic">Inherit from journal</span>
                    )}
                  </Td>
                  <Td className="text-ink-3">
                    {category.expenseAccount ? (
                      `${category.expenseAccount.code} ${category.expenseAccount.name}`
                    ) : (
                      <span className="text-ink-4 italic">Inherit from journal</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Panel>
      </div>
    </>
  );
}
