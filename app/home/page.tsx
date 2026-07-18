'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import SpeakButton from '@/components/SpeakButton';
import { useLang } from '@/components/LanguageProvider';
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
  restock: { count: number; items: { item: string; net: number; minQty: number }[] };
  recent: { kind: string; at: string; title: string; sub: string; amount: number | null }[];
}

export default function HomePage() {
  const router = useRouter();
  const { tr, locale } = useLang();
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

  const today = new Date().toLocaleDateString(locale === 'hi' ? 'hi-IN' : 'en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const outstandingSpoken = `${tr('outstanding')} ${formatINR(data?.stats.outstanding ?? 0)}. ${
    data?.stats.flaggedCount ?? 0
  } ${tr('parties')} ₹5,000+.`;

  const restockSpoken = data?.restock.count
    ? `${tr('restockReminders')}: ${data.restock.items
        .map((i) => `${i.item}, ${i.net} ${tr('left')}`)
        .join('. ')}`
    : '';

  return (
    <div className="container">
      <div className="hello-row">
        <h1>
          {tr('namaste')}
          {shop ? `, ${firstWord(shop.name)} ${tr('ji')}` : ''} 🙏
        </h1>
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>
          {today}
          {shop ? ` · ${shop.name}` : ''}
          <span className={`storage-chip ${storage === 'supabase' ? 'db' : ''}`}>
            {storage === 'supabase' ? tr('dbConnected') : tr('demoStorage')}
          </span>
        </p>
      </div>

      <div className="cards-grid" style={{ gridTemplateColumns: '1fr 1fr', margin: '16px 0 20px' }}>
        <div className="stat-card">
          <div className="stat-label">
            {tr('outstanding')} <SpeakButton text={outstandingSpoken} compact />
          </div>
          <div className="stat-value money">{formatINR(data?.stats.outstanding ?? 0)}</div>
          <div className="stat-sub">
            {data?.stats.partyCount ?? 0} {tr('parties')}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{tr('flaggedDue')}</div>
          <div className="stat-value" style={{ color: 'var(--red)' }}>
            {data?.stats.flaggedCount ?? 0} {data?.stats.flaggedCount === 1 ? tr('party') : tr('parties')}
          </div>
          <div className="stat-sub">
            {data?.stats.biggestDebtor
              ? `${tr('topDebtor')}: ${data.stats.biggestDebtor.name}`
              : tr('nobodyFlagged')}
          </div>
        </div>
      </div>

      {data && data.restock.count > 0 && (
        <Link href="/stock" className="restock-card">
          <span className="restock-bell" aria-hidden>
            🔔
          </span>
          <span className="restock-mid">
            <span className="restock-title">
              {data.restock.count} {tr('items')} {tr('itemsToRestock')}
            </span>
            <span className="restock-sub">
              {data.restock.items.map((i) => `${i.item} · ${i.net} ${tr('left')}`).join('  ·  ')}
            </span>
          </span>
          <SpeakButton text={restockSpoken} compact />
        </Link>
      )}

      {data && data.collectToday.length > 0 && (
        <>
          <label className="field-label" style={{ marginTop: 8 }}>
            {tr('collectToday')}
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
                  {p.entries} {p.entries === 1 ? tr('entry') : tr('entries')}
                </span>
              </span>
              <span className="party-amt amt-due">{formatINR(p.balance)}</span>
            </Link>
          ))}
        </>
      )}

      <label className="field-label" style={{ marginTop: 14 }}>
        {tr('recentActivity')}
      </label>
      {(!data || data.recent.length === 0) && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--muted)' }}>
          {tr('emptyHome')}
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
