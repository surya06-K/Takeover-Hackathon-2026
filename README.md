<div align="center">

# KaagazAI 📒

### Your paper register, digital in one photo.

Snap a photo of a handwritten Indian business register — an AI vision model reads every row, you verify and correct it, and each row **routes itself** to the right book: **Udhaar** (credit ledger), **Sales** (bill book) or **Stock** (inventory). One photo, three registers, zero manual sorting.

[**🔗 Live demo → kaagazai.vercel.app**](https://kaagazai.vercel.app)

**Next.js 14 · React 18 · TypeScript · Gemini 2.5 Flash · Groq (Llama 4 Scout) · Vercel · MIT**

</div>

---

## The problem

Millions of Indian shopkeepers run their business on handwritten registers — **udhaar** (credit) khatas, bill books, stock registers — often mixing Hindi, Telugu, English and Hinglish on the same page, and often mixing *entry types* too: a credit sale, a cash sale and a stock delivery can all land on the same page of the same physical notebook. That data is trapped on paper: no backups, no totals, no way to know at a glance who owes ₹5,000 or more.

**KaagazAI** turns a single photo of a register page into structured, verifiable, exportable digital records — without asking the shopkeeper to type anything, trust the machine blindly, or manually sort rows into the right book.

## What it does

Point your phone at a register page and KaagazAI will:

1. **Read** every row with a vision LLM (Hindi / Telugu / English / Hinglish) and precisely categorise each one: **credit** (udhaar given), **payment** (jama received), **sale** (cash sale), **stock in** or **stock out**.
2. **Show you** each extracted row in an editable table, with the original handwriting preserved underneath and low-confidence rows highlighted in amber — you approve every row before anything is saved. A live "Routes to" summary shows exactly how many rows are headed to Udhaar / Sales / Stock, computed straight from each row's Type.
3. **Auto-route by type — no manual toggle.** Credit/payment rows go to the Udhaar khata, sale rows to the Sales book, stock-in/stock-out rows to the Stock register. Get a mixed page — 3 udhaar entries, a cash sale and a stock delivery — and one approval saves all three sections at once, atomically. Disagree with the AI's category on any row? Change its **Type** cell and it re-routes.
4. **Match parties** (udhaar rows only) — each extracted name links to a saved customer (or creates one, with a phone number). The same person written as *"रमेश यादव"* and *"Ramesh Yadav"* resolves to **one** party; alternate spellings are remembered as variants. Sales are free-text (no party required — walk-in customers are normal); stock has no party at all.
5. **Update every book automatically** — confirmed rows become transactions/entries; a party's udhaar balance is always the live sum of their credits minus payments, Sales totals daily/all-time, Stock nets in-vs-out per item. Anyone crossing **₹5,000 due** gets a red flag.
6. **Find anyone by phone number** — search the udhaar book by name *or phone*; a party's profile shows their balance and a full timeline where every entry links back to the scanned page it came from (or a ✍️ *manual* chip).
7. **Merge pages** — every scanned page folds into the same persistent books; CSV / JSON export any time, per section or all together.

## The demo flow

1. **Login** — phone number + OTP (demo mode: the OTP is always **123456**, no SMS dependency, so the demo can't die on a provider). First login names your shop and creates your khata.
2. **Home** — namaste greeting, today's outstanding, ₹5,000+ alerts, "collect today" list, recent activity. Bottom tabs: **Home · Udhaar · 📷 Scan · Sales · Stock** — all three data tabs are live.
3. **Scan** — mobile-first camera / gallery capture (`accept="image/*"` + `capture="environment"`); pick a register type as a hint for the reader, or leave **Auto-detect**. The photo is downscaled on-device before upload.
4. **Review — the key screen** — every extracted row in an editable table with a Type dropdown (credit / payment / sale / stock in / stock out); the original handwriting is shown under each row (*as written: "रमेश यादव — आटा 10kg x2 → 920 उधार"*); low-confidence rows glow **amber**; a "Routes to" strip shows the Udhaar/Sales/Stock split before you even approve.
5. **Match parties** — shown only when the page has udhaar rows. Each distinct extracted name is linked to an existing party (pre-selected when the name or a saved variant matches) or created fresh with a phone number. Any sale/stock rows on the same page are saved alongside, automatically.
6. **Udhaar khata** — persistent party list sorted by balance due, searchable by name **or phone**, red **"₹5,000+ due"** flags, CSV + JSON export.
7. **Party profile** — balance hero (auto-computed), **+ Udhaar diya / ₹ Payment aaya** quick entries (with a tap-friendly number pad), call button, and a timeline where each entry carries a *📷 page N* or *✍️ manual* source chip.
8. **Sales & Stock** — daily/total sales with per-entry source tracing; per-item stock net (in − out) with an "out of stock" flag at zero or below.

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
  approves every row,     ◀───────────   3. no keys → labelled sample data
  sees Udhaar/Sales/Stock    strict JSON     + defensive JSON parsing
  split from row Type)
        │
        ▼ rows partitioned client-side by type
match parties (udhaar          POST       /api/pages/commit
  rows only, if any)     ───────────▶     ONE page record; resolves/creates
                                          parties + inserts udhaar txns,
                                          sale entries, stock entries —
                                          whichever buckets have rows
                                                │
home / udhaar / sales /        GET              ▼
  stock / party           ◀───────────   lib/db store facade
  balances, timelines,                   Supabase (configured) or
  phone search, exports                  in-memory fallback (zero-config)
```

- **Primary reader:** Google **Gemini 2.5 Flash** vision (`generativelanguage.googleapis.com`).
- **Failover reader:** **Groq — Llama 4 Scout** (`meta-llama/llama-4-scout-17b-16e-instruct`) with the same strict-JSON contract. If Gemini errors (quota / network / timeout), it auto-retries on Groq.
- **No-key fallback:** ships a labelled built-in sample register — deliberately mixing credit, payment, sale and stock rows on one page — so auto-routing is demoable end-to-end without any keys.
- **Strict JSON contract** both models must honour:
  ```jsonc
  { "register_type": string, "confidence": number,
    "rows": [{ "date", "party", "item", "qty", "amount",
               "type": "credit"|"payment"|"sale"|"stock_in"|"stock_out"|null,
               "raw_text" }],
    "notes": string }
  ```
  The system prompt gives the model a precise definition of each type (credit = udhaar given, payment = jama received, sale = cash sale, stock_in/stock_out = inventory movement) so a single mixed page gets every row tagged correctly. Output is parsed defensively — fences stripped, numbers coerced, `null` beats a guess — and every saved page records which model read it.
- **Type drives routing, not a manual switch.** `rows` (credit/payment) go to the udhaar ledger, `saleRows` to the sales book, `stockRows` (direction `in`/`out`) to the stock register — all three committed from one `/api/pages/commit` call so one photo can populate all three books in a single atomic page record. Correcting a row's Type in the review table is how a shopkeeper fixes a mis-routed row.
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
  api/extract/route.ts        Gemini → Groq failover, precise type prompt, JSON hardening, sample fallback
  api/pages/commit/route.ts   Scan → khata bridge: one page record, auto-routes rows/saleRows/stockRows
  api/sales/route.ts          Sales stats + entries · api/stock/route.ts  per-item net in/out
  api/parties/…               List/search (name or phone), create, profile + timeline
  api/transactions/route.ts   Manual "+ udhaar / payment" entries
  api/dashboard/route.ts      Home stats · api/export/route.ts  CSV/JSON download (per section or all)
  api/auth/…                  Phone OTP (demo code 123456), session, /api/me
  login · home · udhaar · party/[id] · scan · sales · stock   App screens
  layout.tsx · globals.css · icon.svg
components/
  AppShell.tsx           Bottom tab bar (Home · Udhaar · 📷 Scan · Sales · Stock)
  ReviewTable.tsx        Editable human-in-the-loop table (Type dropdown drives routing; amber low-confidence rows)
  NumPad.tsx             Tap-friendly number pad for amount entry
lib/
  db/                    Store facade: types + Supabase impl + memory fallback
  register.ts            Section type (udhaar/sales/stock) + export-query validation
  session.ts             HMAC-signed cookie session
  ledger.ts              Balance math + ₹ formatting · phone.ts  phone utils
  image.ts               Client-side canvas downscale before upload
  types.ts               Extraction types (credit/payment/sale/stock_in/stock_out) + strict-JSON contract
  i18n.ts                Hindi/English UI strings
supabase/schema.sql      One-paste Postgres schema (shops, parties, transactions, pages, sale_entries, stock_entries)
samples/                 Sample register images (SVG) for the demo
```

## Design

Warm, trustworthy Indian-SMB feel — cream paper, warm ink, terracotta accent, ledger green. Ruled-paper texture with the classic red margin line on the hero only. **Fraunces** for headlines, **Manrope** for UI. No purple AI gradients.

## Deploy

Deploys to **Vercel** as a standard Next.js app. Environment variables in the Vercel project settings:

- `GEMINI_API_KEY` (and optional `GROQ_API_KEY`) — without them the live site serves labelled sample data.
- `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` — **required in production** for a persistent khata (the in-memory fallback does not survive serverless invocations).
- `SESSION_SECRET` — any long random string, signs the login cookie.
