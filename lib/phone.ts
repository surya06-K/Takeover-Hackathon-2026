/** Normalize an Indian mobile number to bare 10 digits (strips +91 / 0 / spaces). */
export function normalizePhone(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const digits = v.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '').replace(/^0(?=\d{10}$)/, '');
  return /^\d{10}$/.test(digits) ? digits : null;
}

/** Pretty-print a 10-digit number: 98480 12345 */
export function formatPhone(p: string | null): string {
  if (!p) return '';
  return p.length === 10 ? `${p.slice(0, 5)} ${p.slice(5)}` : p;
}
