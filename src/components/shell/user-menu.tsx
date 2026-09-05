"use client";

import { LogOut } from "lucide-react";

import { signOutAction } from "@/lib/auth/actions";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrator",
  ACCOUNTANT: "Accountant",
  CONTACT: "Contact",
  PORTAL: "Portal user",
};

export function UserMenu({ name, role }: { name: string; role: string }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-brass/15 text-[11px] font-semibold text-brass">
        {initials}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] leading-tight font-medium text-paper/90">{name}</p>
        <p className="truncate text-[10.5px] text-paper/40">{ROLE_LABELS[role] ?? role}</p>
      </div>
      <form action={signOutAction}>
        <button
          type="submit"
          className="rounded p-1.5 text-paper/40 transition-colors hover:bg-oak-2 hover:text-paper/80"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
}
