import type { ReactNode } from "react";

import { Label } from "@/components/atoms";
import { cn } from "@/lib/cn";

export interface FormFieldProps {
  children: ReactNode;
  className?: string;
  error?: string;
  icon?: ReactNode;
  label: string;
}

export function FormField({ children, className, error, icon, label }: FormFieldProps) {
  return (
    <div className={className}>
      <Label className="mb-2 flex items-center gap-2 font-bold">
        {icon}
        {label}
      </Label>
      {children}
      {error ? <p className={cn("mt-1 text-xs font-medium text-status-danger-text")}>{error}</p> : null}
    </div>
  );
}
