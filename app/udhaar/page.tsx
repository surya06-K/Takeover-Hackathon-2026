'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FLAG_THRESHOLD, formatINR } from '@/lib/ledger';
import { formatPhone } from '@/lib/phone';
import type { PartyWithBalance } from '@/lib/db/types';

export default function UdhaarPage() {
  const [parties, setParties] = useState<PartyWithBalance[] | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    fetch('/api/parties')
      .then((r) => r.json())
      .then((j) => j.ok && setParties(j.parties))
      .catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    if (!parties) return null;
    const query = q.trim().toLowerCase();
    if (!query) return parties;
    const qDigits = query.replace(/\D/g, '');
    return parties.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.nameVariants.some((v) => v.toLowerCase().includes(query)) ||
        (qDigits.length >= 3 && p.phone?.includes(qDigits))
    );
  }, [parties, q]);

  const totalDue = (parties ?? []).reduce((s, p) => s + Math.max(p.balance, 0), 0);

  return (
    <div className="container">
      <div className="page-head" style={{ paddingTop: 26 }}>
        <h1>Udhaar khata</h1>
        <p>
          {parties ? `${parties.length} parties · ${formatINR(totalDue)} to collect` : 'loading…'}
        </p>
      </div>

      <input
        className="search-input"
        placeholder="🔍  Search name or phone number…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Search parties by name or phone"
      />

      {filtered && filtered.length === 0 && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--muted)' }}>
          {q
            ? 'No party matches that search.'
            : 'No parties yet — scan a register page or add entries from a party profile.'}
        </div>
      )}

      {filtered?.map((p) => (
        <Link key={p.id} href={`/party/${p.id}`} className="party-row">
          <span className={`party-pic ${p.balance <= 0 ? 'green' : ''}`}>{initials(p.name)}</span>
          <span className="party-mid">
            <span className="party-name-row">
              {p.name}
              {p.balance >= FLAG_THRESHOLD && <span className="badge-red">₹5,000+ due</span>}
            </span>
            <span className="party-sub">
              {p.phone ? `📱 ${formatPhone(p.phone)}` : 'no phone saved'} · {p.entries} entries
            </span>
          </span>
          <span
            className={`party-amt ${p.balance > 0 ? 'amt-due' : p.balance === 0 ? 'amt-zero' : 'amt-adv'}`}
          >
            {formatINR(Math.abs(p.balance))}
            <span className="lbl">{p.balance > 0 ? 'due' : p.balance === 0 ? 'settled' : 'advance'}</span>
          </span>
        </Link>
      ))}

      <div className="actions-row" style={{ marginTop: 20 }}>
        <a href="/api/export?format=csv" className="btn btn-ghost">
          ⬇ Export CSV
        </a>
        <a href="/api/export?format=json" className="btn btn-ghost">
          ⬇ Export JSON
        </a>
      </div>
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
