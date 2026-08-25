"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { isUiLanguage, translate, UI_LANGUAGE_STORAGE_KEY, type UiLanguage } from "@/lib/language";

interface LanguageContextValue {
  language: UiLanguage;
  setLanguage: (language: UiLanguage) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<UiLanguage>("it");

  useEffect(() => {
    const stored = localStorage.getItem(UI_LANGUAGE_STORAGE_KEY);
    if (isUiLanguage(stored)) {
      setLanguageState(stored);
      document.documentElement.lang = stored;
    }
  }, []);

  const setLanguage = (nextLanguage: UiLanguage) => {
    setLanguageState(nextLanguage);
    document.documentElement.lang = nextLanguage;
    localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, nextLanguage);
  };

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage,
    t: (key, values) => translate(language, key, values),
  }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider.");
  }
  return context;
}
