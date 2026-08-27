import * as React from "react";

import { cn } from "@/lib/cn";

type BadgeTone = "info" | "success" | "warn" | "progress" | "danger";

const toneClasses: Record<BadgeTone, string> = {
  info: "bg-status-info-bg text-status-info-text ring-1 ring-status-info-text/20",
  success: "bg-status-success-bg text-status-success-text ring-1 ring-status-success-text/20",
  warn: "bg-status-warn-bg text-status-warn-text ring-1 ring-status-warn-text/20",
  progress: "bg-status-progress-bg text-status-progress-text ring-1 ring-status-progress-text/20",
  danger: "bg-status-danger-bg text-status-danger-text ring-1 ring-status-danger-text/20",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: BadgeTone;
}

export function Badge({ className, tone = "info", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold",
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}
