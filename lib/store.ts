'use client';

/**
 * In-memory ledger store (deliberately localStorage-free).
 * Module state survives client-side navigation; a hard refresh starts fresh.
 */
import { useSyncExternalStore } from 'react';
import { uid, type LedgerPage } from './types';

export interface LedgerState {
  pages: LedgerPage[];
}

let state: LedgerState = { pages: [] };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const SERVER_SNAPSHOT: LedgerState = { pages: [] };

export function useLedger(): LedgerState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => SERVER_SNAPSHOT
  );
}

export function getPages(): LedgerPage[] {
  return state.pages;
}

export function addPage(page: Omit<LedgerPage, 'id' | 'pageNumber' | 'savedAt'>): LedgerPage {
  const saved: LedgerPage = {
    ...page,
    id: uid(),
    pageNumber: state.pages.length + 1,
    savedAt: Date.now(),
  };
  state = { pages: [...state.pages, saved] };
  emit();
  return saved;
}

export function clearLedger() {
  state = { pages: [] };
  emit();
}
