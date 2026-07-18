'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import ReviewTable, { isLowConfidence, type ReviewRow } from '@/components/ReviewTable';
import { useLang } from '@/components/LanguageProvider';
import { playError, playSuccess } from '@/lib/audio';
import { fileToJpegDataUrl } from '@/lib/image';
import { detectLangs, LANG_LABELS, type LangCode } from '@/lib/lang';
import { formatINR } from '@/lib/ledger';
import { formatPhone } from '@/lib/phone';
import type { PartyWithBalance } from '@/lib/db/types';
import {
  MODEL_LABELS,
  uid,
  type ExtractResponse,
  type ExtractResult,
  type ModelId,
} from '@/lib/types';

type Phase = 'pick' | 'loading' | 'review' | 'match' | 'saving' | 'error';

const REGISTER_TYPES: { id: string; label: string; hint: string }[] = [
  { id: 'auto-detect', label: 'Auto-detect', hint: 'Let the AI decide' },
  { id: 'Udhaar / Credit Ledger', label: 'Udhaar / Credit Ledger', hint: 'खाता — who owes what' },
  { id: 'Sales / Bill Book', label: 'Sales / Bill Book', hint: 'Daily sales & bills' },
  { id: 'Stock Register', label: 'Stock Register', hint: 'Items in and out' },
];

const LOADING_MESSAGES = [
  'Reading handwriting…',
  'Structuring entries…',
  'Untangling Hinglish…',
  'Double-checking amounts…',
];

/** One distinct extracted party name awaiting resolution (udhaar only). */
interface MatchGroup {
  name: string;
  rows: number;
  total: number;
  /** 'new' or an existing party id */
  choice: string;
  phone: string;
  /** As-written spelling, when it differs from the (possibly translated) name. */
  originalName?: string;
}

