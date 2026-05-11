import type { ProjectStatusKey } from "@/lib/project-status";

export type ProjectStatus = ProjectStatusKey;

export interface Project {
  id: string;
  project: string;
  date: string;
  versionsCount: number;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  notes: string;
}

export interface ShipmentListItem {
  id: string;
  code: string;
  projectId: string;
  projectName: string;
  projectVersionId: number;
  projectVersionLabel: string;
  clientId: string | null;
  clientName: string | null;
  statusKey: string;
  specificationUpdatedAt?: string | null;
  createdAt: string;
}
