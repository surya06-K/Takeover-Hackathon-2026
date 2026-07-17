'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { playError, playSuccess, playTap } from '@/lib/audio';
import { t, type UIStringKey, type UILocale } from '@/lib/i18n';
import { speak, stopSpeaking, warmUpVoices } from '@/lib/speech';

const STORAGE_KEY = 'kaagaz-a11y';

interface A11yPrefs {
  locale: UILocale;
  voiceHelp: boolean;
  audioFeedback: boolean;
  largeText: boolean;
  onboardingDone: boolean;
}

const DEFAULT_PREFS: A11yPrefs = {
  locale: 'hi',
  voiceHelp: true,
  audioFeedback: true,
  largeText: false,
  onboardingDone: false,
};

interface A11yContextValue extends A11yPrefs {
  tr: (key: UIStringKey) => string;
  setLocale: (l: UILocale) => void;
  toggleVoiceHelp: () => void;
  toggleAudioFeedback: () => void;
  toggleLargeText: () => void;
  markOnboardingDone: () => void;
  say: (text: string) => Promise<void>;
  sayKey: (key: UIStringKey) => Promise<void>;
  feedbackSuccess: () => void;
  feedbackError: () => void;
  feedbackTap: () => void;
}

const A11yContext = createContext<A11yContextValue | null>(null);

function loadPrefs(): A11yPrefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

function savePrefs(prefs: A11yPrefs) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<A11yPrefs>(DEFAULT_PREFS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setPrefs(loadPrefs());
    setHydrated(true);
    warmUpVoices();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    savePrefs(prefs);
    document.documentElement.lang = prefs.locale === 'hi' ? 'hi' : 'en';
    document.documentElement.classList.toggle('large-text', prefs.largeText);
  }, [prefs, hydrated]);

  const patch = useCallback((partial: Partial<A11yPrefs>) => {
    setPrefs((p) => ({ ...p, ...partial }));
  }, []);

  const tr = useCallback((key: UIStringKey) => t(prefs.locale, key), [prefs.locale]);

  const say = useCallback(
    async (text: string) => {
      if (!prefs.voiceHelp) return;
      await speak(text, prefs.locale);
    },
    [prefs.voiceHelp, prefs.locale]
  );

  const sayKey = useCallback(
    async (key: UIStringKey) => say(t(prefs.locale, key)),
    [prefs.locale, say]
  );

  const feedbackSuccess = useCallback(() => {
    if (prefs.audioFeedback) playSuccess();
  }, [prefs.audioFeedback]);

  const feedbackError = useCallback(() => {
    if (prefs.audioFeedback) playError();
  }, [prefs.audioFeedback]);

  const feedbackTap = useCallback(() => {
    if (prefs.audioFeedback) playTap();
  }, [prefs.audioFeedback]);

  const value = useMemo<A11yContextValue>(
    () => ({
      ...prefs,
      tr,
      setLocale: (locale) => {
        stopSpeaking();
        patch({ locale });
      },
      toggleVoiceHelp: () => patch({ voiceHelp: !prefs.voiceHelp }),
      toggleAudioFeedback: () => patch({ audioFeedback: !prefs.audioFeedback }),
      toggleLargeText: () => patch({ largeText: !prefs.largeText }),
      markOnboardingDone: () => patch({ onboardingDone: true }),
      say,
      sayKey,
      feedbackSuccess,
      feedbackError,
      feedbackTap,
    }),
    [prefs, patch, tr, say, sayKey, feedbackSuccess, feedbackError, feedbackTap]
  );

  return <A11yContext.Provider value={value}>{children}</A11yContext.Provider>;
}

export function useA11y(): A11yContextValue {
  const ctx = useContext(A11yContext);
  if (!ctx) throw new Error('useA11y must be used within AccessibilityProvider');
  return ctx;
}

/** Safe hook for server components' children — returns null context guard. */
export function useA11yOptional(): A11yContextValue | null {
  return useContext(A11yContext);
}
