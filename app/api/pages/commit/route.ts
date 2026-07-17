import { NextResponse } from 'next/server';
import { db, type CommitPageInput, type CommitRowInput } from '@/lib/db';
import { normalizePhone } from '@/lib/phone';
import { currentShopId } from '@/lib/session';

export const runtime = 'nodejs';

/**
 * POST /api/pages/commit — persist one reviewed & party-matched scanned page.
 * Body: { model, registerType, confidence, notes, rows: [{ type, amount, item,
 * txnDate, rawText, partyId? | newParty?: { name, phone? } }] }
 *
 * Rows resolved to the same new party name reuse one created party, so
 * "रमेश यादव" appearing 3x on a page creates a single party. Feature #1
 * (auto-updating balances) falls out of inserting transactions here.
 */
export async function POST(req: Request) {
  const shopId = currentShopId();
  if (!shopId) return NextResponse.json({ ok: false }, { status: 401 });

  let body: CommitPageInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Bad request.' }, { status: 400 });
  }

  const rows: CommitRowInput[] = Array.isArray(body?.rows) ? body.rows : [];
  const valid = rows.filter(
    (r) =>
      (r.type === 'credit' || r.type === 'payment') &&
      Number.isFinite(Number(r.amount)) &&
      Number(r.amount) > 0 &&
      (r.partyId || r.newParty?.name?.trim())
  );
  if (valid.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'No usable rows — each needs a party, a type and an amount.' },
      { status: 400 }
    );
  }

  const store = db();
  const page = await store.addPage(shopId, {
    model: String(body.model ?? 'unknown'),
    registerType: String(body.registerType ?? 'unknown'),
    confidence: Number(body.confidence) || 0,
    notes: String(body.notes ?? ''),
    rowCount: valid.length,
  });

  // Resolve parties (dedupe new ones by normalized name within this commit)
  const createdByName = new Map<string, string>(); // lower(name) -> partyId
  let createdCount = 0;
  let txnCount = 0;

  for (const row of valid) {
    let partyId = row.partyId ?? null;

    if (!partyId && row.newParty) {
      const name = row.newParty.name.trim();
      const key = name.toLowerCase();
      partyId = createdByName.get(key) ?? null;
      if (!partyId) {
        const phone = row.newParty.phone ? normalizePhone(row.newParty.phone) : null;
        const party = await store.createParty(shopId, name, phone);
        createdByName.set(key, party.id);
        partyId = party.id;
        createdCount += 1;
      }
    }
    if (!partyId) continue;

    // Extracted name differs from the stored one (e.g. "रमेश यादव" matched to
    // "Ramesh Yadav")? Remember it as a variant for future matching/search.
    if (row.partyId && row.extractedName?.trim()) {
      await store.addNameVariant(shopId, row.partyId, row.extractedName.trim());
    }

    await store.addTxn(shopId, {
      partyId,
      type: row.type,
      amount: Number(row.amount),
      item: row.item ?? null,
      txnDate: row.txnDate ?? null,
      rawText: row.rawText ?? null,
      pageId: page.id,
    });
    txnCount += 1;
  }

  return NextResponse.json({
    ok: true,
    page: { id: page.id, pageNumber: page.pageNumber },
    saved: txnCount,
    newParties: createdCount,
  });
}
