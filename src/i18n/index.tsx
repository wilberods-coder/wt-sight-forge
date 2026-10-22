import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { en } from './en';
import { ru, type Dict } from './ru';

export type Lang = 'ru' | 'en';
const DICTS: Record<Lang, Dict> = { ru, en };
const STORAGE_KEY = 'wtsf.lang';

type Join<K, P> = K extends string ? (P extends string ? `${K}.${P}` : never) : never;
type Paths<T> = T extends string
  ? never
  : T extends readonly unknown[]
    ? never
    : { [K in keyof T]: T[K] extends string | readonly unknown[] ? K : Join<K, Paths<T[K]>> }[keyof T];
export type TKey = Paths<Dict>;

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TKey, vars?: Record<string, string | number>) => string;
  list: (key: TKey) => string[];
  dict: Dict;
}

const Ctx = createContext<I18nCtx | null>(null);

function lookup(dict: Dict, key: string): unknown {
  return key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], dict);
}

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'ru' || saved === 'en') return saved;
  } catch {
    /* storage unavailable */
  }
  return 'ru'; // Russian by default
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const value = useMemo<I18nCtx>(() => {
    const dict = DICTS[lang];
    return {
      lang,
      setLang,
      dict,
      t: (key, vars) => {
        let s = lookup(dict, key);
        if (typeof s !== 'string') s = key;
        if (vars) for (const [k, v] of Object.entries(vars)) s = (s as string).replaceAll(`{${k}}`, String(v));
        return s as string;
      },
      list: (key) => {
        const v = lookup(dict, key);
        return Array.isArray(v) ? (v as string[]) : [];
      },
    };
  }, [lang, setLang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useI18n outside I18nProvider');
  return c;
}
