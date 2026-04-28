"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { DEFAULT_THEME, isThemeId, THEME_OPTIONS, THEME_STORAGE_KEY, type ThemeId } from "@/lib/themes";

interface ThemeContextValue {
  options: typeof THEME_OPTIONS;
  setTheme: (themeId: ThemeId) => void;
  theme: ThemeId;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const applyTheme = (themeId: ThemeId) => {
  document.documentElement.setAttribute("data-theme", themeId);
};

const readStoredTheme = (): ThemeId => {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored && isThemeId(stored)) {
    return stored;
  }
  return DEFAULT_THEME;
};

interface UserPreferenceApiResponse {
  paletteId?: string;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT_THEME);

  useEffect(() => {
    const storedTheme = readStoredTheme();
    setThemeState(storedTheme);
    applyTheme(storedTheme);

    const syncThemeFromDatabase = async () => {
      try {
        const response = await fetch("/api/user/preferences", { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as UserPreferenceApiResponse;
        if (!data.paletteId || !isThemeId(data.paletteId)) {
          return;
        }

        setThemeState(data.paletteId);
        applyTheme(data.paletteId);
        localStorage.setItem(THEME_STORAGE_KEY, data.paletteId);
      } catch {
        // fallback su preferenza locale in caso di errore rete/non autenticato.
      }
    };

    void syncThemeFromDatabase();
  }, []);

  const setTheme = (themeId: ThemeId) => {
    setThemeState(themeId);
    applyTheme(themeId);
    localStorage.setItem(THEME_STORAGE_KEY, themeId);

    const persistTheme = async () => {
      try {
        await fetch("/api/user/preferences", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paletteId: themeId }),
        });
      } catch {
        // persistenza server fallita: resta valido il fallback locale.
      }
    };

    void persistTheme();
  };

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      options: THEME_OPTIONS,
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme deve essere usato dentro ThemeProvider.");
  }
  return context;
}
