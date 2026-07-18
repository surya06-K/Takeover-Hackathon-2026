import { uid } from '@/lib/types';
import {
  computeBalanceFields,
  type KaagazStore,
  type NewTxnInput,
  type Party,
  type PartyWithBalance,
  type SaleEntry,
  type ScanPage,
  type Shop,
  type StockEntry,
  type StockReminder,
  type Txn,
} from './types';

/**
 * In-process fallback store so the app runs with zero configuration.
 * Fine for local dev / offline demo (single Node process); NOT durable on
 * serverless — add Supabase keys for the deployed app.
 */
interface MemState {
  shops: Shop[];
  parties: Party[];
  txns: Txn[];
  pages: ScanPage[];
  sales: SaleEntry[];
  stock: StockEntry[];
  stockReminders: StockReminder[];
}

// Survive Next.js dev HMR by hanging state off globalThis.
const g = globalThis as unknown as { __kaagazMem?: MemState };
const state: MemState = (g.__kaagazMem ??= {
  shops: [],
  parties: [],
  txns: [],
  pages: [],
  sales: [],
  stock: [],
  stockReminders: [],
});
// Older HMR snapshots may predate the reminders array.
state.stockReminders ??= [];

const now = () => new Date().toISOString();

export const memoryStore: KaagazStore = {
  kind: 'memory',

  async getShopByPhone(phone) {
    return state.shops.find((s) => s.phone === phone) ?? null;
  },
  async createShop(phone, name) {
    const shop: Shop = { id: uid(), phone, name, createdAt: now() };
    state.shops.push(shop);
    return shop;
  },
  async getShop(id) {
    return state.shops.find((s) => s.id === id) ?? null;
  },

  async listParties(shopId) {
    return state.parties
      .filter((p) => p.shopId === shopId)
      .map((p): PartyWithBalance => {
        const txns = state.txns.filter((t) => t.shopId === shopId && t.partyId === p.id);
        return { ...p, ...computeBalanceFields(txns) };
      })
      .sort((a, b) => b.balance - a.balance);
  },
  async getParty(shopId, partyId) {
    return state.parties.find((p) => p.shopId === shopId && p.id === partyId) ?? null;
  },
  async createParty(shopId, name, phone = null) {
    const party: Party = {
      id: uid(),
      shopId,
      name: name.trim(),
      phone: phone?.trim() || null,
      nameVariants: [],
      createdAt: now(),
    };
    state.parties.push(party);
    return party;
  },
  async addNameVariant(shopId, partyId, variant) {
    const p = state.parties.find((x) => x.shopId === shopId && x.id === partyId);
    if (p && !p.nameVariants.includes(variant) && p.name !== variant) p.nameVariants.push(variant);
  },

  async listTxns(shopId, partyId) {
    return state.txns
      .filter((t) => t.shopId === shopId && (!partyId || t.partyId === partyId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async addTxn(shopId, input: NewTxnInput) {
    const txn: Txn = {
      id: uid(),
      shopId,
      partyId: input.partyId,
      type: input.type,
      amount: input.amount,
      item: input.item ?? null,
      txnDate: input.txnDate ?? null,
      rawText: input.rawText ?? null,
      pageId: input.pageId ?? null,
      createdAt: now(),
    };
    state.txns.push(txn);
    return txn;
  },

  async addPage(shopId, page) {
    const scan: ScanPage = {
      ...page,
      id: uid(),
      shopId,
      pageNumber: state.pages.filter((p) => p.shopId === shopId).length + 1,
      createdAt: now(),
    };
    state.pages.push(scan);
    return scan;
  },
  async listPages(shopId) {
    return state.pages
      .filter((p) => p.shopId === shopId)
      .sort((a, b) => a.pageNumber - b.pageNumber);
  },

  async addSaleEntries(shopId, entries) {
    const saved = entries.map((e): SaleEntry => ({ ...e, id: uid(), shopId, createdAt: now() }));
    state.sales.push(...saved);
    return saved;
  },
  async listSales(shopId) {
    return state.sales
      .filter((s) => s.shopId === shopId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async addStockEntries(shopId, entries) {
    const saved = entries.map((e): StockEntry => ({ ...e, id: uid(), shopId, createdAt: now() }));
    state.stock.push(...saved);
    return saved;
  },
  async listStock(shopId) {
    return state.stock
      .filter((s) => s.shopId === shopId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async listStockReminders(shopId) {
    return state.stockReminders.filter((r) => r.shopId === shopId);
  },
  async setStockReminder(shopId, itemKey, minQty) {
    const existing = state.stockReminders.find(
      (r) => r.shopId === shopId && r.itemKey === itemKey
    );
    if (minQty == null) {
      if (existing) state.stockReminders.splice(state.stockReminders.indexOf(existing), 1);
      return;
    }
    if (existing) {
      existing.minQty = minQty;
      existing.updatedAt = now();
    } else {
      state.stockReminders.push({ shopId, itemKey, minQty, updatedAt: now() });
    }
  },
};
