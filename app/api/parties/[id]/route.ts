import { NextResponse } from 'next/server';
import { computeBalanceFields, db } from '@/lib/db';
import { currentShopId } from '@/lib/session';

export const runtime = 'nodejs';

/** GET /api/parties/:id — profile + full transaction timeline. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const shopId = currentShopId();
  if (!shopId) return NextResponse.json({ ok: false }, { status: 401 });

  const store = db();
  const party = await store.getParty(shopId, params.id);
  if (!party) return NextResponse.json({ ok: false, error: 'Party not found.' }, { status: 404 });

  const txns = await store.listTxns(shopId, party.id);
  const pages = await store.listPages(shopId);
  const pageNumberById = new Map(pages.map((p) => [p.id, p.pageNumber]));

  return NextResponse.json({
    ok: true,
    party,
    stats: computeBalanceFields(txns),
    txns: txns.map((t) => ({ ...t, pageNumber: t.pageId ? pageNumberById.get(t.pageId) ?? null : null })),
  });
}
