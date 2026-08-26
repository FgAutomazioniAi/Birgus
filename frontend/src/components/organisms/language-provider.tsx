"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { isUiLanguage, translate, UI_LANGUAGE_STORAGE_KEY, type UiLanguage } from "@/lib/language";

interface LanguageContextValue {
  language: UiLanguage;
  setLanguage: (language: UiLanguage) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}

interface UserPreferenceApiResponse {
  languageCode?: string;
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

    const syncLanguageFromDatabase = async () => {
      try {
        const response = await fetch("/api/user/preferences", { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as UserPreferenceApiResponse;
        if (!data.languageCode || !isUiLanguage(data.languageCode)) {
          return;
        }

        setLanguageState(data.languageCode);
        document.documentElement.lang = data.languageCode;
        localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, data.languageCode);
      } catch {
        // fallback su preferenza locale in caso di errore rete/non autenticato.
      }
    };

    void syncLanguageFromDatabase();
  }, []);

  const setLanguage = (nextLanguage: UiLanguage) => {
    setLanguageState(nextLanguage);
    document.documentElement.lang = nextLanguage;
    localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, nextLanguage);

    const persistLanguage = async () => {
      try {
        await fetch("/api/user/preferences", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ languageCode: nextLanguage }),
        });
      } catch {
        // persistenza server fallita: resta valido il fallback locale.
      }
    };

    void persistLanguage();
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
