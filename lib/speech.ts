/** Browser speech synthesis and recognition — client-only. */

import type { UILocale } from './i18n';

export type SpeechLang = 'en-IN' | 'hi-IN';

export function speechLang(locale: UILocale): SpeechLang {
  return locale === 'hi' ? 'hi-IN' : 'en-IN';
}

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function isRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
}

let speaking = false;

export function stopSpeaking(): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  speaking = false;
}

export function getSpeaking(): boolean {
  return speaking;
}

/** Read text aloud. Returns a promise that resolves when done or fails silently. */
export function speak(text: string, locale: UILocale = 'hi'): Promise<void> {
  return new Promise((resolve) => {
    if (!text.trim() || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      resolve();
      return;
    }

    stopSpeaking();

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = speechLang(locale);
    utter.rate = locale === 'hi' ? 0.92 : 1;
    utter.pitch = 1;

    utter.onend = () => {
      speaking = false;
      resolve();
    };
    utter.onerror = () => {
      speaking = false;
      resolve();
    };

    speaking = true;
    window.speechSynthesis.speak(utter);
  });
}

/** Pick a Hindi voice if available, else fall back to default. */
export function warmUpVoices(): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.getVoices();
}

interface ListenOptions {
  locale?: UILocale;
  /** Hint for recognition: 'name' | 'number' | 'general' */
  mode?: 'name' | 'number' | 'general';
  timeoutMs?: number;
}

/** Speech-to-text. Resolves with transcript or empty string on failure. */
export function listen(opts: ListenOptions = {}): Promise<string> {
  const { locale = 'hi', mode = 'general', timeoutMs = 8000 } = opts;

  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve('');
      return;
    }

    const SR =
      (window as unknown as { SpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;

    if (!SR) {
      resolve('');
      return;
    }

    const rec = new SR();
    rec.lang = speechLang(locale);
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    let done = false;
    const finish = (text: string) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try {
        rec.stop();
      } catch {
        /* already stopped */
      }
      resolve(text);
    };

    const timer = setTimeout(() => finish(''), timeoutMs);

    rec.onresult = (ev: SpeechRecognitionEvent) => {
      let transcript = ev.results[0]?.[0]?.transcript ?? '';
      if (mode === 'number') {
        transcript = parseSpokenNumber(transcript);
      }
      finish(transcript.trim());
    };

    rec.onerror = () => finish('');
    rec.onend = () => {
      if (!done) finish('');
    };

    try {
      rec.start();
    } catch {
      finish('');
    }
  });
}

/** Extract digits / Hindi number words from spoken input. */
function parseSpokenNumber(text: string): string {
  const digitMap: Record<string, string> = {
    zero: '0', one: '1', two: '2', three: '3', four: '4',
    five: '5', six: '6', seven: '7', eight: '8', nine: '9',
    शून्य: '0', एक: '1', दो: '2', तीन: '3', चार: '4',
    पाँच: '5', पांच: '5', छह: '6', सात: '7', आठ: '8', नौ: '9',
    दस: '10', बीस: '20', तीस: '30', चालीस: '40', पचास: '50',
    साठ: '60', सत्तर: '70', अस्सी: '80', नब्बे: '90',
    सौ: '00', हज़ार: '000', hazar: '000', hundred: '00', thousand: '000',
  };

  // Direct digits first
  const digits = text.replace(/\D/g, '');
  if (digits.length >= 1) return digits;

  // Try word replacement for Hindi/English number words
  let normalized = text.toLowerCase();
  for (const [word, val] of Object.entries(digitMap)) {
    normalized = normalized.replace(new RegExp(word, 'gi'), val);
  }
  const extracted = normalized.replace(/\D/g, '');
  return extracted;
}
