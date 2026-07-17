/** Language/script utilities — pure, safe on both client and server. */

export type LangCode = 'en' | 'hi' | 'te';

export const LANG_LABELS: Record<LangCode, string> = {
  en: 'English',
  hi: 'हिन्दी',
  te: 'తెలుగు',
};

/** Human names used in prompts / notes. */
export const LANG_NAMES: Record<LangCode, string> = {
  en: 'English (Latin/roman script)',
  hi: 'Hindi (Devanagari script)',
  te: 'Telugu script',
};

const SCRIPT_RANGES: { code: LangCode; re: RegExp }[] = [
  { code: 'hi', re: /[ऀ-ॿ]/ }, // Devanagari
  { code: 'te', re: /[ఀ-౿]/ }, // Telugu
  { code: 'en', re: /[A-Za-z]/ }, // Latin
];

/** Which of our supported scripts appear anywhere in the given strings. */
export function detectLangs(texts: (string | null | undefined)[]): LangCode[] {
  const found = new Set<LangCode>();
  for (const t of texts) {
    if (!t) continue;
    for (const { code, re } of SCRIPT_RANGES) if (re.test(t)) found.add(code);
  }
  // stable, predictable order
  return (['en', 'hi', 'te'] as LangCode[]).filter((c) => found.has(c));
}

export function isLangCode(v: unknown): v is LangCode {
  return v === 'en' || v === 'hi' || v === 'te';
}
