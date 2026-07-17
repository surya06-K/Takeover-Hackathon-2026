import { NextResponse } from 'next/server';
import { normalizePhone } from '@/lib/phone';

export const runtime = 'nodejs';

/**
 * Demo OTP flow: any valid 10-digit phone gets code 123456.
 * Real SMS (Twilio/MSG91 via Supabase auth) is a config swap later —
 * the client contract stays identical, and a demo can never die on SMS.
 */
export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Bad request.' }, { status: 400 });
  }
  const phone = normalizePhone(body?.phone);
  if (!phone) {
    return NextResponse.json(
      { ok: false, error: 'Enter a valid 10-digit mobile number.' },
      { status: 400 }
    );
  }
  return NextResponse.json({ ok: true, demo: true, hint: 'Demo OTP: 123456' });
}
