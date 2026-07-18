'use client';

import { usePathname } from 'next/navigation';
import { speak, getSpeaking, stopSpeaking } from '@/lib/speech';
import { useLang } from './LanguageProvider';
import type { UILocale, UIStringKey } from '@/lib/i18n';

/** Cycle order and chip label for each UI language. */
const LOCALE_CYCLE: UILocale[] = ['hi', 'en', 'te'];
const LOCALE_LABEL: Record<UILocale, string> = { hi: 'हि', en: 'EN', te: 'తె' };

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

  function cycleLocale() {
    const next = LOCALE_CYCLE[(LOCALE_CYCLE.indexOf(locale) + 1) % LOCALE_CYCLE.length];
    setLocale(next);
  }

  return (
    <div className="header-controls">
      <button
        type="button"
        className={`a11y-chip ${locale !== 'en' ? 'active' : ''}`}
        onClick={cycleLocale}
        aria-pressed={locale !== 'en'}
        aria-label={tr('langToggle')}
        title={tr('langToggle')}
      >
        {LOCALE_LABEL[locale]}
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
