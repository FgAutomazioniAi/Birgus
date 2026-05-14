"use client";

import { toast } from "sonner";

interface UndoableActionOptions {
  commit: () => Promise<void>;
  durationMs?: number;
  errorMessage: string;
  pendingMessage: string;
  rollback: () => void;
  successMessage: string;
  undoLabel?: string;
  undoMessage?: string;
}

const DEFAULT_DURATION_MS = 10_000;

export function scheduleUndoableAction(options: UndoableActionOptions): void {
  const durationMs = options.durationMs ?? DEFAULT_DURATION_MS;
  let cancelled = false;
  let committed = false;

  const timeoutId = window.setTimeout(() => {
    if (cancelled) {
      return;
    }

    committed = true;
    void options.commit().then(() => {
      toast.success(options.successMessage);
    }).catch((error: unknown) => {
      options.rollback();
      const message = error instanceof Error && error.message.trim().length > 0
        ? error.message
        : options.errorMessage;
      toast.error(message);
    });
  }, durationMs);

  toast.message(options.pendingMessage, {
    action: {
      label: options.undoLabel ?? "Annulla",
      onClick: () => {
        if (committed || cancelled) {
          return;
        }

        cancelled = true;
        window.clearTimeout(timeoutId);
        options.rollback();
        toast.message(options.undoMessage ?? "Operazione annullata.");
      },
    },
    duration: durationMs,
  });
}
