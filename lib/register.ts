/** Which section of the app a scanned page's entries belong in. */
export type Section = 'udhaar' | 'sales' | 'stock';

export const SECTION_LABELS: Record<Section, string> = {
  udhaar: 'Udhaar / Credit Ledger',
  sales: 'Sales / Bill Book',
  stock: 'Stock Register',
};

export function isSection(v: unknown): v is Section {
  return v === 'udhaar' || v === 'sales' || v === 'stock';
}
