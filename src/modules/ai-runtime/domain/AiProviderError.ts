export type AiProviderErrorCode =
  | "AI_PROVIDER_NETWORK_UNREACHABLE"
  | "AI_PROVIDER_TIMEOUT"
  | "AI_PROVIDER_UNAUTHORIZED"
  | "AI_PROVIDER_FORBIDDEN"
  | "AI_PROVIDER_ENDPOINT_NOT_FOUND"
  | "AI_PROVIDER_HTTP_ERROR"
  | "AI_PROVIDER_INVALID_RESPONSE";

export class AiProviderError extends Error {
  public constructor(
    public readonly code: AiProviderErrorCode,
    public readonly statusCode: number | null = null,
  ) {
    super(code);
    this.name = "AiProviderError";
  }
}
