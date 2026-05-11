import { z } from "zod";

export interface AssistantToolExecutionContext {
  workspaceId: string;
  userId: string;
  sessionId: string;
}

export interface AssistantToolDefinition<TArgs extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  description: string;
  moduleKeys: string[];
  permissionKeys: string[];
  parametersSchema: TArgs;
  parametersJsonSchema: Record<string, unknown>;
  execute(context: AssistantToolExecutionContext, args: z.infer<TArgs>): Promise<Record<string, unknown>>;
}
