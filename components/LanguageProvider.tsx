'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { t, type UILocale, type UIStringKey } from '@/lib/i18n';

const STORAGE_KEY = 'kaagaz-lang';

interface LangContextValue {
  locale: UILocale;
  setLocale: (l: UILocale) => void;
  tr: (key: UIStringKey) => string;
}

const LangContext = createContext<LangContextValue | null>(null);

/** Hindi-first UI language. Persisted per device; server and first client render
 *  both use 'hi' so hydration stays consistent, then the stored choice applies. */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<UILocale>('hi');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'hi') setLocaleState(stored);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = (l: UILocale) => {
    setLocaleState(l);
    localStorage.setItem(STORAGE_KEY, l);
  };

  return (
    <LangContext.Provider value={{ locale, setLocale, tr: (key) => t(locale, key) }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used inside LanguageProvider');
  return ctx;
}
