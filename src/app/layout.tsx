import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";

import "./globals.css";

/**
 * Fraunces for display, Inter for everything else.
 *
 * Fraunces is a warm, slightly old-style serif -- it belongs on a furniture
 * showroom's letterhead, which is exactly the register this app should be in.
 * It is used for the wordmark, page titles and report headings only; running
 * UI is Inter, because a serif at 13px in a dense table is unreadable.
 */
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Urban Furniture — Accounts",
    template: "%s · Urban Furniture",
  },
  description:
    "Double-entry accounting for Urban Furniture. Orders, bills, invoices, payments and reports, all derived from one ledger.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
