const OPERATIONAL_PLANNING_MODULE_KEYS = [
  "offer_priority",
  "maintenance_proposals",
  "maintenance_calendar",
] as const;

const groups = [OPERATIONAL_PLANNING_MODULE_KEYS] as const;

export function activationGroupFor(moduleKey: string): readonly string[] {
  return groups.find((group) => group.includes(moduleKey as never)) ?? [moduleKey];
}

export function isGroupedActivation(moduleKey: string): boolean {
  return activationGroupFor(moduleKey).length > 1;
}
