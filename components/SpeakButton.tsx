'use client';

import { useState } from 'react';
import { getSpeaking, speak, stopSpeaking } from '@/lib/speech';
import { useA11y } from './AccessibilityProvider';

interface SpeakButtonProps {
  text: string;
  className?: string;
  /** Compact icon-only mode */
  compact?: boolean;
}

/** Tap to hear text aloud — essential for low-literacy users. */
export default function SpeakButton({ text, className = '', compact = false }: SpeakButtonProps) {
  const { locale, tr, feedbackTap } = useA11y();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    feedbackTap();
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
