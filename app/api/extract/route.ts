import { NextResponse } from 'next/server';
import type { EntryType, ExtractResult, ExtractedRow, ModelId } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const SYSTEM_PROMPT =
  "You are an expert at reading handwritten Indian business registers (Hindi, Telugu, English, Hinglish mixed). " +
  "A single page often mixes different kinds of entries — udhaar given, payments received, cash sales, stock movements " +
  "— and each row must be tagged with the PRECISE category below so it can be routed automatically:\n" +
  "- \"credit\": goods or money given to a party ON CREDIT (udhaar/udhar) — increases what they owe. Look for words like " +
  "udhaar, udhar, khata, or an amount with no cash/payment mentioned against a named customer.\n" +
  "- \"payment\": money the shopkeeper RECEIVED from a party against an existing due — decreases what they owe. Look for " +
  "jama, mila, paid, received, cash/UPI/cheque against a name.\n" +
  "- \"sale\": a direct CASH sale or bill — goods sold and paid for immediately, no running balance with a party (the " +
  "party name may be absent — \"walk-in\").\n" +
  "- \"stock_in\": inventory RECEIVED into the shop (goods purchased/arrived from a supplier) — no customer balance involved.\n" +
  "- \"stock_out\": inventory taken OUT for a reason other than a recorded sale (damaged, given away, transferred) — rare; " +
  "prefer \"sale\" when goods clearly left in exchange for money.\n" +
  "Extract every row exactly as written; do not skip any. Respond ONLY strict JSON: { register_type: string, " +
  "confidence: number, rows: [{ date: string|null, party: string|null, item: string|null, qty: number|null, " +
  "amount: number|null, type: 'credit'|'payment'|'sale'|'stock_in'|'stock_out'|null, raw_text: string }], notes: string }. " +
  "If a value is unreadable or the category is genuinely ambiguous, set it null and preserve raw_text — never invent or guess.";

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
const MODEL_TIMEOUT_MS = 55_000;

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return friendly(400, 'That upload did not come through properly. Please try again.');
  }

  const image: unknown = body?.image;
  if (typeof image !== 'string' || image.length < 100) {
    return friendly(400, 'No photo received. Please pick or take a photo first.');
  }

  const { base64, mimeType } = splitDataUrl(image, body?.mimeType);
  const registerType: string = typeof body?.registerType === 'string' ? body.registerType : 'auto-detect';
  const hint =
    registerType && registerType !== 'auto-detect'
      ? `The user says this page is a "${registerType}". Extract every row.`
      : 'Auto-detect the register type. Extract every row.';

  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  const groqKey = process.env.GROQ_API_KEY?.trim();
  const mock = process.env.KAAGAZ_MOCK === '1' || (!geminiKey && !groqKey);

  if (mock) {
    // No keys configured (or demo mode forced): serve honest, labelled sample data
    // so the whole flow can be exercised without external APIs.
    const pageNumber = Number(body?.page) || 1;
    return NextResponse.json({ ok: true, model: 'sample' satisfies ModelId, data: samplePage(pageNumber) });
  }

  const failures: string[] = [];

  if (geminiKey) {
    try {
      const data = await callGemini(geminiKey, base64, mimeType, hint);
      return NextResponse.json({ ok: true, model: 'gemini' satisfies ModelId, data });
    } catch (err) {
      failures.push(`Gemini: ${errMessage(err)}`);
    }
  } else {
    failures.push('Gemini: GEMINI_API_KEY not set');
  }

  if (groqKey) {
    try {
      const data = await callGroq(groqKey, base64, mimeType, hint);
      return NextResponse.json({ ok: true, model: 'groq' satisfies ModelId, data });
    } catch (err) {
      failures.push(`Groq: ${errMessage(err)}`);
    }
  } else {
    failures.push('Groq: GROQ_API_KEY not set');
  }

  console.error('[extract] all readers failed:', failures.join(' | '));
  return friendly(
    502,
    'Both AI readers are unavailable right now. Check your connection and try again in a moment — your photo is still here.',
    failures.join(' | ')
  );
}

/* ---------------------------------- Gemini --------------------------------- */

async function callGemini(
  key: string,
  base64: string,
  mimeType: string,
  hint: string
): Promise<ExtractResult> {
  const res = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [
        {
          role: 'user',
          parts: [{ inlineData: { mimeType, data: base64 } }, { text: hint }],
        },
      ],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${detail.slice(0, 300)}`);
  }
  const json = await res.json();
  const text: string = (json?.candidates?.[0]?.content?.parts ?? [])
    .map((p: any) => p?.text ?? '')
    .join('');
  if (!text) throw new Error('empty response');
  return parseModelJson(text);
}

/* ----------------------------------- Groq ---------------------------------- */

async function callGroq(
  key: string,
  base64: string,
  mimeType: string,
  hint: string
): Promise<ExtractResult> {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: `${SYSTEM_PROMPT}\n\n${hint}\nRespond with the JSON object only — no markdown fences.` },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${detail.slice(0, 300)}`);
  }
  const json = await res.json();
  const text: string = json?.choices?.[0]?.message?.content ?? '';
  if (!text) throw new Error('empty response');
  return parseModelJson(text);
}

/* ------------------------------ JSON hardening ----------------------------- */

/** Parse model output defensively: strip fences, isolate the outermost object,
 *  then coerce every field to the contract so the UI never sees junk. */
