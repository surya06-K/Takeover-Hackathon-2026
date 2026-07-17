import { NextResponse } from 'next/server';
import { LANG_NAMES, isLangCode, type LangCode } from '@/lib/lang';

export const runtime = 'nodejs';
export const maxDuration = 60;

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
const MODEL_TIMEOUT_MS = 45_000;
const MAX_TEXTS = 400;

/** POST { texts: string[], target: 'en'|'hi'|'te' } -> { ok, map: { orig: translated } } */
export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Bad request.' }, { status: 400 });
  }

  const target = body?.target;
  if (!isLangCode(target)) {
    return NextResponse.json({ ok: false, error: 'Unknown target language.' }, { status: 400 });
  }

  const rawTexts: unknown = body?.texts;
  const texts: string[] = Array.isArray(rawTexts)
    ? [...new Set(rawTexts.filter((t): t is string => typeof t === 'string' && t.trim() !== ''))].slice(0, MAX_TEXTS)
    : [];

  if (texts.length === 0) return NextResponse.json({ ok: true, model: 'none', map: {} });

  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  const groqKey = process.env.GROQ_API_KEY?.trim();
  const mock = process.env.KAAGAZ_MOCK === '1' || (!geminiKey && !groqKey);

  if (mock) {
    return NextResponse.json({ ok: true, model: 'sample', map: fallbackTranslate(texts, target) });
  }

  const prompt = buildPrompt(texts, target);
  const failures: string[] = [];

  if (geminiKey) {
    try {
      const map = ensureComplete(await callGemini(geminiKey, prompt), texts);
      return NextResponse.json({ ok: true, model: 'gemini', map });
    } catch (err) {
      failures.push(`Gemini: ${errMessage(err)}`);
    }
  }
  if (groqKey) {
    try {
      const map = ensureComplete(await callGroq(groqKey, prompt), texts);
      return NextResponse.json({ ok: true, model: 'groq', map });
    } catch (err) {
      failures.push(`Groq: ${errMessage(err)}`);
    }
  }

  // Both models failed — fall back to the built-in dictionary rather than error out,
  // so the language switch degrades gracefully instead of breaking the ledger.
  console.error('[translate] models failed, using dictionary:', failures.join(' | '));
  return NextResponse.json({ ok: true, model: 'sample', map: fallbackTranslate(texts, target) });
}

/* --------------------------------- prompt ---------------------------------- */

function buildPrompt(texts: string[], target: LangCode): string {
  return (
    `You normalize short fields from a handwritten Indian shop register into ONE target language: ${LANG_NAMES[target]}.\n` +
    `Input is a JSON array of strings (people's names, shop names, product/item descriptions), possibly mixing Hindi, Telugu, English and Hinglish.\n` +
    `For EACH input string produce its equivalent in the target language:\n` +
    `- Transliterate proper names (people, shops) into the target script — keep the SAME name, do not translate its meaning. e.g. "रमेश यादव" -> English "Ramesh Yadav"; "Sunita Devi" -> Hindi "सुनीता देवी".\n` +
    `- Translate generic product/item words into the target language; keep numbers and units (kg, L, x2) unchanged. e.g. "आटा 10kg" -> English "Atta (wheat flour) 10kg".\n` +
    `Respond ONLY strict JSON of the form { "map": { "<original>": "<result>", ... } }. Use each original string EXACTLY as the key. Include every input. No commentary.\n\n` +
    `Input: ${JSON.stringify(texts)}`
  );
}

/* --------------------------------- Gemini ---------------------------------- */

async function callGemini(key: string, prompt: string): Promise<Record<string, string>> {
  const res = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json' },
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text().catch(() => '')).slice(0, 200)}`);
  const json = await res.json();
  const text: string = (json?.candidates?.[0]?.content?.parts ?? []).map((p: any) => p?.text ?? '').join('');
  return parseMap(text);
}

/* ----------------------------------- Groq ---------------------------------- */

async function callGroq(key: string, prompt: string): Promise<Record<string, string>> {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text().catch(() => '')).slice(0, 200)}`);
  const json = await res.json();
  return parseMap(json?.choices?.[0]?.message?.content ?? '');
}

/* ------------------------------ JSON hardening ----------------------------- */

function parseMap(text: string): Record<string, string> {
  let s = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('no JSON object');
  const parsed = JSON.parse(s.slice(start, end + 1));
  const raw = parsed?.map ?? parsed;
  const out: Record<string, string> = {};
  if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw)) if (typeof v === 'string' && v.trim()) out[k] = v.trim();
  }
  return out;
}

