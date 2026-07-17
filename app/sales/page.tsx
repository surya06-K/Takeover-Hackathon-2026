'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatINR } from '@/lib/ledger';

interface SaleRow {
  id: string;
  partyName: string | null;
  item: string | null;
  qty: number | null;
  amount: number;
  txnDate: string | null;
  rawText: string | null;
  pageNumber: number | null;
  createdAt: string;
}

interface SalesData {
  stats: { total: number; today: number; entries: number };
  entries: SaleRow[];
}

export default function SalesPage() {
  const [data, setData] = useState<SalesData | null>(null);

  useEffect(() => {
    fetch('/api/sales')
      .then((r) => r.json())
      .then((j) => j?.ok && setData(j))
      .catch(() => {});
  }, []);

  if (data && data.entries.length === 0) {
    return (
      <div className="container section">
        <div className="page-head" style={{ paddingTop: 26 }}>
          <h1>Sales &amp; bill book</h1>
          <p>Daily sales from scanned bill-book pages.</p>
        </div>
        <div className="card soon-card">
          <div className="big" aria-hidden>
            🧾
          </div>
          <h2>No sales scanned yet</h2>
          <p>Photograph a bill book page and pick "Sales" — entries will land here with running totals.</p>
          <Link href="/scan" className="btn btn-primary btn-lg" style={{ marginTop: 18 }}>
            📷 Scan a page →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="page-head" style={{ paddingTop: 26 }}>
        <h1>Sales &amp; bill book</h1>
        <p>{data ? `${data.stats.entries} entries · ${formatINR(data.stats.total)} total` : 'loading…'}</p>
      </div>

      <div className="cards-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="stat-card">
          <div className="stat-label">Today's sales</div>
          <div className="stat-value money">{formatINR(data?.stats.today ?? 0)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total sales</div>
          <div className="stat-value money">{formatINR(data?.stats.total ?? 0)}</div>
          <div className="stat-sub">{data?.stats.entries ?? 0} entries</div>
        </div>
      </div>

      <div className="table-scroll">
        <table className="balances-table">
          <thead>
            <tr>
              <th>Party</th>
              <th>Item</th>
              <th className="num">Qty</th>
              <th className="num">Amount</th>
              <th>Date</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {data?.entries.map((e) => (
              <tr key={e.id}>
                <td>{e.partyName || <span className="muted">walk-in</span>}</td>
                <td>{e.item || <span className="muted">—</span>}</td>
                <td className="num">{e.qty ?? '—'}</td>
                <td className="num">{formatINR(e.amount)}</td>
                <td>{e.txnDate ?? new Date(e.createdAt).toLocaleDateString('en-IN')}</td>
                <td>
                  {e.pageNumber != null ? (
                    <span className="src-chip">📷 page {e.pageNumber}</span>
                  ) : (
                    <span className="src-chip">✍️ manual</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="actions-row">
        <Link href="/scan" className="btn btn-primary">
          + Scan another page
        </Link>
        <a href="/api/export?format=csv&section=sales" className="btn btn-ghost">
          ⬇ Export CSV
        </a>
      </div>
    </div>
  );
}
