import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { currentShopId } from '@/lib/session';

export const runtime = 'nodejs';

/** GET /api/sales — all sale entries plus quick totals for the Sales dashboard. */
export async function GET() {
  const shopId = currentShopId();
  if (!shopId) return NextResponse.json({ ok: false }, { status: 401 });

  const store = db();
  const [sales, pages] = await Promise.all([store.listSales(shopId), store.listPages(shopId)]);
  const pageNumberById = new Map(pages.map((p) => [p.id, p.pageNumber]));

  const total = sales.reduce((s, e) => s + e.amount, 0);
  const todayKey = new Date().toDateString();
  const today = sales.reduce(
    (s, e) => (new Date(e.createdAt).toDateString() === todayKey ? s + e.amount : s),
    0
  );

  return NextResponse.json({
    ok: true,
    stats: { total, today, entries: sales.length },
    entries: sales.map((e) => ({ ...e, pageNumber: e.pageId ? pageNumberById.get(e.pageId) ?? null : null })),
  });
}
