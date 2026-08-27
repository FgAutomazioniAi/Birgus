import test from "node:test";
import assert from "node:assert/strict";

import { WorkflowRunExecutorService } from "../../src/modules/workflows/services/WorkflowRunExecutorService.js";
import { ScheduledWorkflowDeliveryService } from "../../src/modules/workflows/services/ScheduledWorkflowDeliveryService.js";

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

test("WorkflowRunExecutorService exposes agent results through a stable published output contract", () => {
  const service = new WorkflowRunExecutorService({
    documentArchiveService: {} as never,
    documentIntelligenceService: {} as never,
    quotationAnalyzer: {} as never,
    ddtAnalyzer: {} as never,
    measureReportAnalyzer: {} as never,
    pythonModulesClient: {} as never,
    runtimeAccessPolicy: {} as never,
  }) as unknown as {
    publishNodeOutput: (node: { node_key: string; node_kind: string; output_kind: string | null }, value: unknown) => Record<string, unknown>;
    collectPublishedOutputs: (items: Array<Record<string, unknown>>) => Array<{ key: string; label: string; kind: string; value: unknown }>;
    normalizeNodeOutput: (value: unknown) => Record<string, unknown>;
  };

  const agentOutput = service.publishNodeOutput(
    { node_key: "ai_chat", node_kind: "AGENT", output_kind: null },
    { output: { reply: "Le papere sanno nuotare." } },
  );
  const published = service.collectPublishedOutputs([agentOutput]);

  assert.deepEqual(published, [{
    key: "text",
    label: "Risposta IA",
    kind: "text",
    value: "Le papere sanno nuotare.",
    mimeType: null,
  }]);

  const normalized = service.normalizeNodeOutput(agentOutput);
  assert.deepEqual(service.collectPublishedOutputs([normalized]), published);
});

test("WorkflowRunExecutorService reports wrapped Telegram delivery as sent", () => {
  const service = new WorkflowRunExecutorService({
    documentArchiveService: {} as never,
    documentIntelligenceService: {} as never,
    quotationAnalyzer: {} as never,
    ddtAnalyzer: {} as never,
    measureReportAnalyzer: {} as never,
    pythonModulesClient: {} as never,
    runtimeAccessPolicy: {} as never,
  }) as unknown as {
    publishNodeOutput: (node: { node_key: string; node_kind: string; output_kind: string | null }, value: unknown) => Record<string, unknown>;
    collectPublishedOutputs: (items: Array<Record<string, unknown>>) => Array<{ key: string; label: string; kind: string; value: unknown }>;
  };

  const result = service.publishNodeOutput(
    { node_key: "send_telegram", node_kind: "TOOL", output_kind: null },
    { ok: true, module: "messaging_engine", action: "send_telegram", output: { status: "sent", chat_id: "148682114", provider: "telegram" } },
  );

  assert.deepEqual(service.collectPublishedOutputs([result]), [{
    key: "delivery_status",
    label: "Esito invio",
    kind: "delivery_status",
    value: { sent: true, status: "sent", recipient: "148682114", message: null },
    mimeType: null,
  }]);
});

test("WorkflowRunExecutorService maps field handles to the matching document inputs", () => {
  const service = new WorkflowRunExecutorService({
    documentArchiveService: {} as never,
    documentIntelligenceService: {} as never,
    quotationAnalyzer: {} as never,
    ddtAnalyzer: {} as never,
    measureReportAnalyzer: {} as never,
    pythonModulesClient: {} as never,
    runtimeAccessPolicy: {} as never,
  }) as unknown as {
    buildGenericDocumentInput: (
      nodeConfig: Record<string, unknown>,
      inputPayload: Record<string, unknown>,
      previousOutput: Record<string, unknown>,
      incoming: { byNodeKey: Record<string, Record<string, unknown>>; byTargetHandle: Record<string, Record<string, unknown>>; items: Array<Record<string, unknown>> },
    ) => Record<string, unknown>;
  };

  const input = service.buildGenericDocumentInput(
    { content: "contenuto manuale", title: "titolo manuale", file_name: "manuale.docx", format: "pdf" },
    {},
    {},
    {
      byNodeKey: {},
      byTargetHandle: {
        content: { reply: "contenuto collegato" },
        file_name: { text: "report-finale.pdf" },
      },
      items: [],
    },
  );

  assert.equal(input.content, "contenuto collegato");
  assert.equal(input.title, "titolo manuale");
  assert.equal(input.file_name, "report-finale.pdf");
  assert.equal(input.format, "pdf");
});

test("WorkflowRunExecutorService interprets browser schedule times in Europe/Rome", () => {
  const service = new WorkflowRunExecutorService({
    documentArchiveService: {} as never,
    documentIntelligenceService: {} as never,
    quotationAnalyzer: {} as never,
    ddtAnalyzer: {} as never,
    measureReportAnalyzer: {} as never,
    pythonModulesClient: {} as never,
    runtimeAccessPolicy: {} as never,
  }) as unknown as {
    parseScheduleDateTime: (value: string) => Date | null;
  };

  assert.equal(service.parseScheduleDateTime("2026-08-27T10:44")?.toISOString(), "2026-08-27T08:44:00.000Z");
});

test("ScheduledWorkflowDeliveryService rejects stale schedules and unsafe repeat intervals", () => {
  const service = new ScheduledWorkflowDeliveryService({} as never) as unknown as {
    validateScheduleTiming: (runAt: Date, repeatEverySeconds: number | null) => void;
  };

  assert.throws(
    () => service.validateScheduleTiming(new Date(Date.now() - 2 * 60_000), null),
    /gia' trascorso/,
  );
  assert.throws(
    () => service.validateScheduleTiming(new Date(Date.now() + 2 * 60_000), 30),
    /ripetizione minima/,
  );
  assert.doesNotThrow(() => service.validateScheduleTiming(new Date(Date.now() + 2 * 60_000), 3600));
});
