'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  FLAG_THRESHOLD,
  biggestDebtor,
  computeBalances,
  formatINR,
  totalOutstanding,
  unassignedRowCount,
} from '@/lib/ledger';
import { ledgerToCsv, ledgerToJson, downloadFile } from '@/lib/export';
import { clearLedger, useLedger } from '@/lib/store';
import { MODEL_LABELS, type LedgerPage } from '@/lib/types';
import { LANG_LABELS, detectLangs, type LangCode } from '@/lib/lang';

type OutLang = 'original' | LangCode;

export default function LedgerPage() {
  const { pages } = useLedger();

  // language switch state (all display-only; the saved store is never mutated)
  const [outLang, setOutLang] = useState<OutLang>('original');
  const [cache, setCache] = useState<Record<string, Record<string, string>>>({});
  const [translating, setTranslating] = useState(false);
  const [transError, setTransError] = useState('');

  const detected = useMemo(() => {
    const texts: (string | null)[] = [];
    for (const p of pages) for (const r of p.rows) texts.push(r.party, r.item);
    return detectLangs(texts);
  }, [pages]);

  // Pages re-expressed in the chosen output language (names + items translated).
  const viewPages = useMemo<LedgerPage[]>(() => {
    if (outLang === 'original') return pages;
    const map = cache[outLang] ?? {};
    const tr = (s: string | null) => (s && map[s] ? map[s] : s);
    return pages.map((p) => ({
      ...p,
      rows: p.rows.map((r) => ({ ...r, party: tr(r.party), item: tr(r.item) })),
    }));
  }, [pages, outLang, cache]);

  async function chooseLang(lang: OutLang) {
    setTransError('');
    if (lang === 'original' || cache[lang]) {
      setOutLang(lang);
      return;
    }
    const texts = [
      ...new Set(
        pages.flatMap((p) => p.rows.flatMap((r) => [r.party, r.item])).filter((s): s is string => !!s && s.trim() !== '')
      ),
    ];
    setTranslating(true);
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts, target: lang }),
      });
      const json = await res.json();
      if (!json.ok) {
        setTransError('Could not switch language. Please try again.');
        return;
      }
      setCache((c) => ({ ...c, [lang]: json.map ?? {} }));
      setOutLang(lang);
    } catch {
      setTransError('Could not reach the translator — check your connection.');
    } finally {
      setTranslating(false);
    }
  }

  if (pages.length === 0) {
    return (
      <div className="container section">
        <div className="card empty-state">
          <h2>Your digital ledger is empty</h2>
          <p>
            Photograph a register page and approve what the AI reads — it will appear here as
            party-wise balances. (The ledger lives in memory: refreshing the browser starts fresh.)
          </p>
          <Link href="/digitize" className="btn btn-primary btn-lg">
            Digitize a page →
          </Link>
        </div>
      </div>
    );
  }

  const balances = computeBalances(viewPages);
  const outstanding = totalOutstanding(balances);
  const top = biggestDebtor(balances);
  const lastPage = viewPages[viewPages.length - 1];
  const unassigned = unassignedRowCount(viewPages);
  const totalRows = viewPages.reduce((n, p) => n + p.rows.length, 0);

  const langOptions: OutLang[] = ['original', ...detected];

  return (
    <div className="container section">
      <div className="page-head">
        <h1>Your digital ledger</h1>
        <p>
          {pages.length} page{pages.length > 1 ? 's' : ''} merged · {totalRows} entries · one book.
        </p>
      </div>

      {detected.length >= 2 && (
        <div className="lang-switch">
          <span className="lang-switch-label">Output language</span>
          <div className="lang-pills" role="group" aria-label="Output language">
            {langOptions.map((opt) => (
              <button
                key={opt}
                type="button"
                className="lang-pill"
                aria-pressed={outLang === opt}
                disabled={translating}
                onClick={() => chooseLang(opt)}
              >
                {opt === 'original' ? 'As written' : LANG_LABELS[opt]}
              </button>
            ))}
          </div>
          {translating && <span className="lang-status">Translating…</span>}
          {!translating && outLang !== 'original' && (
            <span className="lang-status ok">Names normalized · same party across scripts merged</span>
          )}
          {transError && <span className="lang-status err">{transError}</span>}
        </div>
      )}

      <div className="cards-grid">
        <div className="stat-card">
          <div className="stat-label">Total outstanding</div>
          <div className="stat-value money">{formatINR(outstanding)}</div>
          <div className="stat-sub">credits minus payments, all parties</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Biggest debtor</div>
          <div className="stat-value">{top ? top.party : '—'}</div>
          <div className="stat-sub">{top ? `owes ${formatINR(top.balance)}` : 'nobody owes you'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Entries this page</div>
          <div className="stat-value">{lastPage.rows.length}</div>
          <div className="stat-sub">
            page {lastPage.pageNumber} · {MODEL_LABELS[lastPage.model]}
          </div>
        </div>
      </div>

      <div className="table-scroll">
        <table className="balances-table">
          <thead>
            <tr>
              <th>Party</th>
              <th className="num">Entries</th>
              <th className="num">Credit</th>
              <th className="num">Paid</th>
              <th className="num">Balance due</th>
            </tr>
          </thead>
          <tbody>
            {balances.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>
                  No party-wise entries yet — rows need a party name and amount to appear here.
                </td>
              </tr>
            )}
            {balances.map((b) => (
              <tr key={b.party.toLowerCase()}>
                <td>
                  <span className="party-name">{b.party}</span>
                  {b.balance >= FLAG_THRESHOLD && <span className="badge-red">₹5,000+ due</span>}
                </td>
                <td className="num">{b.entries}</td>
                <td className="num">{formatINR(b.credits)}</td>
                <td className="num">{formatINR(b.payments)}</td>
                <td className={`num ${b.balance > 0 ? 'balance-pos' : 'balance-neg'}`}>
                  {formatINR(b.balance)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {unassigned > 0 && (
        <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>
          {unassigned} entr{unassigned === 1 ? 'y' : 'ies'} had no party name — excluded from
          balances but included in exports.
        </p>
      )}

      <div className="pages-strip">
        {pages.map((p) => (
          <span className="page-chip" key={p.id}>
            <b>Page {p.pageNumber}</b> · {MODEL_LABELS[p.model]} · {p.rows.length} rows
          </span>
        ))}
      </div>

      <div className="actions-row">
        <Link href="/digitize" className="btn btn-primary">
          + Add another page
        </Link>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() =>
            // Prepend a UTF-8 BOM (U+FEFF) so Excel / Numbers detect UTF-8 and render
            // Hindi & Telugu correctly. Built from a char code — a literal BOM in the
            // source gets stripped by the compiler.
            downloadFile(
              'kaagazai-ledger.csv',
              String.fromCharCode(0xfeff) + ledgerToCsv(viewPages),
              'text/csv;charset=utf-8'
            )
          }
        >
          ⬇ Export CSV
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => downloadFile('kaagazai-ledger.json', ledgerToJson(viewPages), 'application/json')}
        >
          ⬇ Export JSON
        </button>
        <button
          type="button"
          className="link-danger"
          onClick={() => {
            if (window.confirm('Start a fresh ledger? Current pages will be discarded.')) clearLedger();
          }}
        >
          Start fresh
        </button>
      </div>
    </div>
  );
}
