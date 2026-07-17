<div align="center">

# KaagazAI 📒

### Your paper register, digital in one photo.

Snap a photo of a handwritten Indian business register — an AI vision model reads every row, you verify and correct it, and it becomes a clean digital ledger with party balances, overdue flags, and CSV/JSON export.

[**🔗 Live demo → kaagazai.vercel.app**](https://kaagazai.vercel.app)

**Next.js 14 · React 18 · TypeScript · Gemini 2.5 Flash · Groq (Llama 4 Scout) · Vercel · MIT**

</div>

---

## The problem

Millions of Indian shopkeepers run their business on handwritten registers — **udhaar** (credit) khatas, bill books, stock registers — often mixing Hindi, Telugu, English and Hinglish on the same page. That data is trapped on paper: no backups, no totals, no way to know at a glance who owes ₹5,000 or more.

**KaagazAI** turns a single photo of a register page into structured, verifiable, exportable digital records — without asking the shopkeeper to type anything or trust the machine blindly.

## What it does

Point your phone at a register page and KaagazAI will:

1. **Read** every row with a vision LLM (Hindi / Telugu / English / Hinglish).
2. **Show you** each extracted row in an editable table, with the original handwriting preserved underneath and low-confidence rows highlighted in amber — you approve every row before anything is saved.
3. **Build a ledger** with party-wise balances (credits − payments), a red flag for anyone who owes ₹5,000+, and one-click CSV / JSON export.
4. **Merge pages** — add another photo and it folds into the same digital book.

## The demo flow

1. **Landing** — bold hero, single CTA: *"Digitize a page"*.
2. **Upload** — mobile-first camera / gallery capture (`accept="image/*"` + `capture="environment"`); pick a register type (Udhaar / Sales Bill Book / Stock) or leave **Auto-detect**.
3. **Extract** — the image is sent to the AI; a skeleton loader shows rotating status messages while it reads.
4. **Review — the key screen** — every extracted row in an editable table; the original handwriting is shown under each row (*as written: "रमेश किराना — आटा 10kg x2 — 920"*); low-confidence rows glow **amber**; a badge shows which model read the page. Edit, add, delete rows, then **Confirm & Save**.
5. **Ledger dashboard** — party balances sorted by amount due; cards for total outstanding / biggest debtor / entries this page; red **"₹5,000+ due"** flags; CSV + JSON export.
6. **Multi-page** — *"Add another page"* merges into the same ledger.
7. **Output language** — a real register mixes Hindi, Telugu and English on one page. When ≥2 scripts are detected, a switch on the ledger normalizes every party/item into the one language you choose (English / हिन्दी / తెలుగు) — so the *same party written in two scripts merges into one balance*. Display and CSV/JSON export follow your choice; *"As written"* restores the originals. Non-destructive: the saved data is never overwritten.

## Quick start

```bash
git clone https://github.com/<your-username>/kaagazai.git
cd kaagazai
npm install

# Add AI keys (optional — see "No keys?" below)
cp .env.example .env.local
#   GEMINI_API_KEY → https://aistudio.google.com/apikey   (primary reader)
#   GROQ_API_KEY   → https://console.groq.com/keys        (failover reader)

npm run dev
```

Open <http://localhost:3000>.

### No keys? It still runs end-to-end

The app is fully demoable with **no API keys**: `/api/extract` serves a built-in, honestly-labelled two-page sample register (badged **"Sample data — no API key set"** in the UI). Set `KAAGAZ_MOCK=1` to force sample mode even with keys — handy for demos without burning quota. Add a real `GEMINI_API_KEY` and restart to read actual photos.

## AI architecture (the interesting part)

```
Browser (mobile-first)                       Server (Next.js API route)
──────────────────────                       ──────────────────────────
photo → canvas downscale       POST          /api/extract
  max 1600px, JPEG 0.85   ───────────▶   1. Gemini 2.5 Flash (vision)
                          base64 JSON    2. on any error → Groq
review table (human                         Llama 4 Scout (vision)
  approves every row)     ◀───────────   3. no keys → labelled sample data
        │                  strict JSON      + defensive JSON parsing
        ▼                                   (fences stripped, numbers
in-memory ledger store                       coerced, types validated)
  (module state + useSyncExternalStore)
        │
        ▼
dashboard + CSV/JSON export (client-side Blob download)
```

- **Primary reader:** Google **Gemini 2.5 Flash** vision (`generativelanguage.googleapis.com`).
- **Failover reader:** **Groq — Llama 4 Scout** (`meta-llama/llama-4-scout-17b-16e-instruct`) with the same strict-JSON contract. If Gemini errors (quota / network / timeout), it auto-retries on Groq.
- **No-key fallback:** ships a labelled built-in sample register so the whole flow is demoable without any keys.
- **Strict JSON contract** both models must honour:
  ```jsonc
  { "register_type": string, "confidence": number,
    "rows": [{ "date", "party", "item", "qty", "amount", "type", "raw_text" }],
    "notes": string }
  ```
  Output is parsed defensively — fences stripped, numbers coerced, `null` beats a guess — and every saved page records which model read it.
- **Language normalization** — a second endpoint `/api/translate` reuses the same Gemini → Groq → dictionary-fallback chain to transliterate names and translate item words into the chosen output language, returning a strict `{ map: { original → translated } }`. Results are cached client-side per language.

See [**ARCHITECTURE.md**](ARCHITECTURE.md) for the full technical write-up.

## Tech stack

- **Next.js 14** (App Router) · **React 18** · **TypeScript**
- Plain CSS design system — no Tailwind, no UI kit
- API keys **server-side only** (inside the `/api/extract` route)
- Client-side image downscale to max 1600 px, JPEG 0.85, before upload (fast on 3G, safely under payload limits)
- In-memory ledger store (deliberately `localStorage`-free; survives navigation via `useSyncExternalStore`)
- Deployed on **Vercel**

## Project structure

```
app/
  api/extract/route.ts   Gemini → Groq failover, JSON hardening, sample fallback
  digitize/page.tsx      Upload → loading → review → error state machine
  ledger/page.tsx        Merged dashboard: balances, cards, ₹5,000+ flags, exports
  page.tsx               Landing
  layout.tsx · globals.css · icon.svg
components/
  ReviewTable.tsx        Editable human-in-the-loop table (amber low-confidence rows)
lib/
  store.ts               In-memory ledger (no localStorage)
  ledger.ts              Balance math: credit + sale add, payment subtracts
  image.ts               Client-side canvas downscale before upload
  export.ts              CSV / JSON export + download
  types.ts               Shared types + strict-JSON contract
samples/                 Sample register images (SVG) for the demo
```

## Design

Warm, trustworthy Indian-SMB feel — cream paper, warm ink, terracotta accent, ledger green. Ruled-paper texture with the classic red margin line on the hero only. **Fraunces** for headlines, **Manrope** for UI. No purple AI gradients.

## Deploy

Deploys to **Vercel** as a standard Next.js app. Add `GEMINI_API_KEY` (and optional `GROQ_API_KEY`) as environment variables in the Vercel project settings; without them the live site serves labelled sample data.
