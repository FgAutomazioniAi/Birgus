import { type ReactNode } from "react";

import { Button } from "@/components/atoms";

interface SegmentedOption<TValue extends string> {
  description?: string;
  icon?: ReactNode;
  label: string;
  value: TValue;
}

interface SegmentedControlProps<TValue extends string> {
  ariaLabel: string;
  onChange: (value: TValue) => void;
  options: Array<SegmentedOption<TValue>>;
  value: TValue;
}

interface OptionSelectProps<TValue extends string> {
  id: string;
  label: string;
  onChange: (value: TValue) => void;
  options: Array<{ label: string; value: TValue }>;
  value: TValue;
}

export function SegmentedControl<TValue extends string>({ ariaLabel, onChange, options, value }: SegmentedControlProps<TValue>) {
  return (
    <div className="inline-flex rounded-lg border border-border-default bg-bg-surface p-1" aria-label={ariaLabel} role="group">
      {options.map((option) => (
        <Button
          key={option.value}
          variant={value === option.value ? "primary" : "ghost"}
          size="sm"
          className="h-8 rounded-md px-2.5"
          onClick={() => onChange(option.value)}
          title={option.description}
        >
          {option.icon}
          {option.label}
        </Button>
      ))}
    </div>
  );
}

export function OptionSelect<TValue extends string>({ id, label, onChange, options, value }: OptionSelectProps<TValue>) {
  return (
    <label className="flex items-center gap-2 text-sm text-text-secondary" htmlFor={id}>
      <span className="font-medium text-text-muted">{label}</span>
      <select
        id={id}
        name={id}
        className="h-9 min-w-48 rounded-lg border border-border-default bg-bg-surface px-3 text-sm text-text-primary"
        value={value}
        onChange={(event) => onChange(event.target.value as TValue)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
