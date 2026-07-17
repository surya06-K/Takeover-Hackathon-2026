'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { formatINR } from '@/lib/ledger';
import { formatPhone } from '@/lib/phone';
import type { Party, TxnType } from '@/lib/db/types';

interface TimelineTxn {
  id: string;
  type: TxnType;
  amount: number;
  item: string | null;
  txnDate: string | null;
  rawText: string | null;
  pageNumber: number | null;
  createdAt: string;
}

interface ProfileData {
  party: Party;
  stats: { credits: number; payments: number; balance: number; entries: number };
  txns: TimelineTxn[];
}

export default function PartyPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<ProfileData | null>(null);
  const [error, setError] = useState('');
  const [entry, setEntry] = useState<{ type: TxnType; amount: string; item: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const j = await fetch(`/api/parties/${id}`).then((r) => r.json()).catch(() => null);
    if (j?.ok) setData(j);
    else setError(j?.error ?? 'Could not load this party.');
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveEntry() {
    if (!entry) return;
    setBusy(true);
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partyId: id,
          type: entry.type,
          amount: parseFloat(entry.amount.replace(/[₹,\s]/g, '')),
          item: entry.item,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? 'Could not save.');
        return;
      }
      setEntry(null);
      setError('');
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) {
    return (
      <div className="container section">
        <div className="card error-card">
          <h2>{error}</h2>
          <button type="button" className="btn btn-ghost" onClick={() => router.push('/udhaar')}>
            ← Back to Udhaar
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container section">
        <div className="card loading-card">
          <div className="scan-dot" aria-hidden />
          <div className="loading-msg">Opening khata…</div>
        </div>
      </div>
    );
  }

  const { party, stats, txns } = data;

  return (
    <div className="container">
      <div className="profile-head">
        <span className="profile-pic">{initials(party.name)}</span>
        <div>
          <h1>{party.name}</h1>
          <div className="profile-phone">
            {party.phone ? `📱 ${formatPhone(party.phone)}` : 'no phone saved'}
            {party.nameVariants.length > 0 && (
              <span className="muted"> · also written: {party.nameVariants.join(', ')}</span>
            )}
          </div>
        </div>
        {party.phone && (
          <a className="call-btn" href={`tel:+91${party.phone}`}>
            📞 Call
          </a>
        )}
      </div>

      <div className="balance-hero">
        <div>
          <div className="stat-label">{stats.balance >= 0 ? 'Balance due' : 'Advance held'}</div>
          <div className={`v ${stats.balance === 0 ? 'settled' : ''}`}>
            {formatINR(Math.abs(stats.balance))}
          </div>
        </div>
        <div className="muted" style={{ fontSize: 12, textAlign: 'right' }}>
          auto-updated
          <br />
          from {stats.entries} entr{stats.entries === 1 ? 'y' : 'ies'}
        </div>
      </div>

      {!entry ? (
        <div className="two-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setEntry({ type: 'credit', amount: '', item: '' })}
          >
            + Udhaar diya
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setEntry({ type: 'payment', amount: '', item: '' })}
          >
            ₹ Payment aaya
          </button>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 18 }}>
          <label className="form-label" style={{ marginTop: 0 }}>
            {entry.type === 'credit' ? 'Udhaar amount (₹)' : 'Payment received (₹)'}
          </label>
          <input
            className="form-input"
            inputMode="decimal"
            autoFocus
            placeholder="0"
            value={entry.amount}
            onChange={(e) => setEntry({ ...entry, amount: e.target.value })}
          />
          <label className="form-label">Item / note (optional)</label>
          <input
            className="form-input"
            placeholder={entry.type === 'credit' ? 'e.g. Atta 10kg' : 'e.g. cash / UPI'}
            value={entry.item}
            onChange={(e) => setEntry({ ...entry, item: e.target.value })}
          />
          <div className="two-actions" style={{ marginTop: 14, marginBottom: 0 }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || !parseFloat(entry.amount)}
              onClick={saveEntry}
            >
              Save entry
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setEntry(null)}>
              Cancel
            </button>
          </div>
          {error && <div className="form-error">{error}</div>}
        </div>
      )}

      <label className="field-label" style={{ marginTop: 4 }}>
        Timeline
      </label>
      {txns.length === 0 && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--muted)' }}>
          No entries yet.
        </div>
      )}
      <div className="timeline">
        {txns.map((t) => (
          <div key={t.id} className={`tl-event ${t.type === 'payment' ? 'pay' : ''}`}>
            <div className="tl-t1">
              <span className={t.type === 'payment' ? 'py' : 'cr'}>
                {t.type === 'payment' ? 'Payment' : 'Credit'} {formatINR(t.amount)}
              </span>
              {t.item ? ` — ${t.item}` : ''}
            </div>
            <div className="tl-t2">
              {t.txnDate ?? new Date(t.createdAt).toLocaleDateString('en-IN')}
              {' · '}
              {t.pageNumber != null ? (
                <span className="src-chip">📷 page {t.pageNumber}</span>
              ) : (
                <span className="src-chip">✍️ manual</span>
              )}
            </div>
            {t.rawText && <div className="tl-raw">as written: “{t.rawText}”</div>}
          </div>
        ))}
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
