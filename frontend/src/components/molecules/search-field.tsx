import { Search } from "lucide-react";

import { Input } from "@/components/atoms";
import { cn } from "@/lib/cn";

export interface SearchFieldProps {
  className?: string;
  onChange?: (value: string) => void;
  placeholder: string;
  value?: string;
}

export function SearchField({ className, onChange, placeholder, value }: SearchFieldProps) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
      <Input
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        className="h-10 rounded-lg pl-10"
      />
    </div>
  );
}
