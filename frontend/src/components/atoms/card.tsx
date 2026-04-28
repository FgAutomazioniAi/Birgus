import * as React from "react";

import { cn } from "@/lib/cn";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-xl)] border border-border-default bg-bg-surface shadow-card",
        className,
      )}
      {...props}
    />
  );
}
