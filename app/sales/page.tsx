'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import SpeakButton from '@/components/SpeakButton';
import { useLang } from '@/components/LanguageProvider';
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
  const { tr } = useLang();
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
          <h1>{tr('salesTitle')}</h1>
          <p>{tr('salesSubtitle')}</p>
        </div>
        <div className="card soon-card">
          <div className="big" aria-hidden>
            🧾
          </div>
          <h2>{tr('noSalesTitle')}</h2>
          <p>{tr('noSalesDesc')}</p>
          <Link href="/scan" className="btn btn-primary btn-lg" style={{ marginTop: 18 }}>
            📷 {tr('scanPage')} →
          </Link>
        </div>
      </div>
    );
  }

  const spoken = `${tr('todaysSales')} ${formatINR(data?.stats.today ?? 0)}. ${tr('totalSales')} ${formatINR(
    data?.stats.total ?? 0
  )}.`;

  return (
    <div className="container">
      <div className="page-head" style={{ paddingTop: 26 }}>
        <h1>{tr('salesTitle')}</h1>
        <p>
          {data
            ? `${data.stats.entries} ${tr('entries')} · ${formatINR(data.stats.total)} ${tr('total')}`
            : tr('loading')}
          {data && <SpeakButton text={spoken} compact />}
        </p>
      </div>

      <div className="cards-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="stat-card">
          <div className="stat-label">{tr('todaysSales')}</div>
          <div className="stat-value money">{formatINR(data?.stats.today ?? 0)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{tr('totalSales')}</div>
          <div className="stat-value money">{formatINR(data?.stats.total ?? 0)}</div>
          <div className="stat-sub">
            {data?.stats.entries ?? 0} {tr('entries')}
          </div>
        </div>
      </div>

      <div className="table-scroll">
        <table className="balances-table">
          <thead>
            <tr>
              <th>{tr('colParty')}</th>
              <th>{tr('colItem')}</th>
              <th className="num">{tr('colQty')}</th>
              <th className="num">{tr('colAmount')}</th>
              <th>{tr('colDate')}</th>
              <th>{tr('colSource')}</th>
            </tr>
          </thead>
          <tbody>
            {data?.entries.map((e) => (
              <tr key={e.id}>
                <td>{e.partyName || <span className="muted">{tr('walkIn')}</span>}</td>
                <td>{e.item || <span className="muted">—</span>}</td>
                <td className="num">{e.qty ?? '—'}</td>
                <td className="num">{formatINR(e.amount)}</td>
                <td>{e.txnDate ?? new Date(e.createdAt).toLocaleDateString('en-IN')}</td>
                <td>
                  {e.pageNumber != null ? (
                    <span className="src-chip">📷 {tr('pageChip')} {e.pageNumber}</span>
                  ) : (
                    <span className="src-chip">✍️ {tr('manualChip')}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="actions-row">
        <Link href="/scan" className="btn btn-primary">
          + {tr('scanAnother')}
        </Link>
        <a href="/api/export?format=csv&section=sales" className="btn btn-ghost">
          ⬇ {tr('exportCsv')}
        </a>
      </div>
    </div>
  );
}
