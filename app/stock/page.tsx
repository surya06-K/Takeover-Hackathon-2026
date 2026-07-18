'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import NumPad from '@/components/NumPad';
import SpeakButton from '@/components/SpeakButton';
import { useLang } from '@/components/LanguageProvider';
import { playError, playSuccess } from '@/lib/audio';

interface ItemAgg {
  item: string;
  in: number;
  out: number;
  net: number;
  movements: number;
  minQty: number | null;
  needsRestock: boolean;
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
  stats: { itemCount: number; lowStockCount: number; restockCount: number; movementCount: number };
  items: ItemAgg[];
  entries: StockEntry[];
}

/** Which sheet is open for which item — only one at a time, tap to close. */
type Sheet = { item: string; mode: 'remind' | 'in' | 'out' } | null;

export default function StockPage() {
  const { tr } = useLang();
  const [data, setData] = useState<StockData | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [pad, setPad] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    fetch('/api/stock')
      .then((r) => r.json())
      .then((j) => j?.ok && setData(j))
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openSheet(item: string, mode: 'remind' | 'in' | 'out', current?: number | null) {
    setSheet({ item, mode });
    setPad(current != null ? String(current) : '');
    setError('');
  }

  function closeSheet() {
    setSheet(null);
    setPad('');
    setError('');
  }

  async function confirmSheet() {
    if (!sheet) return;
    const n = parseFloat(pad);
    if (!Number.isFinite(n) || n < 0 || (sheet.mode !== 'remind' && n <= 0)) return;
    setBusy(true);
    try {
      const res = await fetch(sheet.mode === 'remind' ? '/api/stock/reminder' : '/api/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          sheet.mode === 'remind'
            ? { item: sheet.item, minQty: n }
            : { item: sheet.item, qty: n, direction: sheet.mode }
        ),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? tr('errorGeneric'));
        playError();
        return;
      }
      playSuccess();
      closeSheet();
      load();
    } finally {
      setBusy(false);
    }
  }

  async function clearReminder(item: string) {
    setBusy(true);
    try {
      await fetch('/api/stock/reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item, minQty: null }),
      });
      playSuccess();
      closeSheet();
      load();
    } finally {
      setBusy(false);
    }
  }

  if (data && data.items.length === 0) {
    return (
      <div className="container section">
        <div className="page-head" style={{ paddingTop: 26 }}>
          <h1>{tr('stockTitle')}</h1>
          <p>{tr('stockSubtitle')}</p>
        </div>
        <div className="card soon-card">
          <div className="big" aria-hidden>
            📦
          </div>
          <h2>{tr('noStockTitle')}</h2>
          <p>{tr('noStockDesc')}</p>
          <Link href="/scan" className="btn btn-primary btn-lg" style={{ marginTop: 18 }}>
            📷 {tr('scanPage')} →
          </Link>
        </div>
      </div>
    );
  }

  const restockItems = data?.items.filter((i) => i.needsRestock) ?? [];
  const restockSpoken = restockItems.map((i) => `${i.item}, ${i.net} ${tr('left')}`).join('. ');

  return (
    <div className="container">
      <div className="page-head" style={{ paddingTop: 26 }}>
        <h1>{tr('stockTitle')}</h1>
        <p>
          {data ? `${data.stats.itemCount} ${tr('items')} · ${data.stats.movementCount} ${tr('movements')}` : tr('loading')}
        </p>
      </div>

      {restockItems.length > 0 && (
        <>
          <label className="field-label" style={{ marginTop: 0 }}>
            🔔 {tr('restockReminders')} <SpeakButton text={restockSpoken} compact />
          </label>
          <div className="restock-strip">
            {restockItems.map((i) => (
              <button
                key={i.item.toLowerCase()}
                type="button"
                className="restock-item"
                onClick={() => openSheet(i.item, 'remind', i.minQty)}
              >
                <span className="restock-item-name">{i.item}</span>
                <span className="restock-item-qty">
                  {i.net} {tr('left')}
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      <div className="cards-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="stat-card">
          <div className="stat-label">{tr('itemsTracked')}</div>
          <div className="stat-value">{data?.stats.itemCount ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{tr('outOfStock')}</div>
          <div className="stat-value" style={{ color: 'var(--red)' }}>
            {data?.stats.lowStockCount ?? 0}
          </div>
          <div className="stat-sub">{tr('outOfStockSub')}</div>
        </div>
      </div>

      <div className="table-scroll">
        <table className="balances-table">
          <thead>
            <tr>
              <th>{tr('colItem')}</th>
              <th className="num">{tr('colIn')}</th>
              <th className="num">{tr('colOut')}</th>
              <th className="num">{tr('colNet')}</th>
              <th aria-label={tr('remindAt')} />
            </tr>
          </thead>
          <tbody>
            {data?.items.map((i) => {
              const key = i.item.toLowerCase();
              const open = sheet?.item === i.item;
              return (
                <Fragment key={key}>
                  <tr className={open ? 'row-active' : ''}>
                    <td>
                      <button type="button" className="item-name-btn" onClick={() => (open ? closeSheet() : setSheet({ item: i.item, mode: 'in' }) )}>
                        <span className="party-name">{i.item}</span>
                      </button>
                      {i.net <= 0 && <span className="badge-red">{tr('outOfStock')}</span>}
                      {i.minQty != null && <span className="badge-bell">🔔 {i.minQty}</span>}
                    </td>
                    <td className="num">{i.in}</td>
                    <td className="num">{i.out}</td>
                    <td className={`num ${i.net > 0 ? 'balance-pos' : 'balance-neg'}`}>{i.net}</td>
                    <td>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={tr('remindAt')}
                        onClick={() => openSheet(i.item, 'remind', i.minQty)}
                      >
                        🔔
                      </button>
                    </td>
                  </tr>
                  {open && (
                    <tr className="sheet-row">
                      <td colSpan={5}>
                        <ItemSheet
                          item={i.item}
                          net={i.net}
                          minQty={i.minQty}
                          sheet={sheet}
                          pad={pad}
                          busy={busy}
                          error={error}
                          onMode={(mode) => openSheet(i.item, mode, mode === 'remind' ? i.minQty : null)}
                          onPad={setPad}
                          onConfirm={confirmSheet}
                          onClear={() => clearReminder(i.item)}
                          onClose={closeSheet}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="actions-row">
        <Link href="/scan" className="btn btn-primary">
          + {tr('scanAnother')}
        </Link>
        <a href="/api/export?format=csv&section=stock" className="btn btn-ghost">
          ⬇ {tr('exportCsv')}
        </a>
      </div>
    </div>
  );
}

function ItemSheet({
  item,
  net,
  minQty,
  sheet,
  pad,
  busy,
  error,
  onMode,
  onPad,
  onConfirm,
  onClear,
  onClose,
}: {
  item: string;
  net: number;
  minQty: number | null;
  sheet: Sheet;
  pad: string;
  busy: boolean;
  error: string;
  onMode: (mode: 'remind' | 'in' | 'out') => void;
  onPad: (v: string) => void;
  onConfirm: () => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const { tr } = useLang();
  if (!sheet || sheet.item !== item) return null;

  return (
    <div className="card entry-card item-sheet">
      <div className="sheet-head">
        <strong>{item}</strong>
        <span className="muted">
          {net} {tr('left')}
        </span>
        <button type="button" className="icon-btn" aria-label={tr('close')} onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="sheet-tabs">
        <button type="button" className={`sheet-tab ${sheet.mode === 'in' ? 'active' : ''}`} onClick={() => onMode('in')}>
          + {tr('stockIn')}
        </button>
        <button type="button" className={`sheet-tab ${sheet.mode === 'out' ? 'active' : ''}`} onClick={() => onMode('out')}>
          − {tr('stockOut')}
        </button>
        <button type="button" className={`sheet-tab ${sheet.mode === 'remind' ? 'active' : ''}`} onClick={() => onMode('remind')}>
          {tr('remindTab')}
        </button>
      </div>

      <div className="amount-display">{pad || '0'}</div>
      <NumPad value={pad} onChange={onPad} onConfirm={onConfirm} />

      <div className="two-actions" style={{ marginTop: 14, marginBottom: 0 }}>
        <button type="button" className="btn btn-primary btn-lg" disabled={busy || pad === ''} onClick={onConfirm}>
          {sheet.mode === 'remind' ? tr('setReminder') : sheet.mode === 'in' ? tr('stockIn') : tr('stockOut')}
        </button>
        {sheet.mode === 'remind' && minQty != null && (
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={onClear}>
            {tr('removeReminder')}
          </button>
        )}
      </div>
      {error && <div className="form-error">{error}</div>}
    </div>
  );
}
