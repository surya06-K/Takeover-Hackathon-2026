'use client';

import { useEffect, useState } from 'react';
import { playError } from '@/lib/audio';
import { isRecognitionSupported, listen } from '@/lib/speech';
import { useLang } from './LanguageProvider';

interface VoiceInputProps {
  onResult: (text: string) => void;
  mode?: 'name' | 'number' | 'general';
  label?: string;
}

/** Microphone button — speak instead of type. Hidden when the browser can't listen. */
export default function VoiceInput({ onResult, mode = 'general', label }: VoiceInputProps) {
  const { locale, tr } = useLang();
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => setSupported(isRecognitionSupported()), []);

  if (!supported) return null;

  async function start() {
    setListening(true);
    const text = await listen({ locale, mode });
    setListening(false);
    if (text) onResult(text);
    else playError();
  }

  return (
    <button
      type="button"
      className={`voice-btn ${listening ? 'listening' : ''}`}
      onClick={start}
      disabled={listening}
      aria-label={label ?? (mode === 'number' ? tr('voiceAmount') : tr('voiceSearch'))}
      title={label ?? (mode === 'number' ? tr('voiceAmount') : tr('voiceSearch'))}
    >
      {listening ? '🎙️' : '🎤'}
    </button>
  );
}
