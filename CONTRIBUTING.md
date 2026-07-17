# Contributing to KaagazAI

Thanks for your interest in improving KaagazAI. This guide covers how to get set up, the conventions the codebase follows, and how to propose changes.

## Getting set up

```bash
git clone https://github.com/<your-username>/kaagazai.git
cd kaagazai
npm install
cp .env.example .env.local     # optional — see below
npm run dev                    # http://localhost:3000
```

You do **not** need API keys to develop. With no keys set, `/api/extract` serves the built-in labelled sample register, so the entire flow (upload → review → ledger → export → multi-page merge) works offline. To read real photos, add a `GEMINI_API_KEY` (and optionally `GROQ_API_KEY`) to `.env.local` and restart. Set `KAAGAZ_MOCK=1` to force sample mode even with keys.

Before opening a PR, make sure the project still type-checks and builds:

```bash
npx tsc --noEmit
npm run build
```

Both should be clean.

## Project layout

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full picture. In short:

- `app/api/extract/route.ts` — the only place AI keys are used; Gemini → Groq failover and JSON hardening live here.
- `app/` — pages (landing, digitize, ledger) and the API route.
- `components/` — UI components, notably the human-in-the-loop `ReviewTable`.
- `lib/` — pure, testable helpers: balance math, image downscale, export, the in-memory store, and shared types.

## Conventions

- **TypeScript everywhere**, strict types. Keep the `ExtractResult` / `ExtractedRow` contract in `lib/types.ts` as the single source of truth — both models and the UI depend on it.
- **Keys never reach the client.** Any code that touches an API key must stay inside the server route. Never import a key into a client component.
- **`null` beats a guess.** When handling model output or computing balances, prefer leaving a value empty over inventing one. Preserve `raw_text`.
- **Plain CSS design system.** No Tailwind, no UI kit. Follow the existing tokens in `app/globals.css` — cream paper, warm ink, terracotta accent, ledger green; Fraunces for headlines, Manrope for UI.
- **Keep `lib/` pure.** Balance and export logic should be free of React and side effects so it stays easy to reason about (and to unit-test).

## Making a change

1. Fork the repo and create a branch: `git checkout -b feat/short-description`.
2. Make your change, keeping commits focused and messages descriptive.
3. Run `npx tsc --noEmit` and `npm run build` — both must pass.
4. Open a pull request describing **what** changed and **why**, with before/after screenshots for UI changes.

## Good first issues

Some natural next steps if you're looking for where to help:

- Swap the in-memory `lib/store.ts` for a real database (Postgres / SQLite) behind the same interface.
- Add unit tests for `lib/ledger.ts` and `lib/export.ts`.
- Improve the row-level confidence heuristic in `ReviewTable`.
- Add more sample register types (stock registers, bill books) to the built-in fallback.
- Accessibility and localization passes on the UI copy.

## Reporting bugs

Open an issue with steps to reproduce, what you expected, what happened, and — if relevant — the register type and whether you were using real keys or sample data. Please don't paste real API keys or customer data into issues.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