/** Guarantee an entry for every requested string (missing -> unchanged). */
function ensureComplete(map: Record<string, string>, texts: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const t of texts) out[t] = map[t] ?? t;
  return out;
}

/* --------------------- built-in dictionary (no-key mode) ------------------- */

interface Entity {
  en: string;
  hi: string;
  te: string;
  aliases?: string[];
}

// Covers the built-in sample register + the shipped sample photos so the
// feature demos convincingly even with no API keys. Live keys use the model.
const ENTITIES: Entity[] = [
  { en: 'Ramesh Yadav', hi: 'रमेश यादव', te: 'రమేష్ యాదవ్', aliases: ['ramesh kirana', 'रमेश किराना', 'रमेश', 'ramesh'] },
  { en: 'Sunita Devi', hi: 'सुनीता देवी', te: 'సునీత దేవి', aliases: ['sunitha devi', 'सुनीता'] },
  { en: 'Lakshmi General', hi: 'लक्ष्मी जनरल', te: 'లక్ష్మి జనరల్', aliases: ['లక్ష్మి జనరల్'] },
  { en: 'Anand Traders', hi: 'आनंद ट्रेडर्स', te: 'ఆనంద్ ట్రేడర్స్' },
  { en: 'Bhavani Stores', hi: 'भवानी स्टोर्स', te: 'భవాని స్టోర్స్' },
  { en: 'Mohd. Irfan', hi: 'मोहम्मद इरफ़ान', te: 'మొహమ్మద్ ఇర్ఫాన్', aliases: ['md. irfan', 'irfan', 'md irfan'] },
  { en: 'Gopal', hi: 'गोपाल', te: 'గోపాల్' },
  { en: 'Kumar Kirana Store', hi: 'कुमार किराना स्टोर', te: 'కుమార్ కిరాణా స్టోర్' },
  { en: 'Shri Ganesh General Store', hi: 'श्री गणेश जनरल स्टोर', te: 'శ్రీ గణేష్ జనరల్ స్టోర్' },
];

// Item head-words used for token-level fallback translation.
const WORDS: { forms: string[]; en: string; hi: string; te: string }[] = [
  { forms: ['atta', 'आटा', 'పిండి'], en: 'Atta', hi: 'आटा', te: 'పిండి' },
  { forms: ['tel', 'oil', 'तेल', 'నూనె'], en: 'Oil', hi: 'तेल', te: 'నూనె' },
  { forms: ['chawal', 'rice', 'चावल', 'బియ్యం'], en: 'Rice', hi: 'चावल', te: 'బియ్యం' },
  { forms: ['chini', 'sugar', 'चीनी', 'చక్కెర'], en: 'Sugar', hi: 'चीनी', te: 'చక్కెర' },
  { forms: ['dal', 'दाल', 'పప్పు'], en: 'Dal', hi: 'दाल', te: 'పప్పు' },
  { forms: ['sabun', 'soap', 'साबुन', 'सबुन', 'సబ్బు'], en: 'Soap', hi: 'साबुन', te: 'సబ్బు' },
  { forms: ['biscuit', 'बिस्किट', 'బిస్కెట్'], en: 'Biscuit', hi: 'बिस्किट', te: 'బిస్కెట్' },
  { forms: ['namkeen', 'नमकीन', 'నమ్‌కీన్'], en: 'Namkeen', hi: 'नमकीन', te: 'నమ్‌కీన్' },
];

function fallbackTranslate(texts: string[], target: LangCode): Record<string, string> {
  const out: Record<string, string> = {};
  for (const t of texts) out[t] = fallbackOne(t, target);
  return out;
}

function fallbackOne(text: string, target: LangCode): string {
  const norm = text.trim().toLowerCase();
  // whole-string entity match (names / shops)
  for (const e of ENTITIES) {
    const keys = [e.en, e.hi, e.te, ...(e.aliases ?? [])].map((k) => k.toLowerCase());
    if (keys.includes(norm)) return e[target];
  }
  // token-level: swap known item words, keep the rest (numbers, units) intact
  let result = text;
  let changed = false;
  for (const w of WORDS) {
    for (const form of w.forms) {
      const re = new RegExp(`(^|[^\\p{L}])(${escapeRe(form)})(?=[^\\p{L}]|$)`, 'giu');
      if (re.test(result)) {
        result = result.replace(re, (_m, pre) => `${pre}${w[target]}`);
        changed = true;
      }
    }
  }
  return changed ? result : text;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* --------------------------------- helpers --------------------------------- */

function errMessage(err: unknown): string {
  if (err instanceof Error) return err.name === 'TimeoutError' ? 'timed out' : err.message;
  return String(err);
}
