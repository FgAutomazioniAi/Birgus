import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/cn";

export interface NavItemProps {
  collapsed: boolean;
  icon: LucideIcon;
  isActive: boolean;
  label: string;
  onClick?: () => void;
  href: string;
}

export function NavItem({ collapsed, icon: Icon, isActive, label, onClick, href }: NavItemProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={cn(
        "flex items-center gap-3 rounded-[var(--radius-md)] px-4 py-3 text-sm font-medium transition-colors",
        isActive
          ? "bg-status-info-bg text-brand-primary"
          : "text-text-muted hover:bg-bg-subtle hover:text-text-primary",
        collapsed && "lg:justify-center",
      )}
    >
      <Icon size={20} className={cn(isActive ? "text-brand-accent" : "text-slate-400")} />
      {!collapsed && <span>{label}</span>}
    </Link>
  );
}
