import { db } from '@/lib/db';
import { currentShopId } from '@/lib/session';

export const runtime = 'nodejs';

/** GET /api/export?format=csv|json — full khata download. */
export async function GET(req: Request) {
  const shopId = currentShopId();
  if (!shopId) return new Response('Unauthorized', { status: 401 });

  const format = new URL(req.url).searchParams.get('format') === 'json' ? 'json' : 'csv';
  const store = db();
  const [parties, txns, pages] = await Promise.all([
    store.listParties(shopId),
    store.listTxns(shopId),
    store.listPages(shopId),
  ]);
  const partyById = new Map(parties.map((p) => [p.id, p]));
  const pageById = new Map(pages.map((p) => [p.id, p]));

  if (format === 'json') {
    const payload = JSON.stringify(
      {
        app: 'KaagazAI',
        exported_at: new Date().toISOString(),
        parties: parties.map((p) => ({
          name: p.name,
          phone: p.phone,
          credits: p.credits,
          payments: p.payments,
          balance: p.balance,
        })),
        transactions: txns.map((t) => ({
          party: partyById.get(t.partyId)?.name ?? '',
          type: t.type,
          amount: t.amount,
          item: t.item,
          date: t.txnDate,
          raw_text: t.rawText,
          page: t.pageId ? pageById.get(t.pageId)?.pageNumber ?? null : null,
          created_at: t.createdAt,
        })),
      },
      null,
      2
    );
    return new Response(payload, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="kaagazai-khata.json"',
      },
    });
  }

  const header = ['party', 'phone', 'type', 'amount', 'item', 'date', 'raw_text', 'page', 'created_at'];
  const lines = [header.join(',')];
  for (const t of txns) {
    const p = partyById.get(t.partyId);
    lines.push(
      [
        p?.name ?? '',
        p?.phone ?? '',
        t.type,
        t.amount,
        t.item ?? '',
        t.txnDate ?? '',
        t.rawText ?? '',
        t.pageId ? pageById.get(t.pageId)?.pageNumber ?? '' : '',
        t.createdAt,
      ]
        .map(csvEscape)
        .join(',')
    );
  }
  // UTF-8 BOM so Excel/Numbers render Hindi & Telugu correctly
  // (char code, not a literal — the compiler strips literal BOMs)
  const csv = String.fromCharCode(0xfeff) + lines.join('\n');
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="kaagazai-khata.csv"',
    },
  });
}

function csvEscape(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
