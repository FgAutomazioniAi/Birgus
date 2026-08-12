"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";

export type SelectDropdownOption = {
  disabled?: boolean;
  label: string;
  value: string;
};

interface SelectDropdownProps {
  allowEmpty?: boolean;
  className?: string;
  disabled?: boolean;
  id?: string;
  onChange: (value: string) => void;
  options: SelectDropdownOption[];
  placeholder?: string;
  size?: "sm" | "md";
  value: string;
}

const triggerSizeClass: Record<NonNullable<SelectDropdownProps["size"]>, string> = {
  sm: "h-8 px-2 text-xs",
  md: "h-11 px-3 text-sm",
};

export function SelectDropdown({
  allowEmpty = false,
  className,
  disabled,
  id,
  onChange,
  options,
  placeholder = "Seleziona",
  size = "md",
  value,
}: SelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = options.find((option) => option.value === value) ?? null;

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current) {
        return;
      }

      if (!wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const handleSelect = (nextValue: string, optionDisabled?: boolean) => {
    if (optionDisabled) {
      return;
    }

    onChange(nextValue);
    setOpen(false);
  };

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex w-full items-center justify-between rounded-[var(--radius-md)] border border-border-default bg-bg-muted text-left text-text-secondary",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary",
          "disabled:cursor-not-allowed disabled:opacity-60",
          triggerSizeClass[size],
        )}
      >
        <span className={selectedOption ? "text-text-secondary" : "text-text-muted"}>
          {selectedOption?.label ?? placeholder}
        </span>
        <ChevronDown size={16} className={cn("transition-transform", open ? "rotate-180" : "rotate-0")} />
      </button>

      {open ? (
        <div className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-[var(--radius-md)] border border-border-default bg-bg-surface p-1 shadow-elevated">
          {allowEmpty ? (
            <button
              type="button"
              onClick={() => handleSelect("")}
              className="flex w-full items-center justify-between rounded-[var(--radius-sm)] px-3 py-2 text-left text-sm text-text-muted transition-colors hover:bg-bg-subtle"
            >
              <span>{placeholder}</span>
              {!value ? <Check size={14} className="text-brand-primary" /> : null}
            </button>
          ) : null}

          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={option.disabled}
              onClick={() => handleSelect(option.value, option.disabled)}
              className={cn(
                "flex w-full items-center justify-between rounded-[var(--radius-sm)] px-3 py-2 text-left transition-colors",
                size === "sm" ? "text-xs" : "text-sm",
                option.disabled
                  ? "cursor-not-allowed opacity-50"
                  : "text-text-secondary hover:bg-bg-subtle",
              )}
            >
              <span className="truncate">{option.label}</span>
              {value === option.value ? <Check size={14} className="text-brand-primary" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
