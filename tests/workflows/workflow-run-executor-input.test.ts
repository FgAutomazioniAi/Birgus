import test from "node:test";
import assert from "node:assert/strict";

import { WorkflowRunExecutorService } from "../../src/modules/workflows/services/WorkflowRunExecutorService.js";

test("WorkflowRunExecutorService passes connected text input to LangChain chat nodes", async () => {
  const service = new WorkflowRunExecutorService({
    documentArchiveService: {} as never,
    documentIntelligenceService: {} as never,
    quotationAnalyzer: {} as never,
    ddtAnalyzer: {} as never,
    measureReportAnalyzer: {} as never,
    pythonModulesClient: {} as never,
    runtimeAccessPolicy: {} as never,
  }) as unknown as {
    buildLangchainToolInput: (
      action: string,
      nodeConfig: Record<string, unknown>,
      inputPayload: Record<string, unknown>,
      previousOutput: Record<string, unknown>,
      incomingOutputs: { byNodeKey: Record<string, Record<string, unknown>>; items: Array<Record<string, unknown>> },
    ) => Promise<Record<string, unknown>>;
  };

  const input = await service.buildLangchainToolInput(
    "chat",
    { instructions: "Rispondi in italiano" },
    {},
    {},
    {
      byNodeKey: { input: { input_text: "raccontami una cosa sulle papere" } },
      items: [{ input_text: "raccontami una cosa sulle papere" }],
    },
  );

  assert.equal(input.input_text, "raccontami una cosa sulle papere");
  assert.equal(input.instructions, "Rispondi in italiano");
});
