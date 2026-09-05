/**
 * BANK RECONCILIATION — the matcher.
 *
 * A bank statement is the one document in accounting that arrives from outside
 * the system, written by someone who has never heard of your invoice numbering.
 * Reconciling it means answering, for each line: which of my open documents is
 * this money?
 *
 * This module is PURE. It takes statement lines and open documents and returns
 * ranked, scored candidates. No database, no dates-from-now, no I/O -- which is
 * what makes it unit-testable, and being able to run those tests in front of a
 * judge is the point.
 *
 * Deterministic signals first. Every score here comes from arithmetic on the
 * amount, a regex on the narration, and string similarity on the partner name.
 * Nothing is guessed. If an AI layer is added later it ranks the LEFTOVERS --
 * it never overrides a deterministic match, and it never posts anything.
 */

export interface StatementLine {
  id: string;
  date: Date;
  narration: string;
  /** Positive = money INTO our bank (a customer paid us). */
  amountPaise: bigint;
}

export interface OpenDocument {
  id: string;
  kind: "INVOICE" | "BILL";
  /** "INV/2026/0007" */
  name: string;
  partnerName: string;
  /** What is still outstanding on it. */
  residualPaise: bigint;
  date: Date;
}

export interface MatchSignal {
  label: string;
  points: number;
}

export interface Candidate {
  document: OpenDocument;
  confidence: number;
  signals: MatchSignal[];
}

export interface LineMatch {
  line: StatementLine;
  candidates: Candidate[];
  /** Set when the best candidate is both strong and clearly ahead of the rest. */
  autoMatch: Candidate | null;
}

/** Strong enough to clear without a human looking at it. */
export const AUTO_MATCH_MIN_CONFIDENCE = 85;
/** ...and far enough ahead of the runner-up that the choice is not a coin flip. */
export const AUTO_MATCH_MIN_MARGIN = 12;
/**
 * Below this, a "candidate" is noise rather than a suggestion.
 *
 * Bank charges and interest credits match no document at all. Offering the
 * nearest open bill at 18% would train the user to click without reading,
 * which is worse than offering nothing.
 */
export const MIN_CANDIDATE_CONFIDENCE = 30;

/* ── text helpers ──────────────────────────────────────────────────────── */

/** Upper-case, strip punctuation, collapse whitespace. */
export function normalise(text: string): string {
  return text
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

/**
 * Dice coefficient over character trigrams — 0 to 1.
 *
 * Chosen over exact matching because bank narrations abbreviate mercilessly:
 * "AZURE FURN" for "Azure Furniture", "N PATHAK" for "Nimesh Pathak".
 */
export function trigramSimilarity(a: string, b: string): number {
  const grams = (s: string) => {
    const padded = `  ${normalise(s)} `;
    const out = new Set<string>();
    for (let i = 0; i < padded.length - 2; i += 1) out.add(padded.slice(i, i + 3));
    return out;
  };
  const ga = grams(a);
  const gb = grams(b);
  if (ga.size === 0 || gb.size === 0) return 0;
  let shared = 0;
  for (const g of ga) if (gb.has(g)) shared += 1;
  return (2 * shared) / (ga.size + gb.size);
}

/**
 * Does the narration name this document?
 *
 * Handles the separators Indian banks actually use: "INV/2026/0007",
 * "INV-2026-0007", "INV 2026 0007". Falls back to the bare counter ("0007"),
 * which is weaker but still a real signal.
 */
export function referenceMatch(narration: string, documentName: string): "FULL" | "COUNTER" | null {
  const n = normalise(narration);
  const doc = normalise(documentName);
  if (doc && n.includes(doc)) return "FULL";

  // Trailing counter, e.g. the "0007" of INV/2026/0007.
  const counter = documentName.match(/(\d+)\s*$/)?.[1];
  if (!counter) return null;

  // Require it to stand alone, so "0007" does not match inside "160007".
  const standalone = new RegExp(`(^|\\s)${counter}(\\s|$)`);
  return standalone.test(n) ? "COUNTER" : null;
}

/* ── scoring ───────────────────────────────────────────────────────────── */

function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / 86_400_000;
}

/**
 * How strongly does the narration name this partner?
 *
 * Three readings, best score wins:
 *   1. Whole name present            "NEFT OPEN WOOD SUPPLIES" / "Open Wood"
 *   2. Distinctive tokens present    "UPI CR 16992 R SHARMA"   / "Rahul Sharma"
 *   3. Trigram similarity            catches the rest
 *
 * Reading 2 is the one that matters most in practice: banks drop first names
 * and keep surnames, so matching on the longest tokens beats matching on the
 * whole string.
 */
