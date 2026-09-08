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
  companyId?: number | null;
  companyName?: string;
  role?: string;
  department?: string;
  email: string;
  phone: string;
  mobile?: string;
  address?: string;
  city?: string;
  province?: string;
  country?: string;
  notes: string;
}

export interface Company {
  id: number;
  name: string;
  isHeadquarters: boolean;
  vatNumber: string;
  taxCode: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  postalCode: string;
  city: string;
  province: string;
  country: string;
  latitude: string;
  longitude: string;
  notes: string;
}
