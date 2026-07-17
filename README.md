<div align="center">

# KaagazAI 📒

### Your paper register, digital in one photo.

Snap a photo of a handwritten Indian business register — an AI vision model reads every row, you verify and correct it, and it lands in a **living digital khata**: persistent party ledgers with phone-number lookup, auto-updating balances, overdue flags, and CSV/JSON export.

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
3. **Match parties** — each extracted name links to a saved customer (or creates one, with a phone number). The same person written as *"रमेश यादव"* and *"Ramesh Yadav"* resolves to **one** party; alternate spellings are remembered as variants.
4. **Update the khata automatically** — confirmed rows become transactions; every party's balance is always the live sum of their credits minus payments (feature: scan a page, balances move by themselves). Anyone crossing **₹5,000 due** gets a red flag.
5. **Find anyone by phone number** — search the udhaar book by name *or phone*; a party's profile shows their balance and a full timeline where every entry links back to the scanned page it came from (or a ✍️ *manual* chip).
6. **Merge pages** — every scanned page folds into the same persistent book; CSV / JSON export any time.

## The demo flow

1. **Login** — phone number + OTP (demo mode: the OTP is always **123456**, no SMS dependency, so the demo can't die on a provider). First login names your shop and creates your khata.
2. **Home** — namaste greeting, today's outstanding, ₹5,000+ alerts, "collect today" list, recent activity. Bottom tabs: **Home · Udhaar · 📷 Scan · Sales · Stock** (Sales & Stock are visible coming-soon tabs — same pipeline, next registers).
3. **Scan** — mobile-first camera / gallery capture (`accept="image/*"` + `capture="environment"`); pick a register type or leave **Auto-detect**. The photo is downscaled on-device before upload.
4. **Review — the key screen** — every extracted row in an editable table; the original handwriting is shown under each row (*as written: "रमेश यादव — आटा 10kg x2 — 920"*); low-confidence rows glow **amber**; a badge shows which model read the page.
5. **Match parties** — each distinct extracted name is linked to an existing party (pre-selected when the name or a saved variant matches) or created fresh with a phone number.
6. **Udhaar khata** — persistent party list sorted by balance due, searchable by name **or phone**, red **"₹5,000+ due"** flags, CSV + JSON export.
7. **Party profile** — balance hero (auto-computed), **+ Udhaar diya / ₹ Payment aaya** quick entries, call button, and a timeline where each entry carries a *📷 page N* or *✍️ manual* source chip.

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

Open <http://localhost:3000> and log in with any 10-digit number — the **demo OTP is `123456`**.

### No keys? It still runs end-to-end

The app is fully demoable with **no API keys**: `/api/extract` serves a built-in, honestly-labelled two-page sample register (badged **"Sample data — no API key set"** in the UI). Set `KAAGAZ_MOCK=1` to force sample mode even with keys — handy for demos without burning quota. Add a real `GEMINI_API_KEY` and restart to read actual photos.

### Database (optional locally, required for a deployed instance)

With no configuration the khata lives in an **in-process memory store** — perfect for local demos, wiped on restart, and clearly badged *"demo storage"* in the app. To make it durable:

1. Create a free [Supabase](https://supabase.com) project.
2. Paste `supabase/schema.sql` into the SQL editor and run it once.
3. Add to `.env.local` (and Vercel env settings):
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   SUPABASE_SERVICE_ROLE_KEY=...
   SESSION_SECRET=any-long-random-string
   ```

The store facade (`lib/db`) switches automatically; the app badge flips to *"DB connected"*. On serverless deploys the memory fallback does **not** persist between invocations — add Supabase keys there.

## AI architecture (the interesting part)

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
match parties step             POST       /api/pages/commit
  (link names to saved    ───────────▶     resolve/create parties,
   customers + phones)                     insert transactions
                                                │
home / udhaar / party          GET              ▼
  balances, timelines,    ◀───────────   lib/db store facade
  phone search, exports                  Supabase (configured) or
                                         in-memory fallback (zero-config)
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
- **Cross-script identity** — the same customer appears as *"रमेश यादव"* on one page and *"Ramesh Yadav"* on the next. The match-parties step resolves both to one party and stores alternate spellings as `name_variants`, which power future auto-matching and search. A helper endpoint `/api/translate` (same Gemini → Groq → dictionary failover) can normalize names/items across English / हिन्दी / తెలుగు.
- **Balances are never stored** — a party's balance is always computed from their transactions, and every transaction traces back to the scanned page (and raw handwriting) it came from. Auditability by construction.

See [**ARCHITECTURE.md**](ARCHITECTURE.md) for the full technical write-up.

## Tech stack

- **Next.js 14** (App Router) · **React 18** · **TypeScript**
- **Supabase (Postgres)** via a store facade with a zero-config in-memory fallback (`lib/db`)
- Phone-OTP login (demo OTP, no SMS dependency) with an HMAC-signed session cookie
- Plain CSS design system — no Tailwind, no UI kit
- AI + DB keys **server-side only** (API routes); the browser never sees a secret
- Client-side image downscale to max 1600 px, JPEG 0.85, before upload (fast on 3G, safely under payload limits)
- Deployed on **Vercel**

## Project structure

```
app/
  api/extract/route.ts        Gemini → Groq failover, JSON hardening, sample fallback
  api/pages/commit/route.ts   Scan → khata bridge: resolve parties, insert transactions
  api/parties/…               List/search (name or phone), create, profile + timeline
  api/transactions/route.ts   Manual "+ udhaar / payment" entries
  api/dashboard/route.ts      Home stats · api/export/route.ts  CSV/JSON download
  api/auth/…                  Phone OTP (demo code 123456), session, /api/me
  login · home · udhaar · party/[id] · scan · sales · stock   App screens
  layout.tsx · globals.css · icon.svg
components/
  AppShell.tsx           Bottom tab bar (Home · Udhaar · 📷 Scan · Sales · Stock)
  ReviewTable.tsx        Editable human-in-the-loop table (amber low-confidence rows)
lib/
  db/                    Store facade: types + Supabase impl + memory fallback
  session.ts             HMAC-signed cookie session
  ledger.ts              Balance math + ₹ formatting · phone.ts  phone utils
  image.ts               Client-side canvas downscale before upload
  types.ts               Extraction types + strict-JSON contract
supabase/schema.sql      One-paste Postgres schema (shops, parties, transactions, pages)
samples/                 Sample register images (SVG) for the demo
```

## Design

Warm, trustworthy Indian-SMB feel — cream paper, warm ink, terracotta accent, ledger green. Ruled-paper texture with the classic red margin line on the hero only. **Fraunces** for headlines, **Manrope** for UI. No purple AI gradients.

## Deploy

Deploys to **Vercel** as a standard Next.js app. Environment variables in the Vercel project settings:

- `GEMINI_API_KEY` (and optional `GROQ_API_KEY`) — without them the live site serves labelled sample data.
- `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` — **required in production** for a persistent khata (the in-memory fallback does not survive serverless invocations).
- `SESSION_SECRET` — any long random string, signs the login cookie.
