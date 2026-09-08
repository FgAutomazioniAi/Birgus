"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

import {
  CORNER_STYLE_OPTIONS,
  CORNER_STYLE_STORAGE_KEY,
  DEFAULT_CORNER_STYLE,
  DEFAULT_THEME,
  isCornerStyle,
  isThemeId,
  THEME_OPTIONS,
  THEME_STORAGE_KEY,
  type CornerStyle,
  type ThemeId,
} from "@/lib/themes";

interface ThemeContextValue {
  cornerOptions: typeof CORNER_STYLE_OPTIONS;
  cornerStyle: CornerStyle;
  options: typeof THEME_OPTIONS;
  setCornerStyle: (cornerStyle: CornerStyle) => void;
  setTheme: (themeId: ThemeId) => void;
  theme: ThemeId;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const applyTheme = (themeId: ThemeId) => {
  document.documentElement.setAttribute("data-theme", themeId);
};

const applyCornerStyle = (cornerStyle: CornerStyle) => {
  document.documentElement.setAttribute("data-corners", cornerStyle);
};

const readStoredTheme = (): ThemeId => {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored && isThemeId(stored)) {
    return stored;
  }
  return DEFAULT_THEME;
};

const readStoredCornerStyle = (): CornerStyle => {
  const stored = localStorage.getItem(CORNER_STYLE_STORAGE_KEY);
  return stored && isCornerStyle(stored) ? stored : DEFAULT_CORNER_STYLE;
};

interface UserPreferenceApiResponse {
  cornerStyle?: string;
  paletteId?: string;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT_THEME);
  const [cornerStyle, setCornerStyleState] = useState<CornerStyle>(DEFAULT_CORNER_STYLE);

  useEffect(() => {
    const storedTheme = readStoredTheme();
    const storedCornerStyle = readStoredCornerStyle();
    setThemeState(storedTheme);
    setCornerStyleState(storedCornerStyle);
    applyTheme(storedTheme);
    applyCornerStyle(storedCornerStyle);

    const syncThemeFromDatabase = async () => {
      try {
        const response = await fetch("/api/user/preferences", { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as UserPreferenceApiResponse;
        if (data.paletteId && isThemeId(data.paletteId)) {
          setThemeState(data.paletteId);
          applyTheme(data.paletteId);
          localStorage.setItem(THEME_STORAGE_KEY, data.paletteId);
        }
        if (data.cornerStyle && isCornerStyle(data.cornerStyle)) {
          setCornerStyleState(data.cornerStyle);
          applyCornerStyle(data.cornerStyle);
          localStorage.setItem(CORNER_STYLE_STORAGE_KEY, data.cornerStyle);
        }
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

  const setCornerStyle = (nextCornerStyle: CornerStyle) => {
    setCornerStyleState(nextCornerStyle);
    applyCornerStyle(nextCornerStyle);
    localStorage.setItem(CORNER_STYLE_STORAGE_KEY, nextCornerStyle);

    void fetch("/api/user/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cornerStyle: nextCornerStyle }),
    }).catch(() => {
      // persistenza server fallita: resta valido il fallback locale.
    });
  };

  const value = useMemo<ThemeContextValue>(
    () => ({
      cornerOptions: CORNER_STYLE_OPTIONS,
      cornerStyle,
      theme,
      setCornerStyle,
      setTheme,
      options: THEME_OPTIONS,
    }),
    [cornerStyle, theme],
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
