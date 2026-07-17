import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

/**
 * Minimal HMAC-signed session cookie: "<base64url payload>.<hmac>".
 * Server-side only (imported from API routes / server components).
 */

const COOKIE = 'kaagaz_session';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function secret(): string {
  return process.env.SESSION_SECRET || 'kaagazai-dev-secret-change-in-prod';
}

interface SessionPayload {
  shopId: string;
}

function sign(data: string): string {
  return createHmac('sha256', secret()).update(data).digest('base64url');
}

export function createSessionValue(payload: SessionPayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${data}.${sign(data)}`;
}

export function parseSessionValue(value: string | undefined): SessionPayload | null {
  if (!value) return null;
  const [data, mac] = value.split('.');
  if (!data || !mac) return null;
  const expected = sign(data);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString());
    return typeof payload?.shopId === 'string' ? payload : null;
  } catch {
    return null;
  }
}

export function setSessionCookie(shopId: string) {
  cookies().set(COOKIE, createSessionValue({ shopId }), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: MAX_AGE,
    path: '/',
  });
}

export function clearSessionCookie() {
  cookies().delete(COOKIE);
}

export function currentShopId(): string | null {
  return parseSessionValue(cookies().get(COOKIE)?.value)?.shopId ?? null;
}
