import { memoryStore } from './memory';
import { supabaseConfigured, supabaseStore } from './supabase';
import type { KaagazStore } from './types';

export * from './types';

/**
 * Store facade: Supabase when configured (production), otherwise the
 * in-process memory store (zero-config local demo). Same interface either way.
 */
export function db(): KaagazStore {
  return supabaseConfigured() ? supabaseStore : memoryStore;
}
