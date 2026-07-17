/** Domain model for the khata (persistent ledger). */

export interface Shop {
  id: string;
  phone: string;
  name: string;
  createdAt: string;
}

export interface Party {
  id: string;
  shopId: string;
  name: string;
  phone: string | null;
  /** Alternate spellings/scripts seen for this party (e.g. "रमेश यादव", "Ramesh Yadav"). */
  nameVariants: string[];
  createdAt: string;
}

export type TxnType = 'credit' | 'payment';

export interface Txn {
  id: string;
  shopId: string;
  partyId: string;
  type: TxnType;
  amount: number;
  item: string | null;
  txnDate: string | null; // as written in the register, e.g. "06/07/2026"
  rawText: string | null; // original handwriting, preserved
  pageId: string | null; // scanned page this came from (null = manual entry)
  createdAt: string;
}

export interface ScanPage {
  id: string;
  shopId: string;
  pageNumber: number;
  model: string; // gemini | groq | sample
  registerType: string;
  confidence: number;
  notes: string;
  rowCount: number;
  createdAt: string;
}

/** Party + computed balance for lists. */
export interface PartyWithBalance extends Party {
  credits: number;
  payments: number;
  balance: number;
  entries: number;
  lastActivity: string | null;
}

export interface NewTxnInput {
  partyId: string;
  type: TxnType;
  amount: number;
  item?: string | null;
  txnDate?: string | null;
  rawText?: string | null;
  pageId?: string | null;
}

export interface CommitRowInput {
  /** Extracted row fields (post-review) */
  type: TxnType;
  amount: number;
  item: string | null;
  txnDate: string | null;
  rawText: string | null;
  /** Resolution: either an existing party id, or a new party to create. */
  partyId?: string;
  newParty?: { name: string; phone?: string | null };
  /** Name as extracted from the page — stored as a variant when it differs
   *  from an existing party's saved name (cross-script matching later). */
  extractedName?: string;
}

export interface CommitPageInput {
  model: string;
  registerType: string;
  confidence: number;
  notes: string;
  rows: CommitRowInput[];
}

export interface KaagazStore {
  readonly kind: 'memory' | 'supabase';

  // shops / auth
  getShopByPhone(phone: string): Promise<Shop | null>;
  createShop(phone: string, name: string): Promise<Shop>;
  getShop(id: string): Promise<Shop | null>;

  // parties
  listParties(shopId: string): Promise<PartyWithBalance[]>;
  getParty(shopId: string, partyId: string): Promise<Party | null>;
  createParty(shopId: string, name: string, phone?: string | null): Promise<Party>;
  addNameVariant(shopId: string, partyId: string, variant: string): Promise<void>;

  // transactions
  listTxns(shopId: string, partyId?: string): Promise<Txn[]>;
  addTxn(shopId: string, input: NewTxnInput): Promise<Txn>;

  // scanned pages
  addPage(
    shopId: string,
    page: Omit<ScanPage, 'id' | 'shopId' | 'pageNumber' | 'createdAt'>
  ): Promise<ScanPage>;
  listPages(shopId: string): Promise<ScanPage[]>;
}

export function computeBalanceFields(txns: Txn[]): {
  credits: number;
  payments: number;
  balance: number;
  entries: number;
  lastActivity: string | null;
} {
  let credits = 0;
  let payments = 0;
  for (const t of txns) {
    if (t.type === 'credit') credits += t.amount;
    else payments += t.amount;
  }
  const last = txns.length
    ? txns.reduce((a, b) => (a.createdAt > b.createdAt ? a : b)).createdAt
    : null;
  return { credits, payments, balance: credits - payments, entries: txns.length, lastActivity: last };
}
