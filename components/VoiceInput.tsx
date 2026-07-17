'use client';

import { useState } from 'react';
import { listen } from '@/lib/speech';
import { useA11y } from './AccessibilityProvider';

interface VoiceInputProps {
  onResult: (text: string) => void;
  mode?: 'name' | 'number' | 'general';
  label?: string;
}

/** Microphone button — speak instead of type. */
export default function VoiceInput({ onResult, mode = 'general', label }: VoiceInputProps) {
  const { locale, tr, feedbackTap, feedbackError, say } = useA11y();
  const [listening, setListening] = useState(false);

  async function start() {
    feedbackTap();
    setListening(true);
    await say(mode === 'number' ? tr('voiceAmount') : tr('voiceSearch'));
    const text = await listen({ locale, mode });
    setListening(false);
    if (text) {
      onResult(text);
    } else {
      feedbackError();
    }
  }

  return (
    <button
      type="button"
      className={`voice-btn ${listening ? 'listening' : ''}`}
      onClick={start}
      disabled={listening}
      aria-label={label ?? tr('voiceSearch')}
      title={label ?? tr('voiceSearch')}
    >
      {listening ? '🎙️…' : '🎤'}
    </button>
  );
}
