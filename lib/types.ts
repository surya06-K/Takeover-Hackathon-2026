/** Entry types a register row can carry — this is what routes a row to its
 *  section (Udhaar / Sales / Stock) automatically, with no manual toggle. */
export type EntryType = 'credit' | 'payment' | 'sale' | 'stock_in' | 'stock_out' | null;

/** One row exactly as the vision model returns it. */
export interface ExtractedRow {
  date: string | null;
  party: string | null;
  item: string | null;
  qty: number | null;
  amount: number | null;
  type: EntryType;
  raw_text: string;
}

/** The strict JSON contract both vision models must honour. */
export interface ExtractResult {
  register_type: string;
  confidence: number;
  rows: ExtractedRow[];
  notes: string;
}

/** Which reader produced the result. */
export type ModelId = 'gemini' | 'groq' | 'sample';

export const MODEL_LABELS: Record<ModelId, string> = {
  gemini: 'Gemini 2.5 Flash',
  groq: 'Llama 4 Scout · Groq failover',
  sample: 'Sample data — no API key set',
};

/** A row once it lives in the ledger (stable id for editing). */
export interface LedgerRow extends ExtractedRow {
  id: string;
}

/** One digitized register page saved into the ledger. */
export interface LedgerPage {
  id: string;
  pageNumber: number;
  model: ModelId;
  registerType: string;
  confidence: number;
  notes: string;
  rows: LedgerRow[];
  savedAt: number;
}

/** Response shape of POST /api/extract. */
export type ExtractResponse =
  | { ok: true; model: ModelId; data: ExtractResult }
  | { ok: false; error: string; detail?: string };

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
