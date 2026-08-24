"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Toaster } from "sonner";

export type ToastPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

interface ToasterContextValue {
  position: ToastPosition;
  setPosition: (position: ToastPosition) => void;
}

interface UserPreferenceApiResponse {
  notificationPosition?: string;
}

const DEFAULT_TOAST_POSITION: ToastPosition = "bottom-right";
const TOAST_POSITION_STORAGE_KEY = "birgus:toast-position";
const TOAST_POSITIONS: readonly ToastPosition[] = [
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];

const ToasterContext = createContext<ToasterContextValue | null>(null);

export const TOAST_POSITION_OPTIONS: Array<{ label: string; value: ToastPosition }> = [
  { value: "top-left", label: "Alto sinistra" },
  { value: "top-center", label: "Alto centro" },
  { value: "top-right", label: "Alto destra" },
  { value: "bottom-left", label: "Basso sinistra" },
  { value: "bottom-center", label: "Basso centro" },
  { value: "bottom-right", label: "Basso destra" },
];

export function isToastPosition(value: string): value is ToastPosition {
  return TOAST_POSITIONS.includes(value as ToastPosition);
}

const readStoredPosition = (): ToastPosition => {
  const stored = localStorage.getItem(TOAST_POSITION_STORAGE_KEY);
  return stored && isToastPosition(stored) ? stored : DEFAULT_TOAST_POSITION;
};

export function ToasterProvider({ children }: { children: ReactNode }) {
  const [position, setPositionState] = useState<ToastPosition>(DEFAULT_TOAST_POSITION);

  useEffect(() => {
    const storedPosition = readStoredPosition();
    setPositionState(storedPosition);

    const syncPositionFromDatabase = async () => {
      try {
        const response = await fetch("/api/user/preferences", { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as UserPreferenceApiResponse;
        if (!data.notificationPosition || !isToastPosition(data.notificationPosition)) {
          return;
        }

        setPositionState(data.notificationPosition);
        localStorage.setItem(TOAST_POSITION_STORAGE_KEY, data.notificationPosition);
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

  const value = useMemo<ToasterContextValue>(
    () => ({
      position,
      setPosition,
    }),
    [position],
  );

  return (
    <ToasterContext.Provider value={value}>
      {children}
      <Toaster
        position={position}
        richColors
        duration={4000}
        swipeDirections={["top", "right", "bottom", "left"]}
      />
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
