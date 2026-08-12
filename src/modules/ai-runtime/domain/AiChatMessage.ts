export type AiChatRole = "system" | "user" | "assistant" | "tool";

export interface AiChatMessage {
  role: AiChatRole;
  content: string | null | Array<Record<string, unknown>>;
  tool_call_id?: string;
  tool_calls?: Array<Record<string, unknown>>;
}
