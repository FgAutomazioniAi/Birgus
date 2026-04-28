import { AlertCircle, CheckCircle2, Clock, FileText } from "lucide-react";

import { Badge } from "@/components/atoms";
import type { ProjectStatus } from "@/lib/types";

const STATUS_TONES: Record<ProjectStatus, "info" | "success" | "warn" | "progress"> = {
  "In Revisione": "info",
  Completato: "success",
  "In Attesa": "warn",
  "In Corso": "progress",
};

const STATUS_ICONS = {
  "In Revisione": FileText,
  Completato: CheckCircle2,
  "In Attesa": Clock,
  "In Corso": AlertCircle,
};

export interface StatusBadgeProps {
  status: ProjectStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const Icon = STATUS_ICONS[status];

  return (
    <Badge tone={STATUS_TONES[status]}>
      <Icon size={12} />
      {status}
    </Badge>
  );
}
