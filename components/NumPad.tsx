'use client';

import { playTap } from '@/lib/audio';

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✓'];

interface NumPadProps {
  value: string;
  onChange: (v: string) => void;
  onConfirm?: () => void;
}

/** Visual number pad — no typing needed for amounts. */
export default function NumPad({ value, onChange, onConfirm }: NumPadProps) {
  function press(key: string) {
    playTap();
    if (key === '⌫') {
      onChange(value.slice(0, -1));
      return;
    }
    if (key === '✓') {
      onConfirm?.();
      return;
    }
    if (value.length >= 8) return;
    onChange(value + key);
  }

  return (
    <div className="numpad" role="group" aria-label="Number pad">
      {DIGITS.map((d) => (
        <button
          key={d}
          type="button"
          className={`numpad-key ${d === '✓' ? 'numpad-ok' : d === '⌫' ? 'numpad-del' : ''}`}
          onClick={() => press(d)}
        >
          {d}
        </button>
      ))}
    </div>
  );
}
