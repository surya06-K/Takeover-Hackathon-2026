'use client';

import { usePathname } from 'next/navigation';
import { speak, getSpeaking, stopSpeaking } from '@/lib/speech';
import { useLang } from './LanguageProvider';
import type { UIStringKey } from '@/lib/i18n';

/** Header chips: big हि/EN language toggle + 🔊❓ spoken help for the current page. */
export default function HeaderControls() {
  const pathname = usePathname();
  const { locale, setLocale, tr } = useLang();

  if (pathname === '/login' || pathname === '/') return null;

  const helpKey: UIStringKey = pathname.startsWith('/udhaar')
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

  function sayHelp() {
    if (getSpeaking()) stopSpeaking();
    else speak(tr(helpKey), locale);
  }

  return (
    <div className="header-controls">
      <button
        type="button"
        className={`a11y-chip ${locale === 'hi' ? 'active' : ''}`}
        onClick={() => setLocale(locale === 'hi' ? 'en' : 'hi')}
        aria-pressed={locale === 'hi'}
        aria-label={tr('langToggle')}
        title={tr('langToggle')}
      >
        {locale === 'hi' ? 'हि' : 'EN'}
      </button>
      <button
        type="button"
        className="a11y-chip"
        onClick={sayHelp}
        aria-label={tr('help')}
        title={tr('help')}
      >
        🔊❓
      </button>
    </div>
  );
}
