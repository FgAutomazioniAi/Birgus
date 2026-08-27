import * as React from "react";

import { cn } from "@/lib/cn";

export interface SwitchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: React.ReactNode;
  labelClassName?: string;
}

export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, id, label, labelClassName, ...props }, ref) => (
    <label
      className={cn(
        "inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-text-secondary",
        props.disabled && "cursor-not-allowed opacity-60",
        labelClassName,
      )}
      htmlFor={id}
    >
      <input ref={ref} id={id} type="checkbox" role="switch" className={cn("peer sr-only", className)} {...props} />
      <span className="relative h-5 w-9 shrink-0 rounded-full border border-border-default bg-bg-page transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow-sm after:transition-transform after:content-[''] peer-checked:border-brand-primary peer-checked:bg-brand-primary peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-ring-primary" />
      <span>{label}</span>
    </label>
  ),
);

Switch.displayName = "Switch";
