"use client";

import { ClipboardList } from "lucide-react";

import { Text } from "@/components/atoms";

import { DataCollectionChecklistPanel } from "./data-collection-checklist-panel";

export function QuotationPlanningPanel() {
  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <ClipboardList className="h-6 w-6 text-brand-primary" />
        <div>
          <Text as="h1" variant="h1">
            Checklist raccolta dati
          </Text>
          <Text variant="muted" className="mt-1">
            Checklist collegate alle commesse.
          </Text>
        </div>
      </header>
      <DataCollectionChecklistPanel compact />
    </div>
  );
}
