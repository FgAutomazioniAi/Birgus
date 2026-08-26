"use client";

import { cn } from "@/lib/cn";
import { useTheme } from "@/components/organisms/theme-provider";

export interface BirgusLogoProps {
  className?: string;
}

export function BirgusLogo({ className = "h-14 w-14" }: BirgusLogoProps) {
  const { theme } = useTheme();

  return (
    <img
      src={theme === "dark" ? "/birgus-logo/cropped/black.png" : "/fg_logo.png"}
      alt="Logo Birgus"
      className={cn("block object-contain object-left", className)}
    />
  );
}
