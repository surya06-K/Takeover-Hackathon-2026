# Architecture

This document explains how KaagazAI turns a photo of a handwritten register into a verified digital ledger, and the decisions behind each part. It complements the high-level overview in the [README](README.md).

## System overview

KaagazAI is a single Next.js 14 (App Router) application. All the intelligence lives in one server route; everything else is thin client UI and small pure-function libraries.

```
Browser (mobile-first)                       Server (Next.js API route)
──────────────────────                       ──────────────────────────
photo → canvas downscale       POST          /api/extract
  max 1600px, JPEG 0.85   ───────────▶   1. Gemini 2.5 Flash (vision)
                          base64 JSON    2. on any error → Groq
review table (human                         Llama 4 Scout (vision)
  approves every row)     ◀───────────   3. no keys → labelled sample data
        │                  strict JSON      + defensive JSON parsing
        ▼
in-memory ledger store  (module state + useSyncExternalStore)
        │
        ▼
dashboard + CSV/JSON export (client-side Blob download)
```

The design has one guiding principle: **handwriting OCR will make mistakes, so the human — not the model — is the source of truth.** Nothing is saved until the shopkeeper approves it, and no value is ever invented on their behalf.

## Data flow, step by step

### 1. Capture and downscale (client)

The upload screen uses a mobile-first file input (`accept="image/*"` with `capture="environment"`) so a phone opens the rear camera directly. Before anything is sent, `lib/image.ts` draws the photo onto a canvas and downscales it to a maximum of **1600 px** on the long edge, re-encoded as **JPEG quality 0.85**.

This matters for the real-world user: a 12 MP phone photo (several MB) becomes a small JPEG that uploads quickly on a 3G connection and stays safely under serverless request-body limits. The downscale happens entirely on-device — the server never sees the full-resolution image.

### 2. Extraction (`app/api/extract/route.ts`)

The client POSTs `{ image: dataURL, registerType, page }` to `/api/extract`. The route runs on the Node.js runtime (`export const runtime = 'nodejs'`) with `maxDuration = 60` to allow for slower model responses.

The route decides its path from environment variables:

| Condition | Behaviour |
|---|---|
| No keys set, **or** `KAAGAZ_MOCK=1` | Serve built-in labelled **sample** data (`model: "sample"`). |
| `GEMINI_API_KEY` set | Try **Gemini 2.5 Flash** first. |
| Gemini fails **and** `GROQ_API_KEY` set | Fall back to **Groq / Llama 4 Scout**. |
| Both readers fail | Return a friendly 502; the client keeps the photo and offers retry. |

Both models receive the **same system prompt** and are pinned to `temperature: 0` for deterministic reads. The prompt instructs the model to extract *every* row and to return **strict JSON only**, using `null` for anything unreadable while preserving the original text in `raw_text`. It explicitly forbids inventing values.

Gemini is asked for `responseMimeType: 'application/json'`; Groq is told to reply with the JSON object only, no markdown fences. Each call is wrapped in a 55-second `AbortSignal.timeout` so a hung request degrades to the next reader rather than hanging the user.

### 3. JSON hardening

Model output is never trusted as-is. `parseModelJson` defensively:

1. Strips markdown code fences (` ```json … ``` `).
2. Isolates the outermost `{ … }` object (ignoring any prose around it).
3. `JSON.parse`s that slice.
4. Coerces **every field** to the contract via `normalizeRow`:
   - strings are trimmed; the literal `"null"` becomes real `null`;
   - numbers are pulled even from strings like `"₹1,380"` (currency symbols, commas, whitespace stripped);
   - `type` is lower-cased and validated against `credit | payment | sale | stock`, else `null`;
   - `confidence` given as a percentage (e.g. `86`) is normalised to `0.86` and clamped to `[0, 1]`.

The result is that the UI **never sees malformed data**, regardless of which model answered or how sloppily it formatted its reply.

