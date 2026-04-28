import { PROJECT_STATUSES } from "@/lib/project-status";

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

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
