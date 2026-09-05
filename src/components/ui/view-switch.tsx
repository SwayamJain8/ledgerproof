"use client";

import { useEffect, useState } from "react";
import { LayoutGrid, List } from "lucide-react";

import { cn } from "./cn";

/**
 * LIST / KANBAN VIEW SWITCH.
 *
 * The mockup does not draw a kanban for one master and stop — it says "Create
 * Kanban and List View in the same manner for Product, Analyticals", which is
 * a request for a mechanism, not three screens. So this is one component that
 * every master reuses: the page renders both views, this toggles which is
 * visible, and the choice is remembered per screen.
 *
 * Both views are server-rendered and always present in the DOM. Toggling shows
 * and hides rather than refetching, so switching is instant and there is no
 * second query.
 */
export function ViewSwitch({ storageKey }: { storageKey: string }) {
  const [view, setView] = useState<"list" | "kanban">("list");
  const [ready, setReady] = useState(false);

  // Restore the last choice for this screen. Guarded because storage throws in
  // private windows and embedded previews.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(`view:${storageKey}`);
      if (saved === "kanban" || saved === "list") setView(saved);
    } catch {
      /* keep the default */
    }
    setReady(true);
  }, [storageKey]);

  useEffect(() => {
    if (!ready) return;
    const root = document.querySelector<HTMLElement>(`[data-view-root="${storageKey}"]`);
    if (root) root.dataset.view = view;
    try {
      window.localStorage.setItem(`view:${storageKey}`, view);
    } catch {
      /* a forgotten preference is not worth an error */
    }
  }, [view, ready, storageKey]);

  const base =
    "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] transition-colors";

  return (
    <div className="flex items-center gap-1.5" role="group" aria-label="View">
      <button
        type="button"
        onClick={() => setView("list")}
        aria-pressed={view === "list"}
        className={cn(
          base,
          view === "list"
            ? "border-walnut bg-walnut/10 text-walnut"
            : "border-line text-ink-3 hover:text-ink-2",
        )}
      >
        <List className="h-3.5 w-3.5" />
        List
      </button>
      <button
        type="button"
        onClick={() => setView("kanban")}
        aria-pressed={view === "kanban"}
        className={cn(
          base,
          view === "kanban"
            ? "border-walnut bg-walnut/10 text-walnut"
            : "border-line text-ink-3 hover:text-ink-2",
        )}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        Kanban
      </button>
    </div>
  );
}

/**
 * Wraps the two views. `data-view` on the root decides which one shows, so the
 * switching is pure CSS and works before hydration.
 */
export function ViewRoot({
  storageKey,
  list,
  kanban,
}: {
  storageKey: string;
  list: React.ReactNode;
  kanban: React.ReactNode;
}) {
  return (
    <div data-view-root={storageKey} data-view="list" className="view-root">
      <div className="view-list">{list}</div>
      <div className="view-kanban">{kanban}</div>
    </div>
  );
}

/** A kanban card. Deliberately plain — the data is the interesting part. */
export function KanbanGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{children}</div>
  );
}

export function KanbanCard({
  title,
  subtitle,
  badge,
  rows,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  rows: { label: string; value: React.ReactNode }[];
}) {
  return (
    <div className="rounded-lg border border-line bg-surface p-3 transition-colors hover:border-rule-2">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-ink">{title}</p>
          {subtitle ? <p className="truncate text-[11.5px] text-ink-3">{subtitle}</p> : null}
        </div>
        {badge}
      </div>
      <dl className="space-y-1">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-3">
            <dt className="text-[11.5px] text-ink-3">{row.label}</dt>
            <dd className="text-[12.5px] text-ink-2">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
