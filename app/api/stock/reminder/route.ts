import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { stockItemKey } from '@/lib/db/types';
import { currentShopId } from '@/lib/session';

export const runtime = 'nodejs';

/** POST /api/stock/reminder — set { item, minQty } reminder level; minQty null clears it. */
export async function POST(req: Request) {
  const shopId = currentShopId();
  if (!shopId) return NextResponse.json({ ok: false }, { status: 401 });

  let body: { item?: unknown; minQty?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const item = typeof body.item === 'string' ? body.item.trim() : '';
  const minQty =
    body.minQty == null ? null : typeof body.minQty === 'number' ? body.minQty : NaN;
  if (!item || (minQty != null && (!Number.isFinite(minQty) || minQty < 0))) {
    return NextResponse.json(
      { ok: false, error: 'item and a non-negative minQty (or null to clear) are required' },
      { status: 400 }
    );
  }

  await db().setStockReminder(shopId, stockItemKey(item), minQty);
  return NextResponse.json({ ok: true });
}
