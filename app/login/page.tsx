'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Step = 'phone' | 'otp';

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [shopName, setShopName] = useState('');
  const [needShopName, setNeedShopName] = useState(false);
  const [hint, setHint] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function requestOtp() {
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? 'Could not send OTP.');
        return;
      }
      setHint(json.hint ?? '');
      setStep('otp');
    } catch {
      setError('Network hiccup — try again.');
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp, shopName }),
      });
      const json = await res.json();
      if (json.needShopName) {
        setNeedShopName(true);
        setError('');
        return;
      }
      if (!json.ok) {
        setError(json.error ?? 'Could not verify.');
        return;
      }
      router.push('/home');
      router.refresh();
    } catch {
      setError('Network hiccup — try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <span className="brand-big">
        Kaagaz<em>AI</em>
      </span>
      <p className="login-sub">
        Your paper register, digital in one photo.
        <br />
        Login with your mobile number to open your khata.
      </p>

      <div className="login-card">
        {step === 'phone' && (
          <>
            <label className="form-label" htmlFor="phone">
              Mobile number
            </label>
            <input
              id="phone"
              className="form-input"
              inputMode="tel"
              placeholder="98480 12345"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && requestOtp()}
            />
            <button
              type="button"
              className="btn btn-primary btn-block btn-lg"
              style={{ marginTop: 16 }}
              disabled={busy || phone.replace(/\D/g, '').length < 10}
              onClick={requestOtp}
            >
              Get OTP →
            </button>
          </>
        )}

        {step === 'otp' && (
          <>
            <label className="form-label" htmlFor="otp">
              Enter OTP sent to {phone}
            </label>
            <input
              id="otp"
              className="form-input"
              inputMode="numeric"
              maxLength={6}
              placeholder="6-digit code"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && verify()}
            />
            {needShopName && (
              <>
                <label className="form-label" htmlFor="shopname">
                  Your shop name (first login)
                </label>
                <input
                  id="shopname"
                  className="form-input"
                  placeholder="e.g. Kumar Kirana Store"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && verify()}
                />
              </>
            )}
            <button
              type="button"
              className="btn btn-primary btn-block btn-lg"
              style={{ marginTop: 16 }}
              disabled={busy || otp.trim().length !== 6 || (needShopName && !shopName.trim())}
              onClick={verify}
            >
              {needShopName ? 'Create my khata →' : 'Verify & open khata →'}
            </button>
            {hint && <div className="otp-hint">📟 {hint} (demo mode — no SMS is sent)</div>}
            <button
              type="button"
              className="link-danger"
              style={{ width: '100%', marginTop: 8 }}
              onClick={() => {
                setStep('phone');
                setOtp('');
                setNeedShopName(false);
                setError('');
              }}
            >
              Change number
            </button>
          </>
        )}

        {error && <div className="form-error">{error}</div>}
      </div>
    </div>
  );
}
