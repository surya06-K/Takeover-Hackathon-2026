'use client';

import { useState } from 'react';
import { getSpeaking, speak, stopSpeaking } from '@/lib/speech';
import { useLang } from './LanguageProvider';

interface SpeakButtonProps {
  text: string;
  /** Icon-only mode for tight rows/tables. */
  compact?: boolean;
  className?: string;
}

/** Tap to hear text aloud — the ears of the app for non-readers. */
export default function SpeakButton({ text, compact = false, className = '' }: SpeakButtonProps) {
  const { locale, tr } = useLang();
  const [busy, setBusy] = useState(false);

  async function toggle(e: React.MouseEvent) {
    // Speak buttons sit inside links/rows — listening must not navigate.
    e.preventDefault();
    e.stopPropagation();
    if (getSpeaking()) {
      stopSpeaking();
      setBusy(false);
      return;
    }
    setBusy(true);
    await speak(text, locale);
    setBusy(false);
  }

  return (
    <button
      type="button"
      className={`speak-btn ${compact ? 'speak-btn-compact' : ''} ${className}`}
      onClick={toggle}
      aria-label={busy ? tr('speakStop') : tr('speak')}
      title={tr('speak')}
    >
      {busy ? '🔊' : '🔈'}
      {!compact && <span>{tr('speak')}</span>}
    </button>
  );
}
