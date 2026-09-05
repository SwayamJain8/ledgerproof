"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";

import { Wordmark } from "@/components/wordmark";
import { cn } from "@/components/ui/cn";
import { NAV } from "./nav-config";

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavList({ role, onNavigate }: { role: string; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    // min-h-0 is load-bearing: without it a flex child refuses to shrink below
    // its content height and the last nav items hide behind the user footer.
    <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
      {NAV.map((section) => {
        const items = section.items.filter((item) => !item.adminOnly || role === "ADMIN");
        if (items.length === 0) return null;

        return (
          <div key={section.label} className="mt-3.5 first:mt-1">
            <p className="px-2.5 pb-1 text-[9.5px] font-semibold tracking-[0.16em] text-paper/28 uppercase">
              {section.label}
            </p>
            <ul>
              {items.map((item) => {
                const active = isActive(pathname, item.href, item.exact);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative flex items-center rounded-md px-2.5 py-[5px] text-[12.5px] transition-colors",
                        active
                          ? "bg-oak-3/60 font-medium text-paper"
                          : "text-paper/55 hover:bg-oak-2 hover:text-paper/90",
                      )}
                    >
                      {/* Brass tab on the active row — the one bright accent. */}
                      <span
                        className={cn(
                          "absolute top-1/2 -left-3 h-4 w-[2.5px] -translate-y-1/2 rounded-r-full bg-brass transition-opacity",
                          active ? "opacity-100" : "opacity-0",
                        )}
                      />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

export function Sidebar({ role, footer }: { role: string; footer: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed top-3 left-3 z-40 rounded-md border border-rule-2 bg-surface p-2 text-ink-2 lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-4 w-4" />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-40 bg-oak/40 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-oak transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex shrink-0 items-center justify-between px-5 pt-4 pb-3 text-paper">
          <Link href="/" onClick={() => setOpen(false)}>
            <Wordmark subdued />
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded p-1 text-paper/50 hover:text-paper lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <NavList role={role} onNavigate={() => setOpen(false)} />

        <div className="shrink-0 border-t border-paper/10 bg-oak p-3">{footer}</div>
      </aside>
    </>
  );
}
