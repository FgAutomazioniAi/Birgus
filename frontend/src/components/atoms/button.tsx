import * as React from "react";

import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "accent" | "ghost" | "outline" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-primary text-text-inverse hover:bg-brand-primary-hover shadow-brand",
  accent:
    "bg-brand-accent text-text-inverse hover:bg-brand-accent-hover shadow-accent",
  ghost: "bg-transparent text-text-secondary hover:bg-bg-subtle",
  outline: "border border-border-default bg-bg-page text-text-secondary hover:bg-bg-subtle",
  danger:
    "bg-status-danger-text text-text-inverse hover:bg-red-700 shadow-[0_10px_24px_rgba(220,38,38,0.25)]",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-sm",
  lg: "h-12 px-6 text-sm",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] font-bold transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary",
        "disabled:pointer-events-none disabled:opacity-50",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  ),
);

Button.displayName = "Button";
