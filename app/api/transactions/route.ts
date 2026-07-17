import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { currentShopId } from '@/lib/session';

export const runtime = 'nodejs';

/** POST /api/transactions — manual "+ Udhaar diya" / "₹ Payment aaya" entry. */
export async function POST(req: Request) {
  const shopId = currentShopId();
  if (!shopId) return NextResponse.json({ ok: false }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Bad request.' }, { status: 400 });
  }

  const partyId = typeof body?.partyId === 'string' ? body.partyId : '';
  const type = body?.type === 'credit' || body?.type === 'payment' ? body.type : null;
  const amount = Number(body?.amount);
  const item = typeof body?.item === 'string' && body.item.trim() ? body.item.trim() : null;

  if (!partyId || !type || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { ok: false, error: 'Party, type and a positive amount are required.' },
      { status: 400 }
    );
  }
  const store = db();
  const party = await store.getParty(shopId, partyId);
  if (!party) return NextResponse.json({ ok: false, error: 'Party not found.' }, { status: 404 });

  const txn = await store.addTxn(shopId, {
    partyId,
    type,
    amount,
    item,
    txnDate: new Date().toLocaleDateString('en-IN'),
    rawText: null, // manual entry — no handwriting behind it
    pageId: null,
  });
  return NextResponse.json({ ok: true, txn });
}
