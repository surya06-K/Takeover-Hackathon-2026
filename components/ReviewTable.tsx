'use client';

import SpeakButton from './SpeakButton';
import { useLang } from './LanguageProvider';
import { uid, type EntryType } from '@/lib/types';
import type { UIStringKey } from '@/lib/i18n';

/**
 * Editable representation of an extracted row: qty/amount stay strings while
 * editing so typing "12.5" or "1,200" feels natural; parsed on save.
 */
export interface ReviewRow {
  id: string;
  date: string;
  party: string;
  item: string;
  qty: string;
  amount: string;
  type: EntryType;
  raw_text: string;
}

export function emptyReviewRow(): ReviewRow {
  return { id: uid(), date: '', party: '', item: '', qty: '', amount: '', type: null, raw_text: '' };
}

/** A row needs a second look if the amount is missing or nobody/nothing is named. */
export function isLowConfidence(row: ReviewRow): boolean {
  return row.amount.trim() === '' || (row.party.trim() === '' && row.item.trim() === '');
}

const TYPE_OPTIONS: { value: string; labelKey: UIStringKey | null }[] = [
  { value: '', labelKey: null },
  { value: 'credit', labelKey: 'typeCredit' },
  { value: 'payment', labelKey: 'typePayment' },
  { value: 'sale', labelKey: 'typeSale' },
  { value: 'stock_in', labelKey: 'typeStockIn' },
  { value: 'stock_out', labelKey: 'typeStockOut' },
];

interface Props {
  rows: ReviewRow[];
  onChange: (rows: ReviewRow[]) => void;
}

export default function ReviewTable({ rows, onChange }: Props) {
  const { tr } = useLang();

  const update = (id: string, patch: Partial<ReviewRow>) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const remove = (id: string) => onChange(rows.filter((r) => r.id !== id));

  const add = () => onChange([...rows, emptyReviewRow()]);

  return (
    <div className="table-scroll">
      <table className="review-table">
        <thead>
          <tr>
            <th aria-label={tr('speak')} style={{ width: '4%' }} />
            <th style={{ width: '12%' }}>{tr('colDate')}</th>
            <th style={{ width: '21%' }}>{tr('colParty')}</th>
            <th style={{ width: '23%' }}>{tr('colItem')}</th>
            <th style={{ width: '8%' }}>{tr('colQty')}</th>
            <th style={{ width: '13%' }}>{tr('colAmount')} ₹</th>
            <th style={{ width: '15%' }}>{tr('colType')}</th>
            <th aria-label={tr('deleteRow')} style={{ width: '4%' }} />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const low = isLowConfidence(row);
            return (
              <RowPair key={row.id} row={row} low={low} onUpdate={update} onRemove={remove} />
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>
                {tr('noRows')}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <button type="button" className="add-row-btn" onClick={add}>
        + {tr('addRow')}
      </button>
    </div>
  );
}

function RowPair({
  row,
  low,
  onUpdate,
  onRemove,
}: {
  row: ReviewRow;
  low: boolean;
  onUpdate: (id: string, patch: Partial<ReviewRow>) => void;
  onRemove: (id: string) => void;
}) {
  const { tr } = useLang();
  const cls = low ? 'row-low' : '';

  const typeKey = TYPE_OPTIONS.find((o) => o.value === (row.type ?? ''))?.labelKey;
  // Spoken version of the row — lets a non-reader verify against their paper.
  const spoken = [
    row.party.trim(),
    row.item.trim(),
    row.qty.trim() && `${row.qty.trim()} ${tr('colQty')}`,
    row.amount.trim() && `${row.amount.trim()} ₹`,
    typeKey ? tr(typeKey) : '',
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <>
      <tr className={cls}>
        <td>
          <SpeakButton text={spoken} compact />
        </td>
        <td>
          <input
            className="cell-input"
            value={row.date}
            placeholder="date"
            onChange={(e) => onUpdate(row.id, { date: e.target.value })}
            aria-label={tr('colDate')}
          />
        </td>
        <td>
          <input
            className="cell-input"
            value={row.party}
            placeholder="party name"
            onChange={(e) => onUpdate(row.id, { party: e.target.value })}
            aria-label={tr('colParty')}
          />
        </td>
        <td>
          <input
            className="cell-input"
            value={row.item}
            placeholder="item"
            onChange={(e) => onUpdate(row.id, { item: e.target.value })}
            aria-label={tr('colItem')}
          />
        </td>
        <td>
          <input
            className="cell-input num"
            value={row.qty}
            placeholder="–"
            inputMode="decimal"
            onChange={(e) => onUpdate(row.id, { qty: e.target.value })}
            aria-label={tr('colQty')}
          />
        </td>
        <td>
          <input
            className="cell-input num"
            value={row.amount}
            placeholder="–"
            inputMode="decimal"
            onChange={(e) => onUpdate(row.id, { amount: e.target.value })}
            aria-label={tr('colAmount')}
          />
        </td>
        <td>
          <select
            className="type-select"
            value={row.type ?? ''}
            onChange={(e) => onUpdate(row.id, { type: (e.target.value || null) as EntryType })}
            aria-label={tr('colType')}
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.labelKey ? tr(o.labelKey) : '—'}
              </option>
            ))}
          </select>
        </td>
        <td>
          <button
            type="button"
            className="icon-btn"
            title={tr('deleteRow')}
            aria-label={tr('deleteRow')}
            onClick={() => onRemove(row.id)}
          >
            ✕
          </button>
        </td>
      </tr>
      {row.raw_text && (
        <tr className={`raw-line ${cls}`}>
          <td colSpan={8}>
            {tr('asWritten')}: “{row.raw_text}”
          </td>
        </tr>
      )}
    </>
  );
}
