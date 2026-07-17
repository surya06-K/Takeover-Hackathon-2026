'use client';

import { uid, type EntryType } from '@/lib/types';
import SpeakButton from './SpeakButton';

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

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '—' },
  { value: 'credit', label: 'Credit (udhaar)' },
  { value: 'payment', label: 'Payment (jama)' },
  { value: 'sale', label: 'Sale' },
  { value: 'stock', label: 'Stock' },
];

interface Props {
  rows: ReviewRow[];
  onChange: (rows: ReviewRow[]) => void;
}

export default function ReviewTable({ rows, onChange }: Props) {
  const update = (id: string, patch: Partial<ReviewRow>) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const remove = (id: string) => onChange(rows.filter((r) => r.id !== id));

  const add = () => onChange([...rows, emptyReviewRow()]);

  return (
    <div className="table-scroll">
      <table className="review-table">
        <thead>
          <tr>
            <th style={{ width: '13%' }}>Date</th>
            <th style={{ width: '22%' }}>Party</th>
            <th style={{ width: '24%' }}>Item</th>
            <th style={{ width: '9%' }}>Qty</th>
            <th style={{ width: '13%' }}>Amount ₹</th>
            <th style={{ width: '15%' }}>Type</th>
            <th aria-label="Delete" style={{ width: '4%' }} />
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
              <td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>
                No rows yet — add one below.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <button type="button" className="add-row-btn" onClick={add}>
        + Add a row
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
  const cls = low ? 'row-low' : '';
  return (
    <>
      <tr className={cls}>
        <td>
          <input
            className="cell-input"
            value={row.date}
            placeholder="date"
            onChange={(e) => onUpdate(row.id, { date: e.target.value })}
            aria-label="Date"
          />
        </td>
        <td>
          <input
            className="cell-input"
            value={row.party}
            placeholder="party name"
            onChange={(e) => onUpdate(row.id, { party: e.target.value })}
            aria-label="Party"
          />
        </td>
        <td>
          <input
            className="cell-input"
            value={row.item}
            placeholder="item"
            onChange={(e) => onUpdate(row.id, { item: e.target.value })}
            aria-label="Item"
          />
        </td>
        <td>
          <input
            className="cell-input num"
            value={row.qty}
            placeholder="–"
            inputMode="decimal"
            onChange={(e) => onUpdate(row.id, { qty: e.target.value })}
            aria-label="Quantity"
          />
        </td>
        <td>
          <input
            className="cell-input num"
            value={row.amount}
            placeholder="–"
            inputMode="decimal"
            onChange={(e) => onUpdate(row.id, { amount: e.target.value })}
            aria-label="Amount in rupees"
          />
        </td>
        <td>
          <select
            className="type-select"
            value={row.type ?? ''}
            onChange={(e) => onUpdate(row.id, { type: (e.target.value || null) as EntryType })}
            aria-label="Entry type"
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </td>
        <td>
          <button
            type="button"
            className="icon-btn"
            title="Delete row"
            aria-label="Delete row"
            onClick={() => onRemove(row.id)}
          >
            ✕
          </button>
        </td>
      </tr>
      {row.raw_text && (
        <tr className={`raw-line ${cls}`}>
          <td colSpan={6}>as written: “{row.raw_text}”</td>
          <td>
            <SpeakButton
              compact
              text={[row.party, row.item, row.amount ? `${row.amount} rupees` : ''].filter(Boolean).join(', ')}
            />
          </td>
        </tr>
      )}
    </>
  );
}
