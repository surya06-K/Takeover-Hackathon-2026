/** Domain model for the khata (persistent ledger). */
import type { Section } from '@/lib/register';

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

/** One sale row from a scanned bill book (or a manual entry). */
export interface SaleEntry {
  id: string;
  shopId: string;
  pageId: string | null;
  partyName: string | null; // free text — no party matching for sales in v1
  item: string | null;
  qty: number | null;
  amount: number;
  txnDate: string | null;
  rawText: string | null;
  createdAt: string;
}

export type StockDirection = 'in' | 'out';

/** One stock movement from a scanned stock register (or a manual entry). */
export interface StockEntry {
  id: string;
  shopId: string;
  pageId: string | null;
  item: string;
  qty: number;
  direction: StockDirection;
  amount: number | null;
  txnDate: string | null;
  rawText: string | null;
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
  /** Original as-written spelling, when the party/item cells were rewritten
   *  by the language switch — kept as a name variant on newly created parties. */
  originalName?: string;
}

export interface CommitSaleRowInput {
  partyName: string | null;
  item: string | null;
  qty: number | null;
  amount: number;
  txnDate: string | null;
  rawText: string | null;
}

export interface CommitStockRowInput {
  item: string;
  qty: number;
  direction: StockDirection;
  amount: number | null;
  txnDate: string | null;
  rawText: string | null;
}

export interface CommitPageInput {
  section: Section;
  model: string;
  registerType: string;
  confidence: number;
  notes: string;
  /** Present when section === 'udhaar' */
  rows?: CommitRowInput[];
  /** Present when section === 'sales' */
  saleRows?: CommitSaleRowInput[];
  /** Present when section === 'stock' */
  stockRows?: CommitStockRowInput[];
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

  // sales
  addSaleEntries(
    shopId: string,
    entries: Omit<SaleEntry, 'id' | 'shopId' | 'createdAt'>[]
  ): Promise<SaleEntry[]>;
  listSales(shopId: string): Promise<SaleEntry[]>;

  // stock
  addStockEntries(
    shopId: string,
    entries: Omit<StockEntry, 'id' | 'shopId' | 'createdAt'>[]
  ): Promise<StockEntry[]>;
  listStock(shopId: string): Promise<StockEntry[]>;
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
