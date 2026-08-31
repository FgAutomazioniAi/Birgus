import { PrismaClient, WorkflowToolRuntimeKind } from "@prisma/client";

const prisma = new PrismaClient();

const tools = [
  {
    key: "langchain_compose_email",
    name: "langchain_compose_email",
    label: "Formatta email",
    description: "Prepara oggetto e corpo email senza invio, con tono professionale, formale o informale.",
    runtimeKind: WorkflowToolRuntimeKind.PYTHON_MODULE,
    handlerKey: "langchain_orchestrator.compose_email",
    configuration: { module: "langchain_orchestrator", action: "compose_email", tone: "professionale" },
  },
  {
    key: "langchain_format_text",
    name: "langchain_format_text",
    label: "Formatta con AI",
    description: "Applica un template documento al contenuto usando il motore AI.",
    runtimeKind: WorkflowToolRuntimeKind.PYTHON_MODULE,
    handlerKey: "langchain_orchestrator.format_text",
    configuration: { module: "langchain_orchestrator", action: "format_text", content: "", template: "" },
  },
  {
    key: "workflow_format_template",
    name: "workflow_format_template",
    label: "Applica template",
    description: "Formatta testo in modo deterministico sostituendo i placeholder del template documento.",
    runtimeKind: WorkflowToolRuntimeKind.BACKEND,
    handlerKey: "workflow_text.format_template",
    configuration: { content: "", template: "" },
  },
  {
    key: "workflow_verify_and_route",
    name: "workflow_verify_and_route",
    label: "Verifica e instrada",
    description: "Valuta regole deterministiche sui dati del workflow senza usare AI.",
    runtimeKind: WorkflowToolRuntimeKind.BACKEND,
    handlerKey: "workflow_logic.verify_and_route",
    configuration: { rules: [] },
  },
  {
    key: "workflow_request_decision",
    name: "workflow_request_decision",
    label: "Richiedi decisione",
    description: "Sospende il workflow e lo riprende solo dopo una decisione umana esplicita.",
    runtimeKind: WorkflowToolRuntimeKind.BACKEND,
    handlerKey: "workflow_attention.request_decision",
    configuration: { priority: "normal" },
  },
] as const;

async function main(): Promise<void> {
  const configuredKeys = (process.env.WORKFLOW_STANDARD_TOOL_KEYS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const selectedKeys = configuredKeys.length > 0 ? new Set(configuredKeys) : new Set(tools.map((tool) => tool.key));
  const unknownKeys = [...selectedKeys].filter((key) => !tools.some((tool) => tool.key === key));
  if (unknownKeys.length > 0) throw new Error(`Unknown WORKFLOW_STANDARD_TOOL_KEYS: ${unknownKeys.join(", ")}`);
  const module = await prisma.module.findUnique({ where: { key: "workflow_management" }, select: { id: true } });
  if (!module) throw new Error("Modulo workflow_management non trovato. Eseguire il bootstrap iniziale una sola volta.");
  const workspaces = await prisma.workspaceModule.findMany({ where: { module_id: module.id }, select: { workspace_id: true } });
  for (const workspace of workspaces) {
    await prisma.moduleTool.updateMany({
      where: { workspace_id: workspace.workspace_id, module_id: module.id, key: "workflow_human_review" },
      data: { is_enabled: false, deleted_at: new Date() },
    });
    for (const tool of tools) {
      const isEnabled = selectedKeys.has(tool.key);
      await prisma.moduleTool.upsert({
        where: { workspace_id_module_id_key: { workspace_id: workspace.workspace_id, module_id: module.id, key: tool.key } },
        update: { name: tool.name, label: tool.label, description: tool.description, runtime_kind: tool.runtimeKind, handler_key: tool.handlerKey, configuration: tool.configuration, is_enabled: isEnabled, deleted_at: null },
        create: { workspace_id: workspace.workspace_id, module_id: module.id, key: tool.key, name: tool.name, label: tool.label, description: tool.description, runtime_kind: tool.runtimeKind, handler_key: tool.handlerKey, configuration: tool.configuration, is_enabled: isEnabled },
      });
    }
  }
  console.log(`Workflow tools synchronized for ${workspaces.length} workspace(s).`);
}

main().finally(async () => prisma.$disconnect());
