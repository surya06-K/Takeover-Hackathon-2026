/** Which section of the app a scanned page's entries belong in. */
export type Section = 'udhaar' | 'sales' | 'stock';

export const SECTION_LABELS: Record<Section, string> = {
  udhaar: 'Udhaar / Credit Ledger',
  sales: 'Sales / Bill Book',
  stock: 'Stock Register',
};

const KEYWORDS: { section: Section; re: RegExp }[] = [
  // order matters: check stock/sales before the broad udhaar fallback
  { section: 'stock', re: /stock|inventory|godown|store\s*register|warehouse/i },
  { section: 'sales', re: /sale|bill|invoice|memo|cash\s*receipt|receipt\s*book/i },
  { section: 'udhaar', re: /udhaar|udhar|credit|khata|ledger|due|account/i },
];

/**
 * The AI returns free text for register_type ("Credit Account", "Bill Book",
 * "स्टॉक रजिस्टर"...). Normalize it to one of our three sections so the app
 * knows where a scanned page's rows actually belong. Defaults to 'udhaar'
 * (the most common paper register) when nothing matches.
 */
export function normalizeSection(raw: string | null | undefined): Section {
  const text = (raw ?? '').trim();
  if (!text) return 'udhaar';
  for (const { section, re } of KEYWORDS) {
    if (re.test(text)) return section;
  }
  return 'udhaar';
}

export function isSection(v: unknown): v is Section {
  return v === 'udhaar' || v === 'sales' || v === 'stock';
}