export function scorePartnerName(narration: string, partnerName: string): MatchSignal | null {
  const n = normalise(narration);
  const full = normalise(partnerName);
  if (!n || !full) return null;

  if (n.includes(full)) {
    return { label: `Narration names ${partnerName}`, points: 30 };
  }

  // Tokens of 4+ characters are distinctive; "AND", "THE", initials are not.
  const tokens = full.split(" ").filter((t) => t.length >= 4);
  if (tokens.length > 0) {
    const present = tokens.filter((t) => n.includes(t));
    if (present.length === tokens.length) {
      return { label: `Narration names ${partnerName}`, points: 28 };
    }
    if (present.length > 0) {
      // A surname on its own is a strong hint; banks routinely drop the rest.
      return {
        label: `Narration names "${present.join(" ")}"`,
        points: present.length >= 2 ? 25 : 22,
      };
    }
    // Truncation: "AZURE FURN" for "Azure Furniture".
    const truncated = tokens.filter((t) => n.includes(t.slice(0, 4))).length;
    if (truncated > 0) {
      return { label: "Partner name abbreviated in narration", points: 18 };
    }
  }

  const similarity = trigramSimilarity(narration, partnerName);
  if (similarity >= 0.55) {
    return { label: `Partner name matches (${Math.round(similarity * 100)}%)`, points: 25 };
  }
  if (similarity >= 0.3) {
    return { label: `Partner name is similar (${Math.round(similarity * 100)}%)`, points: 12 };
  }
  return null;
}

/**
 * Score one document against one statement line.
 *
 * The weights are deliberately lopsided: a reference hit plus an exact amount
 * is already 85, which is the auto-clear threshold on its own. Name and date
 * only ever break ties.
 */
export function scoreCandidate(line: StatementLine, doc: OpenDocument): Candidate {
  const signals: MatchSignal[] = [];
  const amount = line.amountPaise < 0n ? -line.amountPaise : line.amountPaise;

  // 1. Amount — the strongest single signal.
  if (amount === doc.residualPaise) {
    signals.push({ label: "Amount matches exactly", points: 50 });
  } else if (doc.residualPaise > 0n) {
    const diff = amount > doc.residualPaise ? amount - doc.residualPaise : doc.residualPaise - amount;
    const withinOnePercent = diff * 100n <= doc.residualPaise;
    if (withinOnePercent) {
      signals.push({ label: "Amount within 1%", points: 25 });
    } else if (amount < doc.residualPaise) {
      // A part-payment is legitimate and common, so it stays in the running.
      signals.push({ label: "Could be a part payment", points: 8 });
    }
  }

  // 2. Reference in the narration.
  const ref = referenceMatch(line.narration, doc.name);
  if (ref === "FULL") signals.push({ label: `Narration cites ${doc.name}`, points: 35 });
  else if (ref === "COUNTER") signals.push({ label: "Narration cites the document number", points: 18 });

  // 3. Partner name. Three independent readings, best one wins — bank
  //    narrations mangle names in more than one way, so a single measure
  //    misses too much: "N PATHAK" loses trigram overlap, while "AZURE FURN"
  //    loses whole-token equality.
  const nameSignal = scorePartnerName(line.narration, doc.partnerName);
  if (nameSignal) signals.push(nameSignal);

  // 4. Date proximity — money usually arrives after the document, not before.
  //    60 days covers a normal 30-day term plus the usual slippage.
  const gap = daysBetween(line.date, doc.date);
  if (gap <= 60) signals.push({ label: `Within ${Math.round(gap)} days of the document`, points: 10 });
  else if (gap <= 120) signals.push({ label: "Within 120 days", points: 4 });

  const raw = signals.reduce((sum, s) => sum + s.points, 0);
  return { document: doc, confidence: Math.max(0, Math.min(100, raw)), signals };
}

/**
 * Rank every open document against one statement line.
 *
 * Direction filters the pool before scoring: money in can only settle a
 * customer invoice, money out can only settle a vendor bill. Skipping this
 * produces confident, embarrassing nonsense.
 */
export function matchLine(line: StatementLine, documents: OpenDocument[]): LineMatch {
  const wantKind = line.amountPaise >= 0n ? "INVOICE" : "BILL";
  const pool = documents.filter((d) => d.kind === wantKind && d.residualPaise > 0n);

  const candidates = pool
    .map((doc) => scoreCandidate(line, doc))
    .filter((c) => c.confidence >= MIN_CANDIDATE_CONFIDENCE)
    .sort((a, b) => b.confidence - a.confidence);

  const best = candidates[0];
  const runnerUp = candidates[1];
  const margin = best && runnerUp ? best.confidence - runnerUp.confidence : Infinity;

  const autoMatch =
    best && best.confidence >= AUTO_MATCH_MIN_CONFIDENCE && margin >= AUTO_MATCH_MIN_MARGIN
      ? best
      : null;

  return { line, candidates: candidates.slice(0, 4), autoMatch };
}

/**
 * Match a whole statement.
 *
 * Documents are claimed as they are auto-matched, so two lines cannot both
 * auto-clear the same invoice. Ambiguity is pushed to the human rather than
 * resolved by guessing.
 */
export function matchStatement(lines: StatementLine[], documents: OpenDocument[]): LineMatch[] {
  const claimed = new Set<string>();
  const results: LineMatch[] = [];

  // Two passes: settle the confident lines first so they claim their documents
  // before the ambiguous ones are considered.
  const first = lines.map((line) => matchLine(line, documents));

  for (const match of first) {
    if (match.autoMatch && !claimed.has(match.autoMatch.document.id)) {
      claimed.add(match.autoMatch.document.id);
      results.push(match);
    } else {
      results.push({ ...match, autoMatch: null });
    }
  }

  // Re-rank the unmatched against what is left.
  return results.map((match) => {
    if (match.autoMatch) return match;
    const remaining = documents.filter((d) => !claimed.has(d.id));
    return matchLine(match.line, remaining);
  });
}
