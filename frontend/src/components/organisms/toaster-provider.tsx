"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Toaster } from "sonner";

import { translate, type UiLanguage } from "@/lib/language";

export type ToastPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

interface ToasterContextValue {
  enabled: boolean;
  position: ToastPosition;
  setEnabled: (enabled: boolean) => void;
  setPosition: (position: ToastPosition) => void;
}

interface UserPreferenceApiResponse {
  notificationPopups?: boolean;
  notificationPosition?: string;
}

const DEFAULT_TOAST_POSITION: ToastPosition = "bottom-right";
const TOAST_POSITION_STORAGE_KEY = "birgus:toast-position";
const TOAST_ENABLED_STORAGE_KEY = "birgus:toast-enabled";
const TOAST_POSITIONS: readonly ToastPosition[] = [
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];

const ToasterContext = createContext<ToasterContextValue | null>(null);

export const toastPositionOptions = (language: UiLanguage): Array<{ label: string; value: ToastPosition }> => [
  { value: "top-left", label: translate(language, "notifications.position.topLeft") },
  { value: "top-center", label: translate(language, "notifications.position.topCenter") },
  { value: "top-right", label: translate(language, "notifications.position.topRight") },
  { value: "bottom-left", label: translate(language, "notifications.position.bottomLeft") },
  { value: "bottom-center", label: translate(language, "notifications.position.bottomCenter") },
  { value: "bottom-right", label: translate(language, "notifications.position.bottomRight") },
];

export function isToastPosition(value: string): value is ToastPosition {
  return TOAST_POSITIONS.includes(value as ToastPosition);
}

const readStoredPosition = (): ToastPosition => {
  const stored = localStorage.getItem(TOAST_POSITION_STORAGE_KEY);
  return stored && isToastPosition(stored) ? stored : DEFAULT_TOAST_POSITION;
};

const readStoredEnabled = (): boolean => localStorage.getItem(TOAST_ENABLED_STORAGE_KEY) !== "false";

export function ToasterProvider({ children }: { children: ReactNode }) {
  const [position, setPositionState] = useState<ToastPosition>(DEFAULT_TOAST_POSITION);
  const [enabled, setEnabledState] = useState(true);

  useEffect(() => {
    const storedPosition = readStoredPosition();
    const storedEnabled = readStoredEnabled();
    setPositionState(storedPosition);
    setEnabledState(storedEnabled);

    const syncPositionFromDatabase = async () => {
      try {
        const response = await fetch("/api/user/preferences", { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as UserPreferenceApiResponse;
        if (!data.notificationPosition || !isToastPosition(data.notificationPosition)) {
          if (typeof data.notificationPopups === "boolean") {
            setEnabledState(data.notificationPopups);
            localStorage.setItem(TOAST_ENABLED_STORAGE_KEY, String(data.notificationPopups));
          }
          return;
        }

        setPositionState(data.notificationPosition);
        localStorage.setItem(TOAST_POSITION_STORAGE_KEY, data.notificationPosition);
        if (typeof data.notificationPopups === "boolean") {
          setEnabledState(data.notificationPopups);
          localStorage.setItem(TOAST_ENABLED_STORAGE_KEY, String(data.notificationPopups));
        }
      } catch {
        // fallback su preferenza locale in caso di errore rete/non autenticato.
      }
    };

    void syncPositionFromDatabase();
  }, []);

  const setPosition = (nextPosition: ToastPosition) => {
    setPositionState(nextPosition);
    localStorage.setItem(TOAST_POSITION_STORAGE_KEY, nextPosition);

    const persistPosition = async () => {
      try {
        await fetch("/api/user/preferences", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notificationPosition: nextPosition }),
        });
      } catch {
        // persistenza server fallita: resta valido il fallback locale.
      }
    };

    void persistPosition();
  };

  const setEnabled = (nextEnabled: boolean) => {
    setEnabledState(nextEnabled);
    localStorage.setItem(TOAST_ENABLED_STORAGE_KEY, String(nextEnabled));
    void fetch("/api/user/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationPopups: nextEnabled }),
    }).catch(() => {
      // The local preference remains available if persistence fails.
    });
  };

  const value = useMemo<ToasterContextValue>(
    () => ({
      enabled,
      position,
      setEnabled,
      setPosition,
    }),
    [enabled, position],
  );

  return (
    <ToasterContext.Provider value={value}>
      {children}
      {enabled ? <Toaster position={position} richColors duration={4000} swipeDirections={["top", "right", "bottom", "left"]} /> : null}
    </ToasterContext.Provider>
  );
}

export function useToasterPreferences() {
  const context = useContext(ToasterContext);
  if (!context) {
    throw new Error("useToasterPreferences deve essere usato dentro ToasterProvider.");
  }
  return context;
}
