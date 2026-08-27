"use client";

import {
  LOCALE_CODES,
  getLocaleMetadata,
  type LanguageDto,
  type LocaleCode,
} from "@maglive/contracts";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getLanguages } from "./api";

const initialLanguages: LanguageDto[] = LOCALE_CODES.map((code) => {
  const metadata = getLocaleMetadata(code);
  return {
    code,
    languageTag: metadata.languageTag,
    acceptLanguageAliases: [...metadata.acceptLanguageAliases],
    direction: metadata.direction,
    fallback: metadata.fallback,
    label: metadata.label,
    nativeLabel: metadata.nativeLabel,
    builtIn: true,
  };
});

type LanguageContextValue = Readonly<{
  languages: readonly LanguageDto[];
  localeCodes: readonly LocaleCode[];
  languageByCode: Readonly<Record<string, LanguageDto>>;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}>;

const initialLanguageByCode = Object.fromEntries(
  initialLanguages.map((language) => [language.code, language]),
);
const initialContextValue: LanguageContextValue = {
  languages: initialLanguages,
  localeCodes: initialLanguages.map(({ code }) => code),
  languageByCode: initialLanguageByCode,
  loading: false,
  error: null,
  refresh: async () => undefined,
};

const LanguageContext = createContext<LanguageContextValue>(initialContextValue);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [languages, setLanguages] = useState<readonly LanguageDto[]>(initialLanguages);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setLanguages((await getLanguages()).languages);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Languages could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void getLanguages()
      .then((result) => {
        if (!active) return;
        setLanguages(result.languages);
        setError(null);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : "Languages could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<LanguageContextValue>(() => ({
    languages,
    localeCodes: languages.map(({ code }) => code),
    languageByCode: Object.fromEntries(languages.map((language) => [language.code, language])),
    loading,
    error,
    refresh,
  }), [languages, loading, error, refresh]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguages(): LanguageContextValue {
  return useContext(LanguageContext);
}
