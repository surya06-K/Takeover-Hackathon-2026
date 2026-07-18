import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { stockItemKey } from '@/lib/db/types';
import { currentShopId } from '@/lib/session';

export const runtime = 'nodejs';

const FLAG_THRESHOLD = 5000;

/** GET /api/dashboard — home screen stats + recent activity. */
export async function GET() {
  const shopId = currentShopId();
  if (!shopId) return NextResponse.json({ ok: false }, { status: 401 });

  const store = db();
  const [parties, txns, pages, stock, reminders] = await Promise.all([
    store.listParties(shopId),
    store.listTxns(shopId),
    store.listPages(shopId),
    store.listStock(shopId),
    store.listStockReminders(shopId),
  ]);

  // Items at or below their reminder level (default level 0 = out of stock).
  const reminderByKey = new Map(reminders.map((r) => [r.itemKey, r.minQty]));
  const netByKey = new Map<string, { item: string; net: number }>();
  for (const e of stock) {
    const key = stockItemKey(e.item);
    const agg = netByKey.get(key) ?? { item: e.item.trim(), net: 0 };
    agg.net += e.direction === 'in' ? e.qty : -e.qty;
    netByKey.set(key, agg);
  }
  const restockItems = [...netByKey.entries()]
    .map(([key, { item, net }]) => ({ item, net, minQty: reminderByKey.get(key) ?? 0 }))
    .filter((i) => i.net <= i.minQty)
    .sort((a, b) => a.net - b.net);

  const outstanding = parties.reduce((s, p) => s + Math.max(p.balance, 0), 0);
  const flagged = parties.filter((p) => p.balance >= FLAG_THRESHOLD);
  const top = parties.find((p) => p.balance > 0) ?? null;
  const partyName = new Map(parties.map((p) => [p.id, p.name]));

  const recent = [
    ...pages.map((p) => ({
      kind: 'page' as const,
      at: p.createdAt,
      title: `Page ${p.pageNumber} scanned`,
      sub: `${p.rowCount} rows · ${p.model}`,
      amount: null as number | null,
    })),
    ...txns.slice(0, 12).map((t) => ({
      kind: t.type,
      at: t.createdAt,
      title: `${partyName.get(t.partyId) ?? 'Unknown'} — ${t.type === 'credit' ? 'udhaar' : 'paid'}`,
      sub: t.item ?? t.txnDate ?? '',
      amount: t.amount,
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 6);

  return NextResponse.json({
    ok: true,
    stats: {
      outstanding,
      flaggedCount: flagged.length,
      partyCount: parties.length,
      pageCount: pages.length,
      biggestDebtor: top ? { id: top.id, name: top.name, balance: top.balance } : null,
    },
    collectToday: flagged.slice(0, 3).map((p) => ({
      id: p.id,
      name: p.name,
      phone: p.phone,
      balance: p.balance,
      entries: p.entries,
    })),
    restock: { count: restockItems.length, items: restockItems.slice(0, 3) },
    recent,
  });
}