### 4. Review — human-in-the-loop (`components/ReviewTable.tsx`)

The parsed rows render in an editable table. Every cell is editable; rows can be added or deleted. Under each row, the model's `raw_text` is shown so the shopkeeper can compare against exactly what the model saw.

A **low-confidence heuristic** highlights rows in amber when the amount is missing, or when neither party nor item could be read — precisely the rows worth a second look. A badge names the reader (`Gemini 2.5 Flash`, `Llama 4 Scout · Groq failover`, or `Sample data — no API key set`). Only on **Confirm & Save** does the page enter the ledger.

### 5. Ledger store (`lib/store.ts`)

Saved pages live in an **in-memory** module-level store, exposed to React via `useSyncExternalStore` so the dashboard stays in sync across navigation. This is deliberately `localStorage`-free — see [Design decisions](#design-decisions). Each page carries its `pageNumber`, the `model` that read it, register type, confidence, notes, and rows with stable ids.

### 6. Balances and dashboard (`lib/ledger.ts`, `app/ledger/page.tsx`)

`computeBalances` walks every row of every saved page and aggregates party-wise:

- `credit` and `sale` **increase** what a party owes;
- `payment` **decreases** it;
- untyped rows are **counted but never guessed** into a direction;
- rows with no party or no amount are excluded from balances (but still exported).

Balances are sorted by amount due. `totalOutstanding` sums positive balances; `biggestDebtor` returns the top party if they owe anything; any party at or above the **₹5,000** `FLAG_THRESHOLD` gets a red flag. All amounts render through an `en-IN` `Intl.NumberFormat` for correct Indian-style grouping.

### 7. Export (`lib/export.ts`)

CSV and JSON are serialized client-side and downloaded via a `Blob`, so export works with no backend round-trip and no data leaving the browser.

## Design decisions

**Trust through review, not promises.** OCR on handwriting is imperfect; instead of hiding that, the product makes correction a first-class, pleasant step. `raw_text` is preserved per row so nothing the shopkeeper wrote is lost, and the model is forbidden from inventing values — `null` beats a guess.

**Failover, tracked.** Two independent vision providers mean a quota error or outage on one doesn't break the demo. Every saved page records which model produced it, surfaced in the UI and in exports, so the provenance of every number is auditable.

**Graceful failure.** If both readers fail, the user sees a friendly retry card and keeps their photo; the technical detail goes to the server log, never the screen.

**Payload discipline.** On-device downscaling keeps requests small and fast on the connections real shopkeepers actually have.

**In-memory by design.** For a demo, a clean slate on refresh is a feature, not a bug — no stale state, no privacy questions about persisted financial data. Swapping `lib/store.ts` for a real database is the obvious production next step and is isolated to that one file.

**Keys stay on the server.** API keys are read only inside the `/api/extract` route and are never shipped to the browser.

## Key files

| File | Role |
|---|---|
| `app/api/extract/route.ts` | Vision extraction: Gemini → Groq failover, JSON hardening, sample fallback. **API keys live here only.** |
| `app/digitize/page.tsx` | Upload → loading → review → error state machine |
| `components/ReviewTable.tsx` | Editable human-in-the-loop table, amber low-confidence rows |
| `app/ledger/page.tsx` | Merged dashboard: balances, cards, ₹5,000+ flags, exports |
| `lib/store.ts` | In-memory ledger (deliberately `localStorage`-free) |
| `lib/ledger.ts` | Balance math: credit + sale add, payment subtracts |
| `lib/image.ts` | Client-side canvas downscale before upload |
| `lib/export.ts` | CSV / JSON serialization + download |
| `lib/types.ts` | Shared types and the strict-JSON contract |

## Limitations (honest ones)

- The ledger is in-memory by design for the demo — a hard refresh starts fresh.
- Page-level confidence comes from the model; row-level confidence is a heuristic.
- HEIC photos work only where the browser can decode them (Safari / iOS does).
