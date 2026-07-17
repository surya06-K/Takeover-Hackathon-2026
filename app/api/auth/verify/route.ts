import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { normalizePhone } from '@/lib/phone';
import { setSessionCookie } from '@/lib/session';

export const runtime = 'nodejs';

const DEMO_OTP = '123456';

/** Verify OTP; create the shop on first login (shopName optional after that). */
export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Bad request.' }, { status: 400 });
  }

  const phone = normalizePhone(body?.phone);
  const otp = typeof body?.otp === 'string' ? body.otp.trim() : '';
  const shopName = typeof body?.shopName === 'string' ? body.shopName.trim() : '';

  if (!phone) {
    return NextResponse.json({ ok: false, error: 'Invalid phone number.' }, { status: 400 });
  }
  if (otp !== DEMO_OTP) {
    return NextResponse.json(
      { ok: false, error: 'Wrong OTP — the demo code is 123456.' },
      { status: 401 }
    );
  }

  const store = db();
  let shop = await store.getShopByPhone(phone);
  let isNew = false;
  if (!shop) {
    if (!shopName) {
      // client shows the shop-name field and retries
      return NextResponse.json({ ok: false, needShopName: true });
    }
    shop = await store.createShop(phone, shopName);
    isNew = true;
  }

  setSessionCookie(shop.id);
  return NextResponse.json({ ok: true, isNew, shop: { id: shop.id, name: shop.name, phone: shop.phone } });
}
