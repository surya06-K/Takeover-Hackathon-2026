'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatINR } from '@/lib/ledger';
import { formatPhone } from '@/lib/phone';

interface DashData {
  stats: {
    outstanding: number;
    flaggedCount: number;
    partyCount: number;
    pageCount: number;
    biggestDebtor: { id: string; name: string; balance: number } | null;
  };
  collectToday: { id: string; name: string; phone: string | null; balance: number; entries: number }[];
  recent: { kind: string; at: string; title: string; sub: string; amount: number | null }[];
}

export default function HomePage() {
  const router = useRouter();
  const [shop, setShop] = useState<{ name: string } | null>(null);
  const [storage, setStorage] = useState<'memory' | 'supabase'>('memory');
  const [data, setData] = useState<DashData | null>(null);

  useEffect(() => {
    (async () => {
      const me = await fetch('/api/me').then((r) => r.json()).catch(() => null);
      if (!me?.ok) {
        router.replace('/login');
        return;
      }
      setShop(me.shop);
      setStorage(me.storage);
      const dash = await fetch('/api/dashboard').then((r) => r.json()).catch(() => null);
      if (dash?.ok) setData(dash);
    })();
  }, [router]);

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="container">
      <div className="hello-row">
        <h1>Namaste{shop ? `, ${firstWord(shop.name)} ji` : ''} 🙏</h1>
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>
          {today}
          {shop ? ` · ${shop.name}` : ''}
          <span className={`storage-chip ${storage === 'supabase' ? 'db' : ''}`}>
            {storage === 'supabase' ? 'DB connected' : 'demo storage'}
          </span>
        </p>
      </div>

      <div className="cards-grid" style={{ gridTemplateColumns: '1fr 1fr', margin: '16px 0 20px' }}>
        <div className="stat-card">
          <div className="stat-label">Outstanding</div>
          <div className="stat-value money">{formatINR(data?.stats.outstanding ?? 0)}</div>
          <div className="stat-sub">{data?.stats.partyCount ?? 0} parties</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">₹5,000+ due</div>
          <div className="stat-value" style={{ color: 'var(--red)' }}>
            {data?.stats.flaggedCount ?? 0} {data?.stats.flaggedCount === 1 ? 'party' : 'parties'}
          </div>
          <div className="stat-sub">
            {data?.stats.biggestDebtor
              ? `top: ${data.stats.biggestDebtor.name}`
              : 'nobody flagged'}
          </div>
        </div>
      </div>

      {data && data.collectToday.length > 0 && (
        <>
          <label className="field-label" style={{ marginTop: 8 }}>
            Collect today
          </label>
          {data.collectToday.map((p) => (
            <Link key={p.id} href={`/party/${p.id}`} className="party-row">
              <span className="party-pic">{initials(p.name)}</span>
              <span className="party-mid">
                <span className="party-name-row">
                  {p.name} <span className="badge-red">₹5,000+</span>
                </span>
                <span className="party-sub">
                  {p.phone ? `📱 ${formatPhone(p.phone)} · ` : ''}
                  {p.entries} entries
                </span>
              </span>
              <span className="party-amt amt-due">{formatINR(p.balance)}</span>
            </Link>
          ))}
        </>
      )}

      <label className="field-label" style={{ marginTop: 14 }}>
        Recent activity
      </label>
      {(!data || data.recent.length === 0) && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--muted)' }}>
          Nothing yet — tap <b>Scan</b> below and photograph your first register page.
        </div>
      )}
      {data?.recent.map((r, i) => (
        <div key={i} className="party-row" style={{ cursor: 'default' }}>
          <span className={`party-pic ${r.kind !== 'credit' ? 'green' : ''}`}>
            {r.kind === 'page' ? '📄' : r.kind === 'payment' ? '₹' : '📒'}
          </span>
          <span className="party-mid">
            <span className="party-name-row">{r.title}</span>
            <span className="party-sub">{r.sub}</span>
          </span>
          {r.amount != null && (
            <span className={`party-amt ${r.kind === 'payment' ? 'amt-zero' : 'amt-due'}`}>
              {formatINR(r.amount)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => [...w][0] ?? '')
    .join('')
    .toUpperCase();
}

function firstWord(name: string): string {
  return name.split(/\s+/)[0] ?? name;
}
