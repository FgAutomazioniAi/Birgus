import * as React from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/cn";

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: React.ReactNode;
  labelClassName?: string;
}

export const CheckboxControl = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, id, ...props }, ref) => (
    <>
      <input ref={ref} id={id} type="checkbox" className={cn("peer sr-only", className)} {...props} />
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-border-default bg-bg-page text-transparent transition-colors peer-checked:border-brand-primary peer-checked:bg-brand-primary peer-checked:text-text-inverse peer-focus-visible:ring-2 peer-focus-visible:ring-ring-primary peer-disabled:cursor-not-allowed" aria-hidden="true">
        <Check className="h-3 w-3" strokeWidth={3} />
      </span>
    </>
  ),
);

CheckboxControl.displayName = "CheckboxControl";

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, id, label, labelClassName, ...props }, ref) => (
    <label
      className={cn(
        "inline-flex cursor-pointer items-center gap-2 text-sm text-text-secondary",
        props.disabled && "cursor-not-allowed opacity-60",
        labelClassName,
      )}
      htmlFor={id}
    >
      <CheckboxControl ref={ref} id={id} className={className} {...props} />
      <span>{label}</span>
    </label>
  ),
);

Checkbox.displayName = "Checkbox";
