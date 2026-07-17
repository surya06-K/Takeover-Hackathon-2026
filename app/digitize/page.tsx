'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import ReviewTable, { emptyReviewRow, isLowConfidence, type ReviewRow } from '@/components/ReviewTable';
import { fileToJpegDataUrl } from '@/lib/image';
import { addPage, useLedger } from '@/lib/store';
import {
  MODEL_LABELS,
  uid,
  type ExtractResponse,
  type ExtractResult,
  type LedgerRow,
  type ModelId,
} from '@/lib/types';

type Phase = 'pick' | 'loading' | 'review' | 'error';

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

export default function DigitizePage() {
  const router = useRouter();
  const { pages } = useLedger();

  const [phase, setPhase] = useState<Phase>('pick');
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [registerType, setRegisterType] = useState(REGISTER_TYPES[0].id);
  const [errorMsg, setErrorMsg] = useState('');
  const [model, setModel] = useState<ModelId>('gemini');
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [msgIndex, setMsgIndex] = useState(0);

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const nextPageNumber = pages.length + 1;

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
        body: JSON.stringify({ image: dataUrl, registerType, page: nextPageNumber }),
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

  function confirmAndSave() {
    if (!result) return;
    const cleaned: LedgerRow[] = rows
      .filter((r) => r.date || r.party || r.item || r.qty || r.amount || r.raw_text)
      .map((r) => ({
        id: r.id,
        date: r.date.trim() || null,
        party: r.party.trim() || null,
        item: r.item.trim() || null,
        qty: parseNum(r.qty),
        amount: parseNum(r.amount),
        type: r.type,
        raw_text: r.raw_text,
      }));
    addPage({
      model,
      registerType: result.register_type,
      confidence: result.confidence,
      notes: result.notes,
      rows: cleaned,
    });
    router.push('/ledger');
  }

  const lowCount = rows.filter(isLowConfidence).length;

  return (
    <div className="container section">
      <div className="page-head">
        <h1>
          {phase === 'review' ? 'Check what the AI read' : `Digitize page ${nextPageNumber}`}
        </h1>
        <p>
          {phase === 'review'
            ? 'Nothing is saved until you approve it. Tap any cell to correct it.'
            : pages.length > 0
              ? `This page will be added to your ledger (${pages.length} page${pages.length > 1 ? 's' : ''} saved so far).`
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
                <span className="sk-cell" style={{ animationDelay: `${i * 0.1}s` }} />
                <span className="sk-cell" style={{ animationDelay: `${i * 0.1 + 0.05}s` }} />
                <span className="sk-cell" style={{ animationDelay: `${i * 0.1 + 0.1}s` }} />
                <span className="sk-cell" style={{ animationDelay: `${i * 0.1 + 0.15}s` }} />
                <span className="sk-cell" style={{ animationDelay: `${i * 0.1 + 0.2}s` }} />
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
            <button type="button" className="btn btn-primary btn-lg" onClick={confirmAndSave}>
              ✓ Confirm &amp; Save {rows.length} entr{rows.length === 1 ? 'y' : 'ies'}
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

      {phase === 'error' && (
        <div className="card error-card">
          <div className="error-emoji" aria-hidden>🌧️</div>
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
  return Number.isFinite(n) ? n : null;
}
