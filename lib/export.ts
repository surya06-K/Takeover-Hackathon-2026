'use client';

import type { LedgerPage } from './types';

export function ledgerToJson(pages: LedgerPage[]): string {
  return JSON.stringify(
    {
      app: 'KaagazAI',
      exported_at: new Date().toISOString(),
      pages: pages.map((p) => ({
        page: p.pageNumber,
        model: p.model,
        register_type: p.registerType,
        confidence: p.confidence,
        notes: p.notes,
        rows: p.rows.map(({ id, ...row }) => row),
      })),
    },
    null,
    2
  );
}

const CSV_HEADER = ['page', 'date', 'party', 'item', 'qty', 'amount', 'type', 'raw_text', 'model'];

export function ledgerToCsv(pages: LedgerPage[]): string {
  const lines = [CSV_HEADER.join(',')];
  for (const page of pages) {
    for (const row of page.rows) {
      lines.push(
        [
          page.pageNumber,
          row.date ?? '',
          row.party ?? '',
          row.item ?? '',
          row.qty ?? '',
          row.amount ?? '',
          row.type ?? '',
          row.raw_text ?? '',
          page.model,
        ]
          .map(csvEscape)
          .join(',')
      );
    }
  }
  return lines.join('\n');
}

function csvEscape(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
