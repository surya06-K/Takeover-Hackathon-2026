'use client';

import { usePathname } from 'next/navigation';
import { useA11y } from './AccessibilityProvider';

/** Header toolbar: language, voice help, large text, page help. */
export default function AccessibilityToolbar() {
  const pathname = usePathname();
  const {
    locale,
    voiceHelp,
    largeText,
    setLocale,
    toggleVoiceHelp,
    toggleLargeText,
    tr,
    say,
  } = useA11y();

  if (pathname === '/login' || pathname === '/') return null;

  const helpKey = pathname.startsWith('/udhaar')
    ? 'helpUdhaar'
    : pathname.startsWith('/scan')
      ? 'helpScan'
      : pathname.startsWith('/party')
        ? 'helpParty'
        : pathname.startsWith('/sales')
          ? 'helpSales'
          : pathname.startsWith('/stock')
            ? 'helpStock'
            : 'helpHome';

  return (
    <div className="a11y-toolbar" aria-label="Accessibility options">
      <button
        type="button"
        className={`a11y-chip ${locale === 'hi' ? 'active' : ''}`}
        onClick={() => setLocale(locale === 'hi' ? 'en' : 'hi')}
        aria-pressed={locale === 'hi'}
        title={tr('langToggle')}
      >
        {locale === 'hi' ? '🇮🇳 हि' : 'EN'}
      </button>
      <button
        type="button"
        className={`a11y-chip ${voiceHelp ? 'active' : ''}`}
        onClick={toggleVoiceHelp}
        aria-pressed={voiceHelp}
        title={voiceHelp ? tr('voiceHelpOn') : tr('voiceHelpOff')}
      >
        {voiceHelp ? '🔊' : '🔇'}
      </button>
      <button
        type="button"
        className={`a11y-chip ${largeText ? 'active' : ''}`}
        onClick={toggleLargeText}
        aria-pressed={largeText}
        title={largeText ? tr('largeTextOn') : tr('largeTextOff')}
      >
        A+
      </button>
      <button
        type="button"
        className="a11y-chip a11y-help"
        onClick={() => say(tr(helpKey))}
        title={tr('help')}
      >
        ❓
      </button>
    </div>
  );
}
