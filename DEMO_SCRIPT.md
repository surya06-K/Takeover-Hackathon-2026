# KaagazAI — Demo Video Script

A tight ~2.5-minute talk track for a screen-recorded walkthrough. Narrate in your own voice; the **[ACTION]** lines tell you what to click. Live site: <https://kaagazai.vercel.app>.

**Setup before you hit record**
- Open the live site (or `npm run dev`) in a clean browser window; zoom to ~110% so text reads on video.
- If you have API keys, great — real reads are the strongest demo. If not, sample mode works end-to-end and is honestly labelled; either is fine.
- Have a register photo ready if demoing a real read.
- Recommended tools: Loom, OBS, or QuickTime (Cmd-Shift-5 on Mac).

---

## 0:00 — Hook (Landing)

> "Millions of Indian shopkeepers run their whole business on paper — udhaar khatas, bill books, stock registers — often mixing Hindi, Telugu and English on the same page. That data is trapped: no backups, no totals, no way to know who owes them ₹5,000 or more. This is KaagazAI — it turns your paper register into a digital ledger from a single photo."

**[ACTION]** Show the landing page. Hover the **"Digitize a page"** button, then click it.

## 0:20 — Upload

> "It's mobile-first — on a phone this opens the camera directly. You can tell it the register type, or just leave it on Auto-detect and let the AI figure it out."

**[ACTION]** Pick a register photo (or the sample). Leave register type on **Auto-detect**. Submit.

## 0:35 — Extraction

> "The photo is downscaled on the device before it's sent — so this stays fast even on a 3G connection — and then a vision model reads every row."

**[ACTION]** Let the skeleton loader with its rotating messages play for a beat.

## 0:45 — Review (the key screen — spend the most time here)

> "This is the heart of the product. The AI doesn't get the final say — the shopkeeper does. Every extracted row lands in an editable table, and underneath each one you can see the original handwriting exactly as it was written, so you can check the machine against the paper."

**[ACTION]** Scroll slowly through the rows. Point at a `raw_text` line under a row.

> "Rows the model wasn't sure about glow amber — like this one, where the amount was smudged — so your eye goes straight to what needs a human. And this badge tells you exactly which AI read the page."

**[ACTION]** Hover an amber row. Point at the model badge (e.g. *Gemini 2.5 Flash* or *Sample data*).

> "I can fix any cell, add a row, delete one — and nothing is saved until I approve it."

**[ACTION]** Edit one cell (e.g. type in the smudged amount). Then click **Confirm & Save**.

## 1:30 — Ledger dashboard

> "Now it's a real ledger. Party-wise balances — credits minus payments — sorted by who owes the most. Cards up top show total outstanding, the biggest debtor, and entries from this page. And anyone who owes ₹5,000 or more gets a red flag automatically."

**[ACTION]** Show the balance list and the summary cards. Point at a red ₹5,000+ flag.

> "And it exports — clean CSV or JSON, one click, so this data is finally free of the paper."

**[ACTION]** Click **Export CSV** (and/or JSON); show the download.

## 2:00 — Multi-page merge

> "Real registers are many pages. I just hit 'Add another page' — and the next photo folds into the same digital book, balances updating across both."

**[ACTION]** Click **Add another page**, run page 2 through, land back on the merged ledger. Point out a party whose balance now spans two pages.

## 2:20 — The tech, briefly (close)

> "Under the hood: Gemini 2.5 Flash reads the page, with automatic failover to Groq's Llama 4 Scout if it's down — both forced to return strict JSON that's defensively parsed so the UI never breaks. Keys stay server-side, and with no keys at all it still runs on labelled sample data. Built on Next.js 14 and deployed on Vercel. That's KaagazAI — your paper register, digital in one photo."

**[ACTION]** Cut back to the landing page or the ledger for the final frame.

---

### Timing cheat-sheet

| Section | Target |
|---|---|
| Hook / Landing | 0:00–0:20 |
| Upload | 0:20–0:35 |
| Extraction | 0:35–0:45 |
| **Review (key screen)** | 0:45–1:30 |
| Ledger dashboard | 1:30–2:00 |
| Multi-page merge | 2:00–2:20 |
| Tech + close | 2:20–2:40 |

### Tips
- Slow down and let the **Review** screen breathe — it's the differentiator. Judges have seen plenty of "AI reads a document"; the human-in-the-loop verification is your edge.
- Say the numbers out loud ("Ramesh now owes ₹1,200 across two pages") — concrete beats abstract.
- If a real read misfires on camera, that's fine — *fixing it live* actually proves the review workflow. Lean into it.
