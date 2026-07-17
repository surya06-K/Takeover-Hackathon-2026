import type { LedgerPage, LedgerRow } from './types';

export interface PartyBalance {
  party: string;
  credits: number;
  payments: number;
  balance: number;
  entries: number;
}

/** A party whose net balance reaches this many rupees gets a red flag. */
export const FLAG_THRESHOLD = 5000;

/**
 * Party-wise balances across every saved page.
 * credit + sale add to what a party owes; payment reduces it.
 * Rows without a party or an amount are excluded here (still exported).
 */
export function computeBalances(pages: LedgerPage[]): PartyBalance[] {
  const map = new Map<string, PartyBalance>();
  for (const page of pages) {
    for (const row of page.rows) {
      const party = row.party?.trim();
      if (!party || row.amount == null) continue;
      const key = party.toLowerCase();
      const entry = map.get(key) ?? {
        party,
        credits: 0,
        payments: 0,
        balance: 0,
        entries: 0,
      };
      if (row.type === 'payment') entry.payments += row.amount;
      else if (row.type === 'credit' || row.type === 'sale') entry.credits += row.amount;
      else {
        // untyped row: count it, never guess a direction
        entry.entries += 1;
        map.set(key, entry);
        continue;
      }
      entry.balance = entry.credits - entry.payments;
      entry.entries += 1;
      map.set(key, entry);
    }
  }
  return [...map.values()].sort((a, b) => b.balance - a.balance);
}

export function totalOutstanding(balances: PartyBalance[]): number {
  return balances.reduce((sum, b) => sum + Math.max(b.balance, 0), 0);
}

export function biggestDebtor(balances: PartyBalance[]): PartyBalance | null {
  const top = balances[0];
  return top && top.balance > 0 ? top : null;
}

/** Rows that carry data but no party name (kept in exports, not in balances). */
export function unassignedRowCount(pages: LedgerPage[]): number {
  let n = 0;
  for (const page of pages) {
    for (const row of page.rows) {
      if (!row.party?.trim()) n += 1;
    }
  }
  return n;
}

export function allRows(pages: LedgerPage[]): { page: LedgerPage; row: LedgerRow }[] {
  return pages.flatMap((page) => page.rows.map((row) => ({ page, row })));
}

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

export function formatINR(n: number): string {
  return `₹${inr.format(n)}`;
}
