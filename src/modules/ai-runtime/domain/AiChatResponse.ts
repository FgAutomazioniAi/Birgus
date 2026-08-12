export interface AiChatCompletionChoice {
  message?: {
    role?: string;
    content?: string | null;
    tool_calls?: Array<Record<string, unknown>>;
  };
  finish_reason?: string | null;
}

export interface AiChatCompletionsResponse {
  id?: string;
  object?: string;
  model?: string;
  choices?: AiChatCompletionChoice[];
  usage?: Record<string, unknown>;
  stats?: Record<string, unknown>;
}

export interface AiModelItem {
  id: string;
  type: string;
}
