import { AlertCircle, CheckCircle2, Clock, FileText } from "lucide-react";

import { Badge } from "@/components/atoms";
import { getProjectStatusLabel } from "@/lib/project-status";
import type { ProjectStatus } from "@/lib/types";

const STATUS_TONES: Record<ProjectStatus, "info" | "success" | "warn" | "progress"> = {
  in_revisione: "info",
  completato: "success",
  in_attesa: "warn",
};

const STATUS_ICONS: Record<ProjectStatus, typeof FileText> = {
  in_revisione: FileText,
  completato: CheckCircle2,
  in_attesa: Clock,
};

export interface StatusBadgeProps {
  status: ProjectStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const Icon = STATUS_ICONS[status] ?? AlertCircle;

  return (
    <Badge tone={STATUS_TONES[status]}>
      <Icon size={12} />
      {getProjectStatusLabel(status)}
    </Badge>
  );
}
