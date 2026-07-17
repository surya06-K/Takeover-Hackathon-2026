import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { uid } from '@/lib/types';
import {
  computeBalanceFields,
  type KaagazStore,
  type Party,
  type PartyWithBalance,
  type ScanPage,
  type Shop,
  type Txn,
} from './types';

/**
 * Supabase-backed store. Uses the service-role key, server-side only —
 * these modules are imported exclusively from API routes.
 * Schema: see supabase/schema.sql (paste into the Supabase SQL editor once).
 */

let client: SupabaseClient | null = null;

export function supabaseConfigured(): boolean {
  return Boolean(
    (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL) &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
}

function sb(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

/* Row mappers (snake_case DB -> camelCase domain) */

const mapShop = (r: any): Shop => ({
  id: r.id,
  phone: r.phone,
  name: r.name,
  createdAt: r.created_at,
});

const mapParty = (r: any): Party => ({
  id: r.id,
  shopId: r.shop_id,
  name: r.name,
  phone: r.phone,
  nameVariants: r.name_variants ?? [],
  createdAt: r.created_at,
});

const mapTxn = (r: any): Txn => ({
  id: r.id,
  shopId: r.shop_id,
  partyId: r.party_id,
  type: r.type,
  amount: Number(r.amount),
  item: r.item,
  txnDate: r.txn_date,
  rawText: r.raw_text,
  pageId: r.page_id,
  createdAt: r.created_at,
});

const mapPage = (r: any): ScanPage => ({
  id: r.id,
  shopId: r.shop_id,
  pageNumber: r.page_number,
  model: r.model,
  registerType: r.register_type,
  confidence: Number(r.confidence),
  notes: r.notes ?? '',
  rowCount: r.row_count,
  createdAt: r.created_at,
});

function fail(op: string, error: { message: string } | null): never {
  throw new Error(`supabase ${op}: ${error?.message ?? 'unknown error'}`);
}

export const supabaseStore: KaagazStore = {
  kind: 'supabase',

  async getShopByPhone(phone) {
    const { data, error } = await sb().from('shops').select('*').eq('phone', phone).maybeSingle();
    if (error) fail('getShopByPhone', error);
    return data ? mapShop(data) : null;
  },
  async createShop(phone, name) {
    const row = { id: uid(), phone, name };
    const { data, error } = await sb().from('shops').insert(row).select().single();
    if (error || !data) fail('createShop', error);
    return mapShop(data);
  },
  async getShop(id) {
    const { data, error } = await sb().from('shops').select('*').eq('id', id).maybeSingle();
    if (error) fail('getShop', error);
    return data ? mapShop(data) : null;
  },

  async listParties(shopId) {
    const [{ data: parties, error: pe }, { data: txns, error: te }] = await Promise.all([
      sb().from('parties').select('*').eq('shop_id', shopId),
      sb().from('transactions').select('*').eq('shop_id', shopId),
    ]);
    if (pe) fail('listParties.parties', pe);
    if (te) fail('listParties.txns', te);
    const allTxns = (txns ?? []).map(mapTxn);
    return (parties ?? [])
      .map((raw): PartyWithBalance => {
        const p = mapParty(raw);
        return { ...p, ...computeBalanceFields(allTxns.filter((t) => t.partyId === p.id)) };
      })
      .sort((a, b) => b.balance - a.balance);
  },
  async getParty(shopId, partyId) {
    const { data, error } = await sb()
      .from('parties')
      .select('*')
      .eq('shop_id', shopId)
      .eq('id', partyId)
      .maybeSingle();
    if (error) fail('getParty', error);
    return data ? mapParty(data) : null;
  },
  async createParty(shopId, name, phone = null) {
    const row = {
      id: uid(),
      shop_id: shopId,
      name: name.trim(),
      phone: phone?.trim() || null,
      name_variants: [] as string[],
    };
    const { data, error } = await sb().from('parties').insert(row).select().single();
    if (error || !data) fail('createParty', error);
    return mapParty(data);
  },
  async addNameVariant(shopId, partyId, variant) {
    const party = await this.getParty(shopId, partyId);
    if (!party || party.name === variant || party.nameVariants.includes(variant)) return;
    const { error } = await sb()
      .from('parties')
      .update({ name_variants: [...party.nameVariants, variant] })
      .eq('id', partyId)
      .eq('shop_id', shopId);
    if (error) fail('addNameVariant', error);
  },

  async listTxns(shopId, partyId) {
    let q = sb().from('transactions').select('*').eq('shop_id', shopId);
    if (partyId) q = q.eq('party_id', partyId);
    const { data, error } = await q.order('created_at', { ascending: false });
    if (error) fail('listTxns', error);
    return (data ?? []).map(mapTxn);
  },
  async addTxn(shopId, input) {
    const row = {
      id: uid(),
      shop_id: shopId,
      party_id: input.partyId,
      type: input.type,
      amount: input.amount,
      item: input.item ?? null,
      txn_date: input.txnDate ?? null,
      raw_text: input.rawText ?? null,
      page_id: input.pageId ?? null,
    };
    const { data, error } = await sb().from('transactions').insert(row).select().single();
    if (error || !data) fail('addTxn', error);
    return mapTxn(data);
  },

  async addPage(shopId, page) {
    const { count, error: ce } = await sb()
      .from('pages')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', shopId);
    if (ce) fail('addPage.count', ce);
    const row = {
      id: uid(),
      shop_id: shopId,
      page_number: (count ?? 0) + 1,
      model: page.model,
      register_type: page.registerType,
      confidence: page.confidence,
      notes: page.notes,
      row_count: page.rowCount,
    };
    const { data, error } = await sb().from('pages').insert(row).select().single();
    if (error || !data) fail('addPage', error);
    return mapPage(data);
  },
  async listPages(shopId) {
    const { data, error } = await sb()
      .from('pages')
      .select('*')
      .eq('shop_id', shopId)
      .order('page_number', { ascending: true });
    if (error) fail('listPages', error);
    return (data ?? []).map(mapPage);
  },
};
