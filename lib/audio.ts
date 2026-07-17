/** Short audio cues for success / error — Web Audio API, no files needed. */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
  }
  return ctx;
}

function tone(freq: number, duration: number, type: OscillatorType = 'sine', gain = 0.15): void {
  const c = getCtx();
  if (!c) return;

  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.value = gain;
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
  osc.connect(g);
  g.connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + duration);
}

export function playSuccess(): void {
  tone(523, 0.12);
  setTimeout(() => tone(659, 0.15), 100);
}

export function playError(): void {
  tone(220, 0.2, 'square', 0.08);
}

export function playTap(): void {
  tone(440, 0.06, 'sine', 0.06);
}
