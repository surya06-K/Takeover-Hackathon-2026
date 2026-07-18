'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import NumPad from '@/components/NumPad';
import SpeakButton from '@/components/SpeakButton';
import VoiceInput from '@/components/VoiceInput';
import { useLang } from '@/components/LanguageProvider';
import { playError, playSuccess } from '@/lib/audio';
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
  const { tr } = useLang();
  const [data, setData] = useState<ProfileData | null>(null);
  const [error, setError] = useState('');
  const [entry, setEntry] = useState<{ type: TxnType; amount: string; item: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [usePad, setUsePad] = useState(true);

  const load = useCallback(async () => {
    const j = await fetch(`/api/parties/${id}`).then((r) => r.json()).catch(() => null);
    if (j?.ok) setData(j);
    else setError(j?.error ?? tr('errorGeneric'));
  }, [id, tr]);

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
        setError(json.error ?? tr('errorGeneric'));
        playError();
        return;
      }
      setEntry(null);
      setError('');
      playSuccess();
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
            ← {tr('backToUdhaar')}
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
          <div className="loading-msg">{tr('openingKhata')}</div>
        </div>
      </div>
    );
  }

  const { party, stats, txns } = data;
  const balanceLabel = stats.balance >= 0 ? tr('balanceDue') : tr('advanceHeld');
  const balanceSpoken = `${party.name}. ${balanceLabel} ${formatINR(Math.abs(stats.balance))}.`;

  return (
    <div className="container">
      <div className="profile-head">
        <span className="profile-pic">{initials(party.name)}</span>
        <div>
          <h1>{party.name}</h1>
          <div className="profile-phone">
            {party.phone ? `📱 ${formatPhone(party.phone)}` : tr('noPhone')}
          </div>
        </div>
        {party.phone && (
          <a className="call-btn" href={`tel:+91${party.phone}`}>
            📞 {tr('call')}
          </a>
        )}
      </div>

      <div className="balance-hero">
        <div>
          <div className="stat-label">
            {balanceLabel} <SpeakButton text={balanceSpoken} compact />
          </div>
          <div className={`v ${stats.balance === 0 ? 'settled' : ''}`}>
            {formatINR(Math.abs(stats.balance))}
          </div>
        </div>
        <div className="muted" style={{ fontSize: 12, textAlign: 'right' }}>
          {tr('autoUpdated')}
          <br />
          {stats.entries} {stats.entries === 1 ? tr('entry') : tr('entries')}
        </div>
      </div>

      {!entry ? (
        <div className="two-actions">
          <button
            type="button"
            className="btn btn-primary btn-lg"
            onClick={() => setEntry({ type: 'credit', amount: '', item: '' })}
          >
            {tr('udhaarDiya')}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-lg"
            onClick={() => setEntry({ type: 'payment', amount: '', item: '' })}
          >
            {tr('paymentAaya')}
          </button>
        </div>
      ) : (
        <div className="card entry-card" style={{ marginBottom: 18 }}>
          <label className="form-label" style={{ marginTop: 0 }}>
            {entry.type === 'credit' ? tr('udhaarAmount') : tr('paymentReceived')}
          </label>

          <div className="amount-display">{entry.amount || '0'}</div>

          <div className="entry-tools">
            <button
              type="button"
              className="hdr-chip"
              onClick={() => setUsePad((v) => !v)}
            >
              {usePad ? '⌨️' : '🔢'}
            </button>
            <VoiceInput mode="number" onResult={(amount) => setEntry({ ...entry, amount })} />
          </div>

          {usePad && (
            <NumPad
              value={entry.amount}
              onChange={(amount) => setEntry({ ...entry, amount })}
              onConfirm={saveEntry}
            />
          )}

          {!usePad && (
            <input
              className="form-input"
              inputMode="decimal"
              autoFocus
              placeholder="0"
              value={entry.amount}
              onChange={(e) => setEntry({ ...entry, amount: e.target.value })}
            />
          )}

          <label className="form-label">{tr('itemNote')}</label>
          <input
            className="form-input"
            placeholder={entry.type === 'credit' ? 'Atta 10kg' : 'cash / UPI'}
            value={entry.item}
            onChange={(e) => setEntry({ ...entry, item: e.target.value })}
          />
          <div className="two-actions" style={{ marginTop: 14, marginBottom: 0 }}>
            <button
              type="button"
              className="btn btn-primary btn-lg"
              disabled={busy || !parseFloat(entry.amount)}
              onClick={saveEntry}
            >
              {tr('saveEntry')}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setEntry(null)}>
              {tr('cancel')}
            </button>
          </div>
          {error && <div className="form-error">{error}</div>}
        </div>
      )}

      <label className="field-label" style={{ marginTop: 4 }}>
        {tr('timeline')}
      </label>
      {txns.length === 0 && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--muted)' }}>
          {tr('noEntries')}
        </div>
      )}
      <div className="timeline">
        {txns.map((txn) => {
          const typeLabel = txn.type === 'payment' ? tr('payment') : tr('credit');

          return (
            <div key={txn.id} className={`tl-event ${txn.type === 'payment' ? 'pay' : ''}`}>
              <div className="tl-t1">
                <span className={txn.type === 'payment' ? 'py' : 'cr'}>
                  {typeLabel} {formatINR(txn.amount)}
                </span>
                {txn.item ? ` — ${txn.item}` : ''}
              </div>
              <div className="tl-t2">
                {txn.txnDate ?? new Date(txn.createdAt).toLocaleDateString('en-IN')}
                {' · '}
                {txn.pageNumber != null ? (
                  <span className="src-chip">📷 {tr('pageChip')} {txn.pageNumber}</span>
                ) : (
                  <span className="src-chip">✍️ {tr('manualChip')}</span>
                )}
              </div>
              {txn.rawText && (
                <div className="tl-raw">
                  {tr('asWritten')}: “{txn.rawText}”
                </div>
              )}
            </div>
          );
        })}
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
