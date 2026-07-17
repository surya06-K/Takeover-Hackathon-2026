import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { currentShopId } from '@/lib/session';

export const runtime = 'nodejs';

export async function GET() {
  const shopId = currentShopId();
  if (!shopId) return NextResponse.json({ ok: false }, { status: 401 });
  const shop = await db().getShop(shopId);
  if (!shop) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({
    ok: true,
    shop: { id: shop.id, name: shop.name, phone: shop.phone },
    storage: db().kind,
  });
}
