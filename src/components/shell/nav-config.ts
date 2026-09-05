/**
 * The navigation, grouped the way the mockup's menu is grouped.
 *
 * Purchase and Sales come first because that is where the day's work happens;
 * Accounting and Reports sit below because they are consequences of it.
 */
export interface NavItem {
  href: string;
  label: string;
  /** Exact match only — for index routes that would otherwise match children. */
  exact?: boolean;
  adminOnly?: boolean;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export const NAV: NavSection[] = [
  {
    label: "Overview",
    items: [{ href: "/", label: "Dashboard", exact: true }],
  },
  {
    label: "Purchase",
    items: [
      { href: "/purchase-orders", label: "Purchase Orders" },
      { href: "/bills", label: "Vendor Bills" },
      { href: "/payments/send", label: "Payments Made" },
    ],
  },
  {
    label: "Sales",
    items: [
      { href: "/sales-orders", label: "Sales Orders" },
      { href: "/invoices", label: "Customer Invoices" },
      { href: "/payments/receive", label: "Payments Received" },
    ],
  },
  {
    label: "Accounting",
    items: [
      { href: "/journal-entries", label: "Journal Entries" },
      { href: "/reconcile", label: "Bank Reconciliation" },
      { href: "/accounts", label: "Chart of Accounts" },
      { href: "/journals", label: "Journals" },
      { href: "/taxes", label: "Taxes" },
    ],
  },
  {
    label: "Master Data",
    items: [
      { href: "/contacts", label: "Contacts" },
      { href: "/products", label: "Products" },
      { href: "/analytics", label: "Analytic Accounts" },
      { href: "/budgets", label: "Budgets" },
    ],
  },
  {
    label: "Reports",
    items: [
      { href: "/reports/balance-sheet", label: "Balance Sheet" },
      { href: "/reports/profit-loss", label: "Profit & Loss" },
      { href: "/reports/trial-balance", label: "Trial Balance" },
      { href: "/reports/partner-ledger", label: "Partner Ledger" },
      { href: "/reports/budget", label: "Budget vs Actual" },
      { href: "/reports/integrity", label: "Books Integrity" },
    ],
  },
  {
    label: "Configuration",
    items: [{ href: "/settings", label: "Settings", adminOnly: true }],
  },
];
