# Architecture

This document explains how KaagazAI turns a photo of a handwritten register into a verified digital ledger, and the decisions behind each part. It complements the high-level overview in the [README](README.md).

## System overview

KaagazAI is a single Next.js 14 (App Router) application: a phone-first khata app whose data-entry method is the camera. The AI intelligence lives in one extraction route; the khata lives behind a small store facade; everything else is thin client UI and pure-function libraries.

```
Browser (mobile-first)                       Server (Next.js API routes)
──────────────────────                       ───────────────────────────
photo → canvas downscale       POST          /api/extract
  max 1600px, JPEG 0.85   ───────────▶   1. Gemini 2.5 Flash (vision)
                          base64 JSON    2. on any error → Groq
review table (human                         Llama 4 Scout (vision)
  approves every row)     ◀───────────   3. no keys → labelled sample data
        │                  strict JSON      + defensive JSON parsing
        ▼
match-parties step             POST       /api/pages/commit
  (names → saved parties, ───────────▶     resolve/create parties,
   or new party + phone)                   insert transactions
                                                │
home · udhaar · party          GET              ▼
  balances, timelines,    ◀───────────   lib/db store facade
  phone search            /api/…         ├─ Supabase Postgres (configured)
                                         └─ in-memory fallback (zero-config)
```

Auth is a phone-OTP flow (demo OTP `123456`, no SMS provider in the loop) issuing an HMAC-signed session cookie; every data route resolves the shop from that cookie.

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

A **low-confidence heuristic** highlights rows in amber when the amount is missing, or when neither party nor item could be read — precisely the rows worth a second look. A badge names the reader (`Gemini 2.5 Flash`, `Llama 4 Scout · Groq failover`, or `Sample data — no API key set`). Approving the review leads to the match-parties step — nothing has been saved yet.

### 5. Match parties (`app/scan/page.tsx`, match phase)

Handwriting doesn't come with customer IDs. The distinct party names on the reviewed page are grouped (with entry counts and page totals) and each is resolved by the shopkeeper:

- **Pre-selected existing party** when the name — or a previously saved *variant* — matches (case-insensitive). This is how *"रमेश यादव"* on page 2 lands on the same party as page 1.
- **Create new party**, with an optional phone number — the identity key of the khata.

When an extracted spelling differs from the saved party name, it is stored in the party's `name_variants`, so cross-script matches get better with every page. In an udhaar khata, `sale` rows are treated as goods given on credit; rows without a party, amount or udhaar type are skipped with a visible notice (and never guessed).

### 6. Persistence (`lib/db`, `/api/pages/commit`)

`POST /api/pages/commit` writes one atomic unit: a `pages` record (model, register type, confidence, notes) plus one `transactions` row per approved entry, each linking `party_id` and `page_id`.

The store behind it is a facade with two interchangeable implementations:

- **Supabase Postgres** (`lib/db/supabase.ts`) when env keys are present — schema in `supabase/schema.sql`, accessed server-side only with the service-role key (RLS stays deny-by-default).
- **In-memory** (`lib/db/memory.ts`) otherwise — zero-config local demos, honestly badged *"demo storage"* in the UI.

**Balances are never stored.** A party's balance is always `Σ credits − Σ payments` computed from their transactions (`computeBalanceFields`), so scanning a page updates every affected balance automatically, and any balance can be explained by walking its timeline back to photographed pages. Any party at or above the **₹5,000** `FLAG_THRESHOLD` gets a red flag; amounts render through an `en-IN` `Intl.NumberFormat`.

### 7. Lookup, timeline, export

- `GET /api/parties?q=` searches by name, saved variant, **or phone digits** — the "who is this caller?" feature.
- `GET /api/parties/:id` returns the profile plus a timeline where every transaction carries its source: *📷 page N* (with the original `raw_text` handwriting) or *✍️ manual*.
- Manual entries (`+ Udhaar diya` / `₹ Payment aaya`) post to `/api/transactions`.
- `GET /api/export?format=csv|json` streams the full khata server-side; the CSV is prefixed with a UTF-8 BOM so Excel/Numbers render Hindi and Telugu correctly.

## Design decisions

**Trust through review, not promises.** OCR on handwriting is imperfect; instead of hiding that, the product makes correction a first-class, pleasant step. `raw_text` is preserved per row so nothing the shopkeeper wrote is lost, and the model is forbidden from inventing values — `null` beats a guess.

**Failover, tracked.** Two independent vision providers mean a quota error or outage on one doesn't break the demo. Every saved page records which model produced it, surfaced in the UI and in exports, so the provenance of every number is auditable.

**Graceful failure.** If both readers fail, the user sees a friendly retry card and keeps their photo; the technical detail goes to the server log, never the screen.

**Payload discipline.** On-device downscaling keeps requests small and fast on the connections real shopkeepers actually have.

**Storage behind a facade.** Every screen talks to the same `KaagazStore` interface; whether it's Supabase Postgres or the in-process fallback is a deployment detail decided by env vars. The fallback keeps local demos zero-config and honest (badged in the UI); Supabase makes the deployed khata durable. Swapping in another database means implementing one interface in one file.

**The phone number is the identity key.** Names on paper are ambiguous across scripts and spellings; a phone number isn't. Parties are unique per shop by phone, name variants accumulate on top, and search treats digits as first-class.

**Keys stay on the server.** AI keys, the Supabase service-role key and the session secret are read only inside API routes and are never shipped to the browser.

## Key files

| File | Role |
|---|---|
| `app/api/extract/route.ts` | Vision extraction: Gemini → Groq failover, JSON hardening, sample fallback |
| `app/scan/page.tsx` | Capture → loading → review → **match parties** → commit state machine |
| `components/ReviewTable.tsx` | Editable human-in-the-loop table, amber low-confidence rows |
| `app/api/pages/commit/route.ts` | Scan → khata bridge: resolve/create parties, insert transactions |
| `lib/db/` | Store facade: domain types, Supabase impl, in-memory fallback |
| `supabase/schema.sql` | One-paste Postgres schema (shops, parties, transactions, pages) |
| `app/home` · `app/udhaar` · `app/party/[id]` | Dashboard, searchable khata, party profile + timeline |
| `app/api/auth/…` + `lib/session.ts` | Phone OTP (demo code) and HMAC-signed session cookie |
| `lib/ledger.ts` · `lib/phone.ts` | Balance math + ₹ formatting · phone normalization |
| `lib/image.ts` | Client-side canvas downscale before upload |
| `lib/types.ts` | Extraction types and the strict-JSON contract |

## Limitations (honest ones)

- Without Supabase keys the khata lives in process memory — great for local demos, wiped on restart, and not durable on serverless. The UI says so ("demo storage").
- Login uses a fixed demo OTP (`123456`); production would flip to a real SMS provider behind the same two endpoints.
- Party matching pre-selects exact name/variant matches only; fuzzy and transliterated auto-matching is the natural next step (the `/api/translate` failover chain is already in place for it).
- Page-level confidence comes from the model; row-level confidence is a heuristic.
- HEIC photos work only where the browser can decode them (Safari / iOS does).
- Sales and Stock are visible coming-soon tabs — same scan pipeline, different target tables.
