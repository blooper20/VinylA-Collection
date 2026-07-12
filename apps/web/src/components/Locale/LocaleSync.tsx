"use client";
import { useLocale } from '@vinyla/i18n';
import { useEffect } from 'react';

const STORAGE_KEY = 'locale';

export const LocaleSync = ({ children }: { children: React.ReactNode }) => {
  const { locale, setLocale } = useLocale();

  // Restore a saved preference, or fall back to the browser's language, once
  // on mount. Runs after the initial 'ko' render, same accepted flash the
  // theme system already has for data-theme.
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'ko' || stored === 'en') {
      setLocale(stored);
    } else {
      setLocale(navigator.language.toLowerCase().startsWith('en') ? 'en' : 'ko');
    }
  }, [setLocale]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, locale);
    document.documentElement.setAttribute('lang', locale);
  }, [locale]);

  return <>{children}</>;
};
