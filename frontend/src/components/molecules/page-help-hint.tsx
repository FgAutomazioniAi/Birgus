"use client";

import { CircleHelp } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useLanguage } from "@/components/organisms/language-provider";

interface PageHelpHintProps {
  text: string;
}

export function PageHelpHint({ text }: PageHelpHintProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      if (!containerRef.current) {
        return;
      }

      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onDocumentClick);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onDocumentClick);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  return (
    <div className="relative inline-flex" ref={containerRef}>
      <button
        type="button"
        aria-label={t("common.quickHelpPage")}
        title={t("common.quickHelp")}
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border-default bg-bg-surface text-text-secondary transition-colors hover:bg-bg-muted hover:text-brand-primary"
      >
        <CircleHelp size={15} />
      </button>

      {open && (
        <div className="absolute left-10 top-1 z-30 w-72 rounded-[var(--radius-md)] border border-border-default bg-bg-surface p-3 text-xs leading-relaxed text-text-secondary shadow-elevated">
          {text}
        </div>
      )}
    </div>
  );
}
