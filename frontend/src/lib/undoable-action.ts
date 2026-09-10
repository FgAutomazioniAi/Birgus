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

export function scheduleUndoableAction(options: UndoableActionOptions): void {
  void options.commit().catch((error: unknown) => {
    options.rollback();
    const message = error instanceof Error && error.message.trim().length > 0
      ? error.message
      : options.errorMessage;
    toast.error(message);
  });
}
