import { OpenAiCompatibleLmClient } from "./OpenAiCompatibleLmClient.js";

export class AiGatewayService {
  private readonly client: OpenAiCompatibleLmClient;

  public constructor(client?: OpenAiCompatibleLmClient) {
    this.client = client ?? new OpenAiCompatibleLmClient();
  }

  public async health(): Promise<{ ok: boolean; model: string | null; error: string | null }> {
    try {
      return {
        ok: true,
        model: await this.client.selectModel(),
        error: null,
      };
    } catch (error) {
      return {
        ok: false,
        model: null,
        error: error instanceof Error ? error.message : "AI provider health check failed",
      };
    }
  }
}
