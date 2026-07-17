import { db } from '@/lib/db';
import { isSection } from '@/lib/register';
import { currentShopId } from '@/lib/session';

export const runtime = 'nodejs';

/** GET /api/export?format=csv|json&section=udhaar|sales|stock — khata download.
 *  CSV exports one section (default udhaar); JSON always includes all three. */
export async function GET(req: Request) {
  const shopId = currentShopId();
  if (!shopId) return new Response('Unauthorized', { status: 401 });

  const params = new URL(req.url).searchParams;
  const format = params.get('format') === 'json' ? 'json' : 'csv';
  const sectionParam = params.get('section');
  const section = isSection(sectionParam) ? sectionParam : 'udhaar';

  const store = db();
  const [parties, txns, pages, sales, stock] = await Promise.all([
    store.listParties(shopId),
    store.listTxns(shopId),
    store.listPages(shopId),
    store.listSales(shopId),
    store.listStock(shopId),
  ]);
  const partyById = new Map(parties.map((p) => [p.id, p]));
  const pageById = new Map(pages.map((p) => [p.id, p]));

  if (format === 'json') {
    const payload = JSON.stringify(
      {
        app: 'KaagazAI',
        exported_at: new Date().toISOString(),
        udhaar: {
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
        sales: sales.map((s) => ({
          party: s.partyName,
          item: s.item,
          qty: s.qty,
          amount: s.amount,
          date: s.txnDate,
          raw_text: s.rawText,
          page: s.pageId ? pageById.get(s.pageId)?.pageNumber ?? null : null,
          created_at: s.createdAt,
        })),
        stock: stock.map((s) => ({
          item: s.item,
          qty: s.qty,
          direction: s.direction,
          amount: s.amount,
          date: s.txnDate,
          raw_text: s.rawText,
          page: s.pageId ? pageById.get(s.pageId)?.pageNumber ?? null : null,
          created_at: s.createdAt,
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

  // UTF-8 BOM so Excel/Numbers render Hindi & Telugu correctly
  // (char code, not a literal — the compiler strips literal BOMs)
  const bom = String.fromCharCode(0xfeff);

  if (section === 'sales') {
    const header = ['party', 'item', 'qty', 'amount', 'date', 'raw_text', 'page', 'created_at'];
    const lines = [header.join(',')];
    for (const s of sales) {
      lines.push(
        [
          s.partyName ?? '',
          s.item ?? '',
          s.qty ?? '',
          s.amount,
          s.txnDate ?? '',
          s.rawText ?? '',
          s.pageId ? pageById.get(s.pageId)?.pageNumber ?? '' : '',
          s.createdAt,
        ]
          .map(csvEscape)
          .join(',')
      );
    }
    return new Response(bom + lines.join('\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="kaagazai-sales.csv"',
      },
    });
  }

  if (section === 'stock') {
    const header = ['item', 'qty', 'direction', 'amount', 'date', 'raw_text', 'page', 'created_at'];
    const lines = [header.join(',')];
    for (const s of stock) {
      lines.push(
        [
          s.item,
          s.qty,
          s.direction,
          s.amount ?? '',
          s.txnDate ?? '',
          s.rawText ?? '',
          s.pageId ? pageById.get(s.pageId)?.pageNumber ?? '' : '',
          s.createdAt,
        ]
          .map(csvEscape)
          .join(',')
      );
    }
    return new Response(bom + lines.join('\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="kaagazai-stock.csv"',
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
  return new Response(bom + lines.join('\n'), {
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
