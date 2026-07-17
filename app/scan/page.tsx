'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import ReviewTable, { isLowConfidence, type ReviewRow } from '@/components/ReviewTable';
import { fileToJpegDataUrl } from '@/lib/image';
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

const REGISTER_TYPES = [
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

/** One distinct extracted party name awaiting resolution. */
interface MatchGroup {
  name: string;
  rows: number;
  total: number;
  /** 'new' or an existing party id */
  choice: string;
  phone: string;
}

export default function ScanPage() {
  const router = useRouter();

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
  const [skippedCount, setSkippedCount] = useState(0);

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // page count for the "Digitize page N" heading + sample-data rotation;
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
      setRows(
        json.data.rows.map((r) => ({
          id: uid(),
          date: r.date ?? '',
          party: r.party ?? '',
          item: r.item ?? '',
          qty: r.qty != null ? String(r.qty) : '',
          amount: r.amount != null ? String(r.amount) : '',
          type: r.type,
          raw_text: r.raw_text ?? '',
        }))
      );
      setPhase('review');
    } catch {
      setErrorMsg('Could not reach the reader — check your connection and try again.');
      setPhase('error');
    }
  }

  /** Review approved → build match groups for every usable row. */
  function toMatching() {
    refreshParties();
    const usable = usableRows();
    setSkippedCount(rows.length - usable.length);

    const byName = new Map<string, MatchGroup>();
    for (const r of usable) {
      const name = r.party.trim();
      const key = name.toLowerCase();
      const g = byName.get(key) ?? { name, rows: 0, total: 0, choice: 'new', phone: '' };
      g.rows += 1;
      g.total += parseNum(r.amount) ?? 0;
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

  function usableRows(): ReviewRow[] {
    return rows.filter(
      (r) =>
        r.party.trim() &&
        parseNum(r.amount) != null &&
        (r.type === 'credit' || r.type === 'payment' || r.type === 'sale')
    );
  }

  async function commit() {
    if (!result) return;
    setPhase('saving');
    const groupByName = new Map(groups.map((g) => [g.name.toLowerCase(), g]));
    const commitRows = usableRows().map((r) => {
      const g = groupByName.get(r.party.trim().toLowerCase())!;
      const base = {
        // in an udhaar khata a 'sale' row is goods given on credit
        type: (r.type === 'payment' ? 'payment' : 'credit') as 'credit' | 'payment',
        amount: parseNum(r.amount)!,
        item: r.item.trim() || null,
        txnDate: r.date.trim() || null,
        rawText: r.raw_text || null,
      };
      return g.choice === 'new'
        ? { ...base, newParty: { name: g.name, phone: g.phone || null } }
        : { ...base, partyId: g.choice, extractedName: g.name };
    });

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
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        setErrorMsg(json.error ?? 'Could not save the page.');
        setPhase('error');
        return;
      }
      router.push('/udhaar');
      router.refresh();
    } catch {
      setErrorMsg('Could not reach the server — your review is still here, try again.');
      setPhase('match');
    }
  }

  const lowCount = rows.filter(isLowConfidence).length;

  return (
    <div className="container section" style={{ paddingBottom: 24 }}>
      <div className="page-head">
        <h1>
          {phase === 'review'
            ? 'Check what the AI read'
            : phase === 'match'
              ? 'Who are these parties?'
              : `Scan page ${pageCount + 1}`}
        </h1>
        <p>
          {phase === 'review'
            ? 'Nothing is saved until you approve it. Tap any cell to correct it.'
            : phase === 'match'
              ? 'Link each name to a saved party, or create them with a phone number.'
              : 'Hold your phone flat over the page, fill the frame, and shoot.'}
        </p>
      </div>

      {phase === 'pick' && (
        <>
          {!dataUrl ? (
            <div className="drop-zone">
              <p>A clear photo in good light works best. The photo is shrunk on your phone before upload.</p>
              <div className="upload-btns">
                <button type="button" className="btn btn-primary" onClick={() => cameraRef.current?.click()}>
                  📷 Take a photo
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => galleryRef.current?.click()}>
                  Choose from gallery
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

          <label className="field-label">What kind of register is this?</label>
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
              Read this page →
            </button>
            {!dataUrl && <span className="muted" style={{ fontSize: 14 }}>Add a photo to continue</span>}
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
                {lowCount} row{lowCount > 1 ? 's need' : ' needs'} a second look
              </span>
            )}
          </div>

          {result.notes && <p className="notes-callout">Reader’s note: {result.notes}</p>}

          <ReviewTable rows={rows} onChange={setRows} />

          <div className="review-actions">
            <button
              type="button"
              className="btn btn-primary btn-lg"
              disabled={usableRows().length === 0}
              onClick={toMatching}
            >
              Looks right → match parties
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setDataUrl(null);
                setPhase('pick');
              }}
            >
              Re-shoot this page
            </button>
          </div>
        </>
      )}

      {phase === 'match' && (
        <>
          {skippedCount > 0 && (
            <p className="notes-callout" style={{ marginBottom: 14 }}>
              {skippedCount} row{skippedCount > 1 ? 's' : ''} without a party, amount or udhaar
              type will be left out of the khata.
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

          <div className="review-actions">
            <button type="button" className="btn btn-primary btn-lg" onClick={commit}>
              ✓ Save to khata
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setPhase('review')}>
              ← Back to review
            </button>
          </div>
        </>
      )}

      {phase === 'saving' && (
        <div className="card loading-card">
          <div className="scan-dot" aria-hidden />
          <div className="loading-msg" role="status">
            Writing entries to the khata…
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
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setDataUrl(null);
                setPhase('pick');
              }}
            >
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
