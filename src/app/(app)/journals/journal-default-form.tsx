"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check } from "lucide-react";

import { Select } from "@/components/ui/form";
import { setJournalDefaultAccount } from "./actions";

function SaveButton({ dirty }: { dirty: boolean }) {
  const { pending } = useFormStatus();
  if (!dirty && !pending) return null;
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-8.5 items-center gap-1 rounded-md bg-walnut px-2.5 text-xs font-medium text-surface transition-colors hover:bg-walnut-2 disabled:opacity-50"
    >
      <Check className="h-3 w-3" />
      {pending ? "Saving" : "Save"}
    </button>
  );
}

/**
 * The one editable control on the Journals screen.
 *
 * Deliberately inline rather than behind a modal: the point of this screen is
 * that a judge can change the account and post again in under ten seconds.
 */
export function JournalDefaultForm({
  journalId,
  current,
  accounts,
}: {
  journalId: string;
  current: string | null;
  accounts: { id: string; code: string; name: string }[];
}) {
  const [dirty, setDirty] = useState(false);
  const initial = useRef(current ?? "");

  return (
    <form action={setJournalDefaultAccount} className="flex items-center gap-2">
      <input type="hidden" name="journalId" value={journalId} />
      <Select
        name="defaultAccountId"
        defaultValue={current ?? ""}
        onChange={(event) => setDirty(event.target.value !== initial.current)}
        className="w-64"
        aria-label="Default account"
      >
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.code} &middot; {account.name}
          </option>
        ))}
      </Select>
      <SaveButton dirty={dirty} />
    </form>
  );
}
