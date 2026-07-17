import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { normalizePhone } from '@/lib/phone';
import { currentShopId } from '@/lib/session';

export const runtime = 'nodejs';

/** GET /api/parties?q= — parties with balances, optionally filtered by name/phone. */
export async function GET(req: Request) {
  const shopId = currentShopId();
  if (!shopId) return NextResponse.json({ ok: false }, { status: 401 });

  const q = new URL(req.url).searchParams.get('q')?.trim().toLowerCase() ?? '';
  let parties = await db().listParties(shopId);
  if (q) {
    const qDigits = q.replace(/\D/g, '');
    parties = parties.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.nameVariants.some((v) => v.toLowerCase().includes(q)) ||
        (qDigits.length >= 3 && p.phone?.includes(qDigits))
    );
  }
  return NextResponse.json({ ok: true, parties });
}

/** POST /api/parties — create a party manually. */
export async function POST(req: Request) {
  const shopId = currentShopId();
  if (!shopId) return NextResponse.json({ ok: false }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Bad request.' }, { status: 400 });
  }
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!name) return NextResponse.json({ ok: false, error: 'Name is required.' }, { status: 400 });
  const phone = body?.phone ? normalizePhone(body.phone) : null;
  if (body?.phone && !phone) {
    return NextResponse.json({ ok: false, error: 'Invalid phone number.' }, { status: 400 });
  }
  const party = await db().createParty(shopId, name, phone);
  return NextResponse.json({ ok: true, party });
}
