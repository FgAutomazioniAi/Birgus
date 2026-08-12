import { Controller, Get } from "@nestjs/common";

import { AiGatewayService } from "../../modules/ai-runtime/services/AiGatewayService.js";

@Controller()
export class HealthController {
  public constructor(private readonly aiGatewayService: AiGatewayService) {}

  @Get("/health")
  public getHealth(): { ok: true; timestamp: string } {
    return {
      ok: true,
      timestamp: new Date().toISOString(),
    };
  }

  @Get("/health/ai-provider")
  public async getAiProviderHealth(): Promise<{
    ok: boolean;
    provider: "openai-compatible";
    model: string | null;
    error: string | null;
    timestamp: string;
  }> {
    const health = await this.aiGatewayService.health();
    return {
      provider: "openai-compatible",
      ...health,
      timestamp: new Date().toISOString(),
    };
  }
}
