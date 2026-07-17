'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface ItemAgg {
  item: string;
  in: number;
  out: number;
  net: number;
  movements: number;
}

interface StockEntry {
  id: string;
  item: string;
  qty: number;
  direction: 'in' | 'out';
  amount: number | null;
  txnDate: string | null;
  pageNumber: number | null;
  createdAt: string;
}

interface StockData {
  stats: { itemCount: number; lowStockCount: number; movementCount: number };
  items: ItemAgg[];
  entries: StockEntry[];
}

export default function StockPage() {
  const [data, setData] = useState<StockData | null>(null);

  useEffect(() => {
    fetch('/api/stock')
      .then((r) => r.json())
      .then((j) => j?.ok && setData(j))
      .catch(() => {});
  }, []);

  if (data && data.items.length === 0) {
    return (
      <div className="container section">
        <div className="page-head" style={{ paddingTop: 26 }}>
          <h1>Stock register</h1>
          <p>Items in and out, from scanned stock pages.</p>
        </div>
        <div className="card soon-card">
          <div className="big" aria-hidden>
            📦
          </div>
          <h2>No stock scanned yet</h2>
          <p>Photograph a stock register page and pick "Stock" — net quantities will show up here.</p>
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
        <h1>Stock register</h1>
        <p>{data ? `${data.stats.itemCount} items · ${data.stats.movementCount} movements` : 'loading…'}</p>
      </div>

      <div className="cards-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="stat-card">
          <div className="stat-label">Items tracked</div>
          <div className="stat-value">{data?.stats.itemCount ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Out of stock</div>
          <div className="stat-value" style={{ color: 'var(--red)' }}>
            {data?.stats.lowStockCount ?? 0}
          </div>
          <div className="stat-sub">net qty at or below zero</div>
        </div>
      </div>

      <div className="table-scroll">
        <table className="balances-table">
          <thead>
            <tr>
              <th>Item</th>
              <th className="num">In</th>
              <th className="num">Out</th>
              <th className="num">Net</th>
              <th className="num">Movements</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((i) => (
              <tr key={i.item.toLowerCase()}>
                <td>
                  <span className="party-name">{i.item}</span>
                  {i.net <= 0 && <span className="badge-red">out of stock</span>}
                </td>
                <td className="num">{i.in}</td>
                <td className="num">{i.out}</td>
                <td className={`num ${i.net > 0 ? 'balance-pos' : 'balance-neg'}`}>{i.net}</td>
                <td className="num">{i.movements}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="actions-row">
        <Link href="/scan" className="btn btn-primary">
          + Scan another page
        </Link>
        <a href="/api/export?format=csv&section=stock" className="btn btn-ghost">
          ⬇ Export CSV
        </a>
      </div>
    </div>
  );
}
