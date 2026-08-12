import type { AiChatMessage } from "../domain/AiChatMessage.js";
import type { AiToolDefinition } from "../domain/AiToolDefinition.js";
import { OpenAiCompatibleLmClient } from "./OpenAiCompatibleLmClient.js";

interface ToolCallResponse {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string;
  };
}

export class OpenAiCompatibleToolChatClient {
  private readonly client: OpenAiCompatibleLmClient;

  public constructor(client?: OpenAiCompatibleLmClient) {
    this.client = client ?? new OpenAiCompatibleLmClient();
  }

  public async chatWithTools(params: {
    messages: AiChatMessage[];
    tools: AiToolDefinition[];
  }): Promise<{
    model: string;
    content: string | null;
    toolCalls: ToolCallResponse[];
    promptTokens: number | null;
    completionTokens: number | null;
    raw: Record<string, unknown>;
  }> {
    const result = await this.client.completeWithTools({
      messages: params.messages,
      tools: params.tools,
      toolChoice: "auto",
    });
    const usage = result.response.usage;

    return {
      model: result.model,
      content: result.content,
      toolCalls: this.normalizeToolCalls(result.toolCalls),
      promptTokens: typeof usage?.prompt_tokens === "number" ? usage.prompt_tokens : null,
      completionTokens: typeof usage?.completion_tokens === "number" ? usage.completion_tokens : null,
      raw: result.response as Record<string, unknown>,
    };
  }

  public async chat(params: {
    messages: AiChatMessage[];
  }): Promise<{
    model: string;
    content: string | null;
    promptTokens: number | null;
    completionTokens: number | null;
    raw: Record<string, unknown>;
  }> {
    const result = await this.client.completeWithTools({
      messages: params.messages,
      tools: [],
      toolChoice: "none",
    });
    const usage = result.response.usage;

    return {
      model: result.model,
      content: result.content,
      promptTokens: typeof usage?.prompt_tokens === "number" ? usage.prompt_tokens : null,
      completionTokens: typeof usage?.completion_tokens === "number" ? usage.completion_tokens : null,
      raw: result.response as Record<string, unknown>,
    };
  }

  private normalizeToolCalls(value: Array<Record<string, unknown>>): ToolCallResponse[] {
    const normalized: ToolCallResponse[] = [];
    for (const item of value) {
      const fn = item.function;
      if (!fn || typeof fn !== "object") {
        continue;
      }

      const functionPayload = fn as Record<string, unknown>;
      const id = typeof item.id === "string" ? item.id : "";
      const type = typeof item.type === "string" ? item.type : "function";
      const name = typeof functionPayload.name === "string" ? functionPayload.name : "";
      const args = typeof functionPayload.arguments === "string" ? functionPayload.arguments : "{}";
      if (!id || !name) {
        continue;
      }

      normalized.push({
        id,
        type,
        function: {
          name,
          arguments: args,
        },
      });
    }

    return normalized;
  }
}