function parseModelJson(text: string): ExtractResult {
  let s = text.trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('no JSON object in response');
  const parsed = JSON.parse(s.slice(start, end + 1));

  const rowsIn = Array.isArray(parsed?.rows) ? parsed.rows : [];
  const rows: ExtractedRow[] = rowsIn.map(normalizeRow);

  let confidence = numOrNull(parsed?.confidence) ?? 0.5;
  if (confidence > 1 && confidence <= 100) confidence /= 100; // models sometimes answer in %
  confidence = Math.min(1, Math.max(0, confidence));

  return {
    register_type: strOrNull(parsed?.register_type) ?? 'unknown',
    confidence,
    rows,
    notes: strOrNull(parsed?.notes) ?? '',
  };
}

const ENTRY_TYPES = ['credit', 'payment', 'sale', 'stock_in', 'stock_out'] as const;

function normalizeRow(r: any): ExtractedRow {
  const type = typeof r?.type === 'string' ? r.type.toLowerCase().trim() : null;
  return {
    date: strOrNull(r?.date),
    party: strOrNull(r?.party),
    item: strOrNull(r?.item),
    qty: numOrNull(r?.qty),
    amount: numOrNull(r?.amount),
    type: (ENTRY_TYPES as readonly string[]).includes(type ?? '') ? (type as EntryType) : null,
    raw_text: typeof r?.raw_text === 'string' ? r.raw_text : '',
  };
}

function strOrNull(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s && s.toLowerCase() !== 'null' ? s : null;
}

function numOrNull(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/[₹,\s]/g, ''));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/* --------------------------------- helpers --------------------------------- */

function splitDataUrl(image: string, fallbackMime?: unknown): { base64: string; mimeType: string } {
  const match = /^data:([^;,]+);base64,(.*)$/s.exec(image);
  if (match) return { mimeType: match[1], base64: match[2] };
  return {
    mimeType: typeof fallbackMime === 'string' && fallbackMime ? fallbackMime : 'image/jpeg',
    base64: image,
  };
}

function errMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.name === 'TimeoutError' ? 'timed out' : err.message;
  }
  return String(err);
}

function friendly(status: number, error: string, detail?: string) {
  return NextResponse.json({ ok: false, error, detail }, { status });
}

/* ------------------------- built-in sample register ------------------------ */
/** Two pages of a realistic kirana register so the demo works end-to-end
 *  without API keys — each page mixes udhaar, cash-sale and stock rows just
 *  like a real shopkeeper's book, so auto-routing can be exercised offline.
 *  Clearly labelled `model: "sample"` in the UI. */
function samplePage(pageNumber: number): ExtractResult {
  const pages: ExtractResult[] = [
    {
      register_type: 'Kirana Store Ledger',
      confidence: 0.86,
      notes:
        'Sample page 1 (built-in demo data — add GEMINI_API_KEY to read real photos). Names appear in Hindi, Telugu and English, just like a real register. Amount for लक्ष्मी जनरल was smudged.',
      rows: [
        { date: '02/07/2026', party: 'Lakshmi General', item: 'Soap Meda', qty: 4, amount: 81, type: 'sale', raw_text: '1) लक्ष्मी जनरल - సబ్బు మెడ x4 → 81-' },
        { date: '02/07/2026', party: 'Sunitha Devi', item: 'Full Jang', qty: null, amount: 540, type: 'credit', raw_text: '2) Sunitha Devi - Full Jang → 540 /- udhaar' },
        { date: '02/07/2026', party: 'Ramesh Yadav', item: 'Atta (wheat flour) 10kg', qty: 2, amount: 920, type: 'credit', raw_text: '3) रमेश यादव - आटा 10kg x2 → 920 /- उधार' },
        { date: '03/07/2026', party: 'Ramesh Yadav', item: null, qty: null, amount: 500, type: 'payment', raw_text: '4) रमेश जमा ₹500' },
        { date: '03/07/2026', party: null, item: 'Chawal 25kg bag', qty: 10, amount: null, type: 'stock_in', raw_text: '5) చావల్ 25kg బ్యాగ్ x10 వచ్చాయి (కొత్త స్టాక్)' },
        { date: '04/07/2026', party: 'लक्ष्मी जनरल', item: 'Sabun (soap) box', qty: 4, amount: null, type: 'credit', raw_text: 'లక్ష్మి జనరల్ — సబ్బు పెట్టె x4 — ??? (smudged)' },
      ],
    },
    {
      register_type: 'Kirana Store Ledger',
      confidence: 0.79,
      notes:
        'Sample page 2 (built-in demo data). Handwriting fainter on this page; one qty unreadable. Ramesh Yadav and Anand Traders carry over from page 1.',
      rows: [
        { date: '05/07/2026', party: 'ఆనంద్ ట్రేడర్స్', item: null, qty: null, amount: 2000, type: 'payment', raw_text: 'ఆనంద్ — 2000 jama (cheque)' },
        { date: '05/07/2026', party: null, item: 'Chini (sugar) 1kg pack', qty: 12, amount: 480, type: 'sale', raw_text: 'चीनी 1kg pack x12 cash sale — 480' },
        { date: '06/07/2026', party: 'रमेश यादव', item: 'Dal 5kg', qty: null, amount: 780, type: 'credit', raw_text: 'रमेश — dal 5kg x? ₹780 (qty faint)' },
        { date: '06/07/2026', party: 'मोहम्मद इरफ़ान', item: 'Biscuit carton', qty: 2, amount: 3400, type: 'credit', raw_text: 'Md Irfan biscuit carton x2 3400 udhaar' },
        { date: '06/07/2026', party: null, item: 'Namkeen carton (damaged, written off)', qty: 1, amount: null, type: 'stock_out', raw_text: 'नमकीन कार्टन x1 खराब — हटाया' },
        { date: '06/07/2026', party: 'भवानी स्टोर्स', item: null, qty: null, amount: 1000, type: 'payment', raw_text: 'Bhavani jama 1000/-' },
      ],
    },
  ];
  return pages[(pageNumber - 1) % pages.length];
}
