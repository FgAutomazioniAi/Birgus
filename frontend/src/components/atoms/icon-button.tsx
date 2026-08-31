import * as React from "react";

import { cn } from "@/lib/cn";

export type IconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] text-text-secondary transition-colors",
        "hover:bg-bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary",
        className,
      )}
      {...props}
    />
  ),
);

IconButton.displayName = "IconButton";
