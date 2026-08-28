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

test("WorkflowRunExecutorService gives connected formatter inputs precedence over stale manual values", async () => {
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
      incomingOutputs: { byNodeKey: Record<string, Record<string, unknown>>; byTargetHandle: Record<string, Record<string, unknown>>; items: Array<Record<string, unknown>> },
    ) => Promise<Record<string, unknown>>;
  };

  const input = await service.buildLangchainToolInput(
    "format_text",
    { content: "contenuto precedente", template: "template precedente" },
    {},
    {},
    {
      byNodeKey: {},
      byTargetHandle: {
        content: { text: "contenuto collegato" },
        template: { text: "Titolo\n{{content}}" },
      },
      items: [],
    },
  );

  assert.equal(input.content, "contenuto collegato");
  assert.equal(input.template, "Titolo\n{{content}}");
});

test("WorkflowRunExecutorService formats templates from connected fields and rejects missing content", () => {
  const service = new WorkflowRunExecutorService({
    documentArchiveService: {} as never,
    documentIntelligenceService: {} as never,
    quotationAnalyzer: {} as never,
    ddtAnalyzer: {} as never,
    measureReportAnalyzer: {} as never,
    pythonModulesClient: {} as never,
    runtimeAccessPolicy: {} as never,
  }) as unknown as {
    executeTemplateFormattingTool: (context: unknown, node: unknown) => Record<string, unknown>;
  };
  const context = {
    inputPayload: {},
    nodeOutputs: new Map([
      ["content", { text: "contenuto collegato" }],
      ["template", { text: "Oggetto\n{{content}}" }],
    ]),
    incomingNodeKeys: new Map([["formatter", ["content", "template"]]]),
    incomingFieldSourceKeys: new Map([["formatter", new Map([["content", ["content"]], ["template", ["template"]]])]]),
  };

  const result = service.executeTemplateFormattingTool(context, {
    node_key: "formatter",
    configuration: { content: "contenuto precedente", template: "{{content}}" },
  });
  assert.equal(result.formatted_text, "Oggetto\ncontenuto collegato");

  assert.throws(
    () => service.executeTemplateFormattingTool({ ...context, nodeOutputs: new Map(), incomingFieldSourceKeys: new Map() }, { node_key: "formatter", configuration: { template: "{{content}}" } }),
    /Contenuto mancante/,
  );
});

test("WorkflowRunExecutorService routes verify-and-route branches exclusively by V/F output", () => {
  const service = new WorkflowRunExecutorService({
    documentArchiveService: {} as never,
    documentIntelligenceService: {} as never,
    quotationAnalyzer: {} as never,
    ddtAnalyzer: {} as never,
    measureReportAnalyzer: {} as never,
    pythonModulesClient: {} as never,
    runtimeAccessPolicy: {} as never,
  }) as unknown as {
    executeVerifyAndRouteTool: (context: unknown, node: unknown) => Record<string, unknown>;
    shouldExecuteNode: (nodeId: string, edges: Array<Record<string, unknown>>, context: unknown) => boolean;
  };
  const verifier = { id: "verify-id", node_key: "verify", module_tool: { handler_key: "workflow_logic.verify_and_route" } };
  const context = {
    inputPayload: {},
    nodeOutputs: new Map([["amount", { text: "150" }]]),
    incomingNodeKeys: new Map([["verify", ["amount"]]]),
    incomingFieldSourceKeys: new Map([["verify", new Map([["rule_0", ["amount"]]])]]),
    workflowNodesByKey: new Map([["verify", verifier]]),
  };
  const result = service.executeVerifyAndRouteTool(context, { node_key: "verify", configuration: { rules: [{ operator: "greater_than", value: "100" }] } });
  assert.equal(result.valid, true);

  context.nodeOutputs.set("verify", result);
  const edges = [
    { source_node_id: "verify-id", target_node_id: "on-valid", source_handle: "valid", condition_payload: null, is_enabled: true },
    { source_node_id: "verify-id", target_node_id: "on-invalid", source_handle: "invalid", condition_payload: null, is_enabled: true },
  ];
  assert.equal(service.shouldExecuteNode("on-valid", edges, context), true);
  assert.equal(service.shouldExecuteNode("on-invalid", edges, context), false);
});

test("WorkflowRunExecutorService creates a decision request with the workflow context and pauses the node", async () => {
  const requests: Array<Record<string, unknown>> = [];
  const service = new WorkflowRunExecutorService({
    documentArchiveService: {} as never,
    documentIntelligenceService: {} as never,
    quotationAnalyzer: {} as never,
    ddtAnalyzer: {} as never,
    measureReportAnalyzer: {} as never,
    pythonModulesClient: {} as never,
    runtimeAccessPolicy: {} as never,
    humanInterventionService: {
      createDecisionRequest: async (request: Record<string, unknown>) => {
        requests.push(request);
        return { id: "intervention-1" };
      },
    } as never,
  }) as unknown as {
    executeDecisionRequestTool: (context: unknown, node: unknown) => Promise<never>;
  };
  const context = {
    workspaceId: "workspace-1",
    runId: "run-1",
    userId: "user-1",
    inputPayload: {},
    nodeOutputs: new Map([["verify", { status: "attention_required", valid: false }]]),
    incomingNodeKeys: new Map([["decision", ["verify"]]]),
    incomingFieldSourceKeys: new Map(),
  };

  await assert.rejects(
    () => service.executeDecisionRequestTool(context, {
      id: "decision-node-1",
      node_key: "decision",
      configuration: { title: "Controlla invio", message: "Destinatario mancante", priority: "high", assigneeUserId: "user-2" },
    }),
    /attesa di una decisione/,
  );
  assert.deepEqual(requests, [{
    workspaceId: "workspace-1",
    workflowRunId: "run-1",
    workflowNodeId: "decision-node-1",
    createdByUserId: "user-1",
    assignedUserId: "user-2",
    title: "Controlla invio",
    message: "Destinatario mancante",
    priority: "high",
    input: { latest: { status: "attention_required", valid: false }, incoming: { verify: { status: "attention_required", valid: false } } },
  }]);
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
