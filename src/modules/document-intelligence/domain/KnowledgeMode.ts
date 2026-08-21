export type KnowledgeMode = "on_demand" | "saved" | "hybrid";

export const DEFAULT_KNOWLEDGE_MODE: KnowledgeMode = "on_demand";

export function normalizeKnowledgeMode(value: unknown, fallback: KnowledgeMode = DEFAULT_KNOWLEDGE_MODE): KnowledgeMode {
  if (value === "on_demand" || value === "saved" || value === "hybrid") {
    return value;
  }
  return fallback;
}
