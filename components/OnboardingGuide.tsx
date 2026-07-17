'use client';

import { useEffect, useState } from 'react';
import { useA11y } from './AccessibilityProvider';

const STEPS = [
  { icon: '📷', titleKey: 'onboardingStep1Title' as const, descKey: 'onboardingStep1Desc' as const },
  { icon: '🔈', titleKey: 'onboardingStep2Title' as const, descKey: 'onboardingStep2Desc' as const },
  { icon: '✅', titleKey: 'onboardingStep3Title' as const, descKey: 'onboardingStep3Desc' as const },
];

/** First-run visual guide for shopkeepers new to smartphones. */
export default function OnboardingGuide() {
  const { onboardingDone, markOnboardingDone, tr, say, locale } = useA11y();
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!onboardingDone) setVisible(true);
  }, [onboardingDone]);

  useEffect(() => {
    if (!visible) return;
    const s = STEPS[step];
    say(`${tr(s.titleKey)}. ${tr(s.descKey)}`);
  }, [visible, step]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible) return null;

  const current = STEPS[step];

  return (
    <div className="onboard-overlay" role="dialog" aria-modal="true" aria-labelledby="onboard-title">
      <div className="onboard-card">
        <div className="onboard-icon" aria-hidden>
          {current.icon}
        </div>
        <h2 id="onboard-title">{tr('onboardingTitle')}</h2>
        <div className="onboard-step-title">{tr(current.titleKey)}</div>
        <p className="onboard-desc">{tr(current.descKey)}</p>

        <div className="onboard-dots" aria-hidden>
          {STEPS.map((_, i) => (
            <span key={i} className={`onboard-dot ${i === step ? 'active' : ''}`} />
          ))}
        </div>

        <div className="onboard-actions">
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              className="btn btn-primary btn-lg btn-block"
              onClick={() => setStep((s) => s + 1)}
            >
              {locale === 'hi' ? 'आगे →' : 'Next →'}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary btn-lg btn-block"
              onClick={() => {
                markOnboardingDone();
                setVisible(false);
              }}
            >
              {tr('onboardingGotIt')}
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost btn-block"
            onClick={() => {
              markOnboardingDone();
              setVisible(false);
            }}
          >
            {tr('onboardingSkip')}
          </button>
        </div>
      </div>
    </div>
  );
}
