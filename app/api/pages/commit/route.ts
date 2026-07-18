import { NextResponse } from 'next/server';
import {
  db,
  type CommitPageInput,
  type CommitRowInput,
  type CommitSaleRowInput,
  type CommitStockRowInput,
} from '@/lib/db';
import { normalizePhone } from '@/lib/phone';
import { currentShopId } from '@/lib/session';

export const runtime = 'nodejs';

/**
 * POST /api/pages/commit — persist one reviewed page. Rows were already
 * routed client-side by their AI-detected type (credit/payment -> udhaar,
 * sale -> sales, stock_in/stock_out -> stock), so a single scanned page can
 * populate all three sections at once from one atomic page record.
 * Body: { model, registerType, confidence, notes, rows?, saleRows?, stockRows? }.
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
  const saleRows: CommitSaleRowInput[] = Array.isArray(body?.saleRows) ? body.saleRows : [];
  const stockRows: CommitStockRowInput[] = Array.isArray(body?.stockRows) ? body.stockRows : [];

  const validUdhaar = rows.filter(
    (r) =>
      (r.type === 'credit' || r.type === 'payment') &&
      Number.isFinite(Number(r.amount)) &&
      Number(r.amount) > 0 &&
      (r.partyId || r.newParty?.name?.trim())
  );
  const validSales = saleRows.filter((r) => Number.isFinite(Number(r.amount)) && Number(r.amount) > 0);
  const validStock = stockRows.filter(
    (r) =>
      r.item?.trim() &&
      Number.isFinite(Number(r.qty)) &&
      Number(r.qty) > 0 &&
      (r.direction === 'in' || r.direction === 'out')
  );

  const totalValid = validUdhaar.length + validSales.length + validStock.length;
  if (totalValid === 0) {
    return NextResponse.json(
      { ok: false, error: 'No usable rows — check that each row has a category, an amount and (for udhaar) a party.' },
      { status: 400 }
    );
  }

  const store = db();
  const page = await store.addPage(shopId, {
    model: String(body.model ?? 'unknown'),
    registerType: String(body.registerType ?? 'unknown'),
    confidence: Number(body.confidence) || 0,
    notes: String(body.notes ?? ''),
    rowCount: totalValid,
  });

  const udhaar = validUdhaar.length > 0 ? await commitUdhaarRows(shopId, page.id, validUdhaar) : { txnCount: 0, createdCount: 0 };

  let salesSaved = 0;
  if (validSales.length > 0) {
    const saved = await store.addSaleEntries(
      shopId,
      validSales.map((r) => ({
        pageId: page.id,
        partyName: r.partyName?.trim() || null,
        item: r.item?.trim() || null,
        qty: r.qty ?? null,
        amount: Number(r.amount),
        txnDate: r.txnDate ?? null,
        rawText: r.rawText ?? null,
      }))
    );
    salesSaved = saved.length;
  }

  let stockSaved = 0;
  if (validStock.length > 0) {
    const saved = await store.addStockEntries(
      shopId,
      validStock.map((r) => ({
        pageId: page.id,
        item: r.item.trim(),
        qty: Number(r.qty),
        direction: r.direction,
        amount: r.amount ?? null,
        txnDate: r.txnDate ?? null,
        rawText: r.rawText ?? null,
      }))
    );
    stockSaved = saved.length;
  }

  return NextResponse.json({
    ok: true,
    page: { id: page.id, pageNumber: page.pageNumber },
    saved: { udhaar: udhaar.txnCount, sales: salesSaved, stock: stockSaved },
    newParties: udhaar.createdCount,
  });
}

/* --------------------------------- udhaar ----------------------------------
 * Rows resolved to the same new party name reuse one created party, so
 * "रमेश यादव" appearing 3x on a page creates a single party. Auto-updating
 * balances falls out of inserting transactions here.
 */
async function commitUdhaarRows(shopId: string, pageId: string, valid: CommitRowInput[]) {
  const store = db();
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
        // If the language switch rewrote this name, keep the as-written
        // spelling as a variant so it's still searchable.
        if (row.originalName?.trim() && row.originalName.trim() !== name) {
          await store.addNameVariant(shopId, party.id, row.originalName.trim());
        }
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
      pageId,
    });
    txnCount += 1;
  }

  return { txnCount, createdCount };
}
