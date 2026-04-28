import * as React from "react";

import { cn } from "@/lib/cn";

type TextVariant = "h1" | "h2" | "body" | "muted" | "caption";

const variantClasses: Record<TextVariant, string> = {
  h1: "text-2xl font-bold text-text-primary",
  h2: "text-xl font-bold text-text-primary",
  body: "text-sm font-medium text-text-secondary",
  muted: "text-sm text-text-muted",
  caption: "text-xs text-text-muted",
};

export interface TextProps extends React.HTMLAttributes<HTMLElement> {
  as?: "h1" | "h2" | "h3" | "h4" | "p" | "span";
  variant?: TextVariant;
}

export function Text({ as: Tag = "p", className, variant = "body", ...props }: TextProps) {
  return <Tag className={cn(variantClasses[variant], className)} {...props} />;
}
