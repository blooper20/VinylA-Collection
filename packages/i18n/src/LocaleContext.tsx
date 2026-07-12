"use client";
import React, { createContext, useContext, useState } from 'react';
import { ko } from './locales/ko';
import { en } from './locales/en';
import type { TranslationKey } from './locales/types';

export type Locale = 'ko' | 'en';

const dictionaries = { ko, en };

const resolve = (dict: unknown, key: string): string | undefined => {
  let node: any = dict;
  for (const part of key.split('.')) {
    node = node?.[part];
    if (node === undefined) return undefined;
  }
  return typeof node === 'string' ? node : undefined;
};

const interpolate = (raw: string, params: Record<string, string | number>): string =>
  raw.replace(/\{\{(\w+)\}\}/g, (_, name) => String(params[name] ?? ''));

interface LocaleContextProps {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const LocaleContext = createContext<LocaleContextProps | undefined>(undefined);

export const LocaleProvider = ({
  children,
  initialLocale = 'ko',
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) => {
  const [locale, setLocale] = useState<Locale>(initialLocale);

  const t = (key: TranslationKey, params?: Record<string, string | number>) => {
    // Untranslated keys fall back to Korean rather than the raw key, since
    // ko is the always-complete canonical dictionary (en is only ever
    // checked to match it, not the other way around).
    const raw = resolve(dictionaries[locale], key) ?? resolve(dictionaries.ko, key) ?? key;
    return params ? interpolate(raw, params) : raw;
  };

  return <LocaleContext.Provider value={{ locale, setLocale, t }}>{children}</LocaleContext.Provider>;
};

export const useLocale = () => {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }
  return context;
};
