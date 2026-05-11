import { cn } from "@/lib/cn";

export interface BirgusLogoProps {
  className?: string;
}

export function BirgusLogo({ className = "h-14 w-14" }: BirgusLogoProps) {
  return (
    <img
      src="/fg_logo.png"
      alt="Logo FGautomazioni"
      className={cn("block object-contain object-left", className)}
    />
  );
}
