import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { currentShopId } from '@/lib/session';

export const runtime = 'nodejs';

interface ItemAgg {
  item: string;
  in: number;
  out: number;
  net: number;
  movements: number;
}

/** GET /api/stock — net quantity per item, plus the raw movement list. */
export async function GET() {
  const shopId = currentShopId();
  if (!shopId) return NextResponse.json({ ok: false }, { status: 401 });

  const store = db();
  const [stock, pages] = await Promise.all([store.listStock(shopId), store.listPages(shopId)]);
  const pageNumberById = new Map(pages.map((p) => [p.id, p.pageNumber]));

  const byItem = new Map<string, ItemAgg>();
  for (const e of stock) {
    const key = e.item.trim().toLowerCase();
    const agg = byItem.get(key) ?? { item: e.item.trim(), in: 0, out: 0, net: 0, movements: 0 };
    if (e.direction === 'in') agg.in += e.qty;
    else agg.out += e.qty;
    agg.net = agg.in - agg.out;
    agg.movements += 1;
    byItem.set(key, agg);
  }
  const items = [...byItem.values()].sort((a, b) => a.item.localeCompare(b.item));
  const lowStock = items.filter((i) => i.net <= 0);

  return NextResponse.json({
    ok: true,
    stats: { itemCount: items.length, lowStockCount: lowStock.length, movementCount: stock.length },
    items,
    entries: stock.map((e) => ({ ...e, pageNumber: e.pageId ? pageNumberById.get(e.pageId) ?? null : null })),
  });
}