export default function ScanPage() {
  const router = useRouter();
  const { tr } = useLang();

  const [phase, setPhase] = useState<Phase>('pick');
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [registerType, setRegisterType] = useState(REGISTER_TYPES[0].id);
  const [errorMsg, setErrorMsg] = useState('');
  const [model, setModel] = useState<ModelId>('gemini');
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [msgIndex, setMsgIndex] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [parties, setParties] = useState<PartyWithBalance[]>([]);
  const [groups, setGroups] = useState<MatchGroup[]>([]);

  // output-language switch — origCells is the pristine source of truth for
  // party/item; language switches derive from it and never overwrite it,
  // only genuine user edits do (see handleRowsChange).
  const [origCells, setOrigCells] = useState<Record<string, { party: string; item: string }>>({});
  const [outLang, setOutLang] = useState<'original' | LangCode>('original');
  const [langCache, setLangCache] = useState<Partial<Record<LangCode, Record<string, string>>>>({});
  const [translating, setTranslating] = useState(false);
  const [langError, setLangError] = useState('');

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // page count for the "Scan page N" heading + sample-data rotation;
    // parties for the match step (refreshed again before matching).
    fetch('/api/dashboard')
      .then((r) => r.json())
      .then((j) => j?.ok && setPageCount(j.stats.pageCount))
      .catch(() => {});
    refreshParties();
  }, []);

  function refreshParties() {
    fetch('/api/parties')
      .then((r) => r.json())
      .then((j) => j?.ok && setParties(j.parties))
      .catch(() => {});
  }

  useEffect(() => {
    if (phase !== 'loading') return;
    setMsgIndex(0);
    const t = setInterval(() => setMsgIndex((i) => (i + 1) % LOADING_MESSAGES.length), 1700);
    return () => clearInterval(t);
  }, [phase]);

  async function onPick(file: File | undefined) {
    if (!file) return;
    try {
      setDataUrl(await fileToJpegDataUrl(file));
      setPhase('pick');
    } catch {
      setErrorMsg('That file could not be read as a photo. Try a JPG or PNG.');
      setPhase('error');
    }
  }

  function resetForNewPhoto() {
    setDataUrl(null);
    setPhase('pick');
    setOrigCells({});
    setOutLang('original');
    setLangCache({});
    setLangError('');
  }

  async function submit() {
    if (!dataUrl) return;
    setPhase('loading');
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl, registerType, page: pageCount + 1 }),
      });
      const json: ExtractResponse = await res.json();
      if (!json.ok) {
        setErrorMsg(json.error || 'Something went wrong while reading the page.');
        setPhase('error');
        return;
      }
      setModel(json.model);
      setResult(json.data);
      const newRows: ReviewRow[] = json.data.rows.map((r) => ({
        id: uid(),
        date: r.date ?? '',
        party: r.party ?? '',
        item: r.item ?? '',
        qty: r.qty != null ? String(r.qty) : '',
        amount: r.amount != null ? String(r.amount) : '',
        type: r.type,
        raw_text: r.raw_text ?? '',
      }));
      setRows(newRows);

      // snapshot the AI's original party/item text per row — this is what
      // language switching derives from and what "As written" restores.
      const oc: Record<string, { party: string; item: string }> = {};
      for (const r of newRows) oc[r.id] = { party: r.party, item: r.item };
      setOrigCells(oc);
      setOutLang('original');
      setLangCache({});
      setLangError('');

      setPhase('review');
    } catch {
      setErrorMsg('Could not reach the reader — check your connection and try again.');
      setPhase('error');
    }
  }

  /** Every genuine user edit (typing, add row, delete row, changing Type) —
   *  keeps origCells in sync so it always reflects the latest known-correct
   *  party/item text. Changing a row's Type is how the shopkeeper corrects
   *  auto-routing — no separate section toggle needed. */
  function handleRowsChange(newRows: ReviewRow[]) {
    setRows(newRows);
    setOrigCells(() => {
      const next: Record<string, { party: string; item: string }> = {};
      for (const r of newRows) next[r.id] = { party: r.party, item: r.item };
      return next;
    });
  }

  const detectedLangs = detectLangs(Object.values(origCells).flatMap((o) => [o.party, o.item]));

  async function chooseLang(lang: 'original' | LangCode) {
    setLangError('');
    if (lang === 'original') {
      setRows((rs) =>
        rs.map((r) => ({
          ...r,
          party: origCells[r.id]?.party ?? r.party,
          item: origCells[r.id]?.item ?? r.item,
        }))
      );
      setOutLang('original');
      return;
    }

    const texts = [
      ...new Set(
        Object.values(origCells)
          .flatMap((o) => [o.party, o.item])
          .filter((t) => t.trim())
      ),
    ];
    const cached = langCache[lang] ?? {};
    const missing = texts.filter((t) => !(t in cached));
    let map = cached;

    if (missing.length > 0) {
      setTranslating(true);
      try {
        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ texts: missing, target: lang }),
        });
        const json = await res.json();
        if (!json.ok) {
          setLangError('Could not switch language. Please try again.');
          return;
        }
        map = { ...cached, ...(json.map ?? {}) };
        setLangCache((c) => ({ ...c, [lang]: map }));
      } catch {
        setLangError('Could not reach the translator — check your connection.');
        return;
      } finally {
        setTranslating(false);
      }
    }

    setRows((rs) =>
      rs.map((r) => {
        const oc = origCells[r.id];
        if (!oc) return r;
        return {
          ...r,
          party: oc.party.trim() ? map[oc.party] ?? oc.party : r.party,
          item: oc.item.trim() ? map[oc.item] ?? oc.item : r.item,
        };
      })
    );
    setOutLang(lang);
  }

  /* -------------------------- auto-routing by type -------------------------
   * Every row's AI-detected (or shopkeeper-corrected) Type decides which
   * section it lands in — no manual "save to section" choice. */
  function usableUdhaarRows(): ReviewRow[] {
    return rows.filter(
      (r) => r.party.trim() && parseNum(r.amount) != null && (r.type === 'credit' || r.type === 'payment')
    );
  }

  function usableSaleRows(): ReviewRow[] {
    return rows.filter((r) => r.type === 'sale' && parseNum(r.amount) != null);
  }

  function usableStockRows(): ReviewRow[] {
    return rows.filter(
      (r) => (r.type === 'stock_in' || r.type === 'stock_out') && r.item.trim() && parseNum(r.qty) != null
    );
  }

  const udhaarCount = usableUdhaarRows().length;
  const saleCount = usableSaleRows().length;
  const stockCount = usableStockRows().length;
  const skippedCount = rows.length - udhaarCount - saleCount - stockCount;
  const canProceed = udhaarCount + saleCount + stockCount > 0;

  /** Review approved → build match groups for udhaar rows (if any), or
   *  commit sale/stock rows straight away when there's nothing to match. */
  function approveReview() {
    setErrorMsg('');
    if (udhaarCount > 0) {
      toMatching();
    } else {
      commitEverything();
    }
  }

  function toMatching() {
    refreshParties();
    const usable = usableUdhaarRows();

    const byName = new Map<string, MatchGroup>();
    for (const r of usable) {
      const name = r.party.trim();
      const key = name.toLowerCase();
      const g = byName.get(key) ?? { name, rows: 0, total: 0, choice: 'new', phone: '' };
      g.rows += 1;
      g.total += parseNum(r.amount) ?? 0;
      const oc = origCells[r.id];
      if (!g.originalName && oc?.party.trim() && oc.party.trim() !== name) g.originalName = oc.party.trim();
      byName.set(key, g);
    }
    // preselect an existing party when the name (or a saved variant) matches
    for (const g of byName.values()) {
      const hit = parties.find(
        (p) =>
          p.name.toLowerCase() === g.name.toLowerCase() ||
          p.nameVariants.some((v) => v.toLowerCase() === g.name.toLowerCase())
      );
      if (hit) g.choice = hit.id;
    }
    setGroups([...byName.values()]);
    setPhase('match');
  }

  /** Commits every routed bucket (udhaar/sales/stock) in one atomic page. */
  async function commitEverything() {
    if (!result) return;
    setPhase('saving');
    setErrorMsg('');

    const groupByName = new Map(groups.map((g) => [g.name.toLowerCase(), g]));
    const udhaarRows = usableUdhaarRows();
    const commitRows = udhaarRows.map((r) => {
      const g = groupByName.get(r.party.trim().toLowerCase());
      const base = {
        type: (r.type === 'payment' ? 'payment' : 'credit') as 'credit' | 'payment',
        amount: parseNum(r.amount)!,
        item: r.item.trim() || null,
        txnDate: r.date.trim() || null,
        rawText: r.raw_text || null,
      };
      return g && g.choice !== 'new'
        ? { ...base, partyId: g.choice, extractedName: g.name }
        : { ...base, newParty: { name: g?.name ?? r.party.trim(), phone: g?.phone || null }, originalName: g?.originalName };
    });

    const saleRows = usableSaleRows().map((r) => ({
      partyName: r.party.trim() || null,
      item: r.item.trim() || null,
      qty: parseNum(r.qty),
      amount: parseNum(r.amount)!,
      txnDate: r.date.trim() || null,
      rawText: r.raw_text || null,
    }));

    const stockRows = usableStockRows().map((r) => ({
      item: r.item.trim(),
      qty: parseNum(r.qty)!,
      direction: (r.type === 'stock_in' ? 'in' : 'out') as 'in' | 'out',
      amount: parseNum(r.amount),
      txnDate: r.date.trim() || null,
      rawText: r.raw_text || null,
    }));

    try {
      const res = await fetch('/api/pages/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          registerType: result.register_type,
          confidence: result.confidence,
          notes: result.notes,
          rows: commitRows,
          saleRows,
          stockRows,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        setErrorMsg(json.error ?? 'Could not save the page.');
        playError();
        setPhase(udhaarRows.length > 0 ? 'match' : 'review');
        return;
      }
      playSuccess();
      const dests = [
        { count: udhaarRows.length, href: '/udhaar' },
        { count: saleRows.length, href: '/sales' },
        { count: stockRows.length, href: '/stock' },
      ].filter((d) => d.count > 0);
      router.push(dests.length === 1 ? dests[0].href : '/home');
      router.refresh();
    } catch {
      setErrorMsg('Could not reach the server — your review is still here, try again.');
      playError();
      setPhase(udhaarRows.length > 0 ? 'match' : 'review');
    }
  }

  const lowCount = rows.filter(isLowConfidence).length;

  return (
    <div className="container section" style={{ paddingBottom: 24 }}>
      <div className="page-head">
        <h1>
          {phase === 'review'
            ? tr('scanTitleReview')
            : phase === 'match'
              ? tr('scanTitleMatch')
              : `${tr('scanHeading')} ${pageCount + 1}`}
        </h1>
        <p>
          {phase === 'review'
            ? tr('scanSubReview')
            : phase === 'match'
              ? tr('scanSubMatch')
              : tr('scanSubPick')}
        </p>
      </div>

      {phase === 'pick' && (
        <>
          {!dataUrl ? (
            <div className="drop-zone">
              <p>A clear photo in good light works best. The photo is shrunk on your phone before upload.</p>
              <div className="upload-btns">
                <button type="button" className="btn btn-primary" onClick={() => cameraRef.current?.click()}>
                  {tr('takePhoto')}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => galleryRef.current?.click()}>
                  {tr('fromGallery')}
                </button>
              </div>
            </div>
          ) : (
            <div className="preview-wrap">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={dataUrl} alt="Register page preview" className="preview-img" />
              <div className="preview-bar">
                <span>Ready — resized for fast upload</span>
                <button type="button" onClick={() => galleryRef.current?.click()}>
                  Replace photo
                </button>
              </div>
            </div>
          )}

          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => onPick(e.target.files?.[0])}
          />
          <input
            ref={galleryRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => onPick(e.target.files?.[0])}
          />

          <label className="field-label">{tr('whatRegister')}</label>
          <div className="type-grid">
            {REGISTER_TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                className="type-card"
                aria-pressed={registerType === t.id}
                onClick={() => setRegisterType(t.id)}
              >
                <strong>{t.label}</strong>
                <span>{t.hint}</span>
              </button>
            ))}
          </div>

          <div className="submit-row">
            <button type="button" className="btn btn-primary btn-lg" disabled={!dataUrl} onClick={submit}>
              {tr('readThisPage')}
            </button>
            {!dataUrl && <span className="muted" style={{ fontSize: 14 }}>{tr('addPhotoFirst')}</span>}
          </div>
        </>
      )}

      {phase === 'loading' && (
        <div className="card loading-card">
          <div className="scan-dot" aria-hidden />
          <div className="loading-msg" role="status">
            {LOADING_MESSAGES[msgIndex]}
          </div>
          <div className="skeleton-table" aria-hidden>
            {[0, 1, 2, 3, 4].map((i) => (
              <div className="sk-row" key={i}>
                {[0, 1, 2, 3, 4].map((j) => (
                  <span key={j} className="sk-cell" style={{ animationDelay: `${i * 0.1 + j * 0.05}s` }} />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {phase === 'review' && result && (
        <>
          <div className="review-head">
            <span className={`model-badge ${model}`}>Read by {MODEL_LABELS[model]}</span>
            <span className="conf-chip">{result.register_type}</span>
            <span className="conf-chip">{Math.round(result.confidence * 100)}% page confidence</span>
            {lowCount > 0 && (
              <span className="legend-amber">
                {lowCount} {tr('secondLook')}
              </span>
            )}
          </div>

          {result.notes && <p className="notes-callout">Reader’s note: {result.notes}</p>}

          <div className="lang-switch">
            <span className="lang-switch-label">{tr('routesTo')}</span>
            <div className="lang-pills" aria-live="polite">
              {udhaarCount > 0 && <span className="route-chip">📒 {tr('navUdhaar')} · {udhaarCount}</span>}
              {saleCount > 0 && <span className="route-chip">🧾 {tr('navSales')} · {saleCount}</span>}
              {stockCount > 0 && <span className="route-chip">📦 {tr('navStock')} · {stockCount}</span>}
              {skippedCount > 0 && <span className="route-chip skip">⚠ {skippedCount} skipped</span>}
            </div>
            <span className="lang-status">{tr('typeDecidesRouting')}</span>
          </div>

          {detectedLangs.length >= 2 && (
            <div className="lang-switch">
              <span className="lang-switch-label">Output language</span>
              <div className="lang-pills" role="group" aria-label="Output language">
                <button
                  type="button"
                  className="lang-pill"
                  aria-pressed={outLang === 'original'}
                  disabled={translating}
                  onClick={() => chooseLang('original')}
                >
                  As written
                </button>
                {detectedLangs.map((l) => (
                  <button
                    key={l}
                    type="button"
                    className="lang-pill"
                    aria-pressed={outLang === l}
                    disabled={translating}
                    onClick={() => chooseLang(l)}
                  >
                    {LANG_LABELS[l]}
                  </button>
                ))}
              </div>
              {translating && <span className="lang-status">Translating…</span>}
              {!translating && outLang !== 'original' && (
                <span className="lang-status ok">Names &amp; items rewritten · original kept as raw text below</span>
              )}
              {langError && <span className="lang-status err">{langError}</span>}
            </div>
          )}

          <ReviewTable rows={rows} onChange={handleRowsChange} />

          {errorMsg && <p className="form-error" style={{ textAlign: 'center', marginTop: 14 }}>{errorMsg}</p>}

          <div className="review-actions">
            <button type="button" className="btn btn-primary btn-lg" disabled={!canProceed} onClick={approveReview}>
              {udhaarCount > 0 ? tr('matchPartiesBtn') : tr('saveEntriesBtn')}
            </button>
            <button type="button" className="btn btn-ghost" onClick={resetForNewPhoto}>
              {tr('reshoot')}
            </button>
          </div>
        </>
      )}

      {phase === 'match' && (
        <>
          {skippedCount > 0 && (
            <p className="notes-callout" style={{ marginBottom: 14 }}>
              {skippedCount} row{skippedCount > 1 ? 's' : ''} without a usable party, amount or category
              will be left out.
            </p>
          )}
          {(saleCount > 0 || stockCount > 0) && (
            <p className="notes-callout" style={{ marginBottom: 14 }}>
              {saleCount > 0 && `${saleCount} sale row${saleCount > 1 ? 's' : ''} → Sales`}
              {saleCount > 0 && stockCount > 0 && ' · '}
              {stockCount > 0 && `${stockCount} stock row${stockCount > 1 ? 's' : ''} → Stock`}
              {' '}will be saved alongside these udhaar entries.
            </p>
          )}
          {groups.map((g, i) => {
            const existing = parties.find((p) => p.id === g.choice);
            return (
              <div key={g.name} className="match-card">
                <div className="match-name">{g.name}</div>
                <div className="match-sub">
                  {g.rows} entr{g.rows > 1 ? 'ies' : 'y'} · {formatINR(g.total)} on this page
                </div>
                <select
                  className="match-select"
                  value={g.choice}
                  aria-label={`Match ${g.name}`}
                  onChange={(e) =>
                    setGroups(groups.map((x, j) => (j === i ? { ...x, choice: e.target.value } : x)))
                  }
                >
                  <option value="new">➕ New party — create “{g.name}”</option>
                  {parties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.phone ? ` — ${formatPhone(p.phone)}` : ''} (due {formatINR(Math.max(p.balance, 0))})
                    </option>
                  ))}
                </select>
                {g.choice === 'new' ? (
                  <input
                    className="form-input match-phone"
                    inputMode="tel"
                    placeholder="📱 Phone number (optional but powerful)"
                    value={g.phone}
                    onChange={(e) =>
                      setGroups(groups.map((x, j) => (j === i ? { ...x, phone: e.target.value } : x)))
                    }
                  />
                ) : (
                  existing &&
                  existing.name.toLowerCase() !== g.name.toLowerCase() && (
                    <div className="match-sub" style={{ marginTop: 8, marginBottom: 0 }}>
                      “{g.name}” will be saved as another spelling of <b>{existing.name}</b>.
                    </div>
                  )
                )}
              </div>
            );
          })}

          {errorMsg && <p className="form-error" style={{ textAlign: 'center', marginTop: 4 }}>{errorMsg}</p>}

          <div className="review-actions">
            <button type="button" className="btn btn-primary btn-lg" onClick={commitEverything}>
              {tr('saveToKhata')}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setPhase('review')}>
              {tr('backToReview')}
            </button>
          </div>
        </>
      )}

      {phase === 'saving' && (
        <div className="card loading-card">
          <div className="scan-dot" aria-hidden />
          <div className="loading-msg" role="status">
            {tr('writingEntries')}
          </div>
        </div>
      )}

      {phase === 'error' && (
        <div className="card error-card">
          <div className="error-emoji" aria-hidden>
            🌧️
          </div>
          <h2>We couldn’t read that page</h2>
          <p>{errorMsg}</p>
          <div className="upload-btns">
            {dataUrl && (
              <button type="button" className="btn btn-primary" onClick={submit}>
                Try again
              </button>
            )}
            <button type="button" className="btn btn-ghost" onClick={resetForNewPhoto}>
              Use a different photo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function parseNum(s: string): number | null {
  const cleaned = s.replace(/[₹,\s]/g, '');
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}
