export const PROJECT_STATUS_OPTIONS = [
  { key: "in_revisione", label: "In Revisione" },
  { key: "completato", label: "Completato" },
  { key: "in_attesa", label: "In Attesa" },
] as const;

export type ProjectStatusKey = (typeof PROJECT_STATUS_OPTIONS)[number]["key"];

export const PROJECT_STATUS_LABEL_BY_KEY: Record<ProjectStatusKey, string> = PROJECT_STATUS_OPTIONS.reduce(
  (acc, item) => {
    acc[item.key] = item.label;
    return acc;
  },
  {} as Record<ProjectStatusKey, string>,
);

export const getProjectStatusLabel = (key: string): string => {
  if (key in PROJECT_STATUS_LABEL_BY_KEY) {
    return PROJECT_STATUS_LABEL_BY_KEY[key as ProjectStatusKey];
  }

  return key;
};
