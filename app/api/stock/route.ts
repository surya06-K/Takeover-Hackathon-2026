import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { stockItemKey } from '@/lib/db/types';
import { currentShopId } from '@/lib/session';

export const runtime = 'nodejs';

interface ItemAgg {
  item: string;
  in: number;
  out: number;
  net: number;
  movements: number;
  /** Reminder level — remind when net falls to or below this. Null = no reminder set. */
  minQty: number | null;
  needsRestock: boolean;
}

/** GET /api/stock — net quantity per item (with reminder levels), plus the raw movement list. */
export async function GET() {
  const shopId = currentShopId();
  if (!shopId) return NextResponse.json({ ok: false }, { status: 401 });

  const store = db();
  const [stock, pages, reminders] = await Promise.all([
    store.listStock(shopId),
    store.listPages(shopId),
    store.listStockReminders(shopId),
  ]);
  const pageNumberById = new Map(pages.map((p) => [p.id, p.pageNumber]));
  const reminderByKey = new Map(reminders.map((r) => [r.itemKey, r.minQty]));

  const byItem = new Map<string, ItemAgg>();
  for (const e of stock) {
    const key = stockItemKey(e.item);
    const agg =
      byItem.get(key) ??
      { item: e.item.trim(), in: 0, out: 0, net: 0, movements: 0, minQty: null, needsRestock: false };
    if (e.direction === 'in') agg.in += e.qty;
    else agg.out += e.qty;
    agg.net = agg.in - agg.out;
    agg.movements += 1;
    byItem.set(key, agg);
  }
  for (const [key, agg] of byItem) {
    agg.minQty = reminderByKey.get(key) ?? null;
    // No explicit reminder still warns at zero — running out is always worth a nudge.
    agg.needsRestock = agg.net <= (agg.minQty ?? 0);
  }
  const items = [...byItem.values()].sort((a, b) => a.item.localeCompare(b.item));
  const restock = items.filter((i) => i.needsRestock);

  return NextResponse.json({
    ok: true,
    stats: {
      itemCount: items.length,
      lowStockCount: items.filter((i) => i.net <= 0).length,
      restockCount: restock.length,
      movementCount: stock.length,
    },
    items,
    entries: stock.map((e) => ({ ...e, pageNumber: e.pageId ? pageNumberById.get(e.pageId) ?? null : null })),
  });
}

/** POST /api/stock — manual stock movement { item, qty, direction } (no scan needed). */
export async function POST(req: Request) {
  const shopId = currentShopId();
  if (!shopId) return NextResponse.json({ ok: false }, { status: 401 });

  let body: { item?: unknown; qty?: unknown; direction?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const item = typeof body.item === 'string' ? body.item.trim() : '';
  const qty = typeof body.qty === 'number' ? body.qty : NaN;
  const direction = body.direction === 'in' || body.direction === 'out' ? body.direction : null;
  if (!item || !Number.isFinite(qty) || qty <= 0 || !direction) {
    return NextResponse.json(
      { ok: false, error: 'item, positive qty and direction (in/out) are required' },
      { status: 400 }
    );
  }

  const [entry] = await db().addStockEntries(shopId, [
    { pageId: null, item, qty, direction, amount: null, txnDate: null, rawText: 'manual' },
  ]);
  return NextResponse.json({ ok: true, entry });
}
