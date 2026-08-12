import { UserRound } from "lucide-react";

import { cn } from "@/lib/cn";

export interface UserChipProps {
  className?: string;
  initials?: string;
  name: string;
  role?: string;
}

export function UserChip({ className, name, role }: UserChipProps) {
  const normalizedRole = role?.trim();

  return (
    <div className={cn("flex items-center gap-3 rounded-full p-1 pl-1 pr-3 transition-colors hover:bg-bg-subtle", className)}>
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-primary text-xs font-bold text-text-inverse">
        <UserRound size={16} strokeWidth={2.2} />
      </div>
      <div className="hidden text-left sm:block">
        <div className="text-xs font-bold leading-none text-text-primary">{name}</div>
        {normalizedRole ? <div className="mt-1 text-[10px] leading-none text-text-muted">{normalizedRole}</div> : null}
      </div>
    </div>
  );
}
