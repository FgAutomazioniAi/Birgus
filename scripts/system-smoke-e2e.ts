import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { PrismaClient } from "@prisma/client";

import { WorkflowGraphPlanner } from "../src/modules/workflows/services/WorkflowGraphPlanner.js";

const backendUrl = process.env.BIRGUS_BACKEND_URL?.trim() || "http://localhost:3000";
const frontendUrl = process.env.BIRGUS_FRONTEND_URL?.trim() || "http://localhost:3100";

async function main(): Promise<void> {
  const [healthResponse, loginResponse, protectedResponse, connectedAppsResponse] = await Promise.all([
    fetch(`${backendUrl}/health`),
    fetch(`${frontendUrl}/login`, { redirect: "manual" }),
    fetch(`${backendUrl}/api/workflows`, { redirect: "manual" }),
    fetch(`${backendUrl}/api/connected-apps`, { redirect: "manual" }),
  ]);
  const health = await healthResponse.json().catch(() => null) as { ok?: boolean } | null;

  assert(healthResponse.ok && health?.ok === true, "Backend health endpoint is unavailable.");
  assert(loginResponse.ok, "Frontend login page is unavailable.");
  assert(protectedResponse.status === 401, "Workflow endpoint must reject unauthenticated access.");
  assert(connectedAppsResponse.status === 401, "Connected apps endpoint must reject unauthenticated access.");

  const databaseUrl = process.env.BIRGUS_DATABASE_URL?.trim()
    || process.env.DATABASE_URL?.trim()
    || readDatabaseUrlFromEnv();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL non disponibile per la verifica dei workflow. Impostare BIRGUS_DATABASE_URL per eseguire il test dall'host.");
  }

  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    const workflows = await prisma.moduleWorkflow.findMany({
      where: { deleted_at: null, is_enabled: true },
      include: {
        module: { select: { key: true } },
        nodes: {
          include: {
            module_tool: { select: { handler_key: true, is_enabled: true } },
            module_agent: { select: { is_enabled: true } },
          },
        },
        edges: true,
      },
      orderBy: { key: "asc" },
    });

    assert(workflows.length > 0, "Nessun workflow attivo trovato.");
    const planner = new WorkflowGraphPlanner();
    const summaries = workflows.map((workflow) => {
      assert(workflow.nodes.length > 0, `Workflow '${workflow.key}' senza nodi.`);
      assertNoDuplicateNodeKeys(workflow.key, workflow.nodes.map((node) => node.node_key));
      assertNoDanglingEdges(workflow.key, workflow.nodes.map((node) => node.id), workflow.edges);
      assertNoCycle(workflow.key, workflow.nodes, workflow.edges);
      assertWorkflowHandleContracts(workflow.key, workflow.nodes, workflow.edges);

      for (const node of workflow.nodes) {
        if (node.node_kind === "TOOL") {
          assert(node.module_tool?.is_enabled && node.module_tool.handler_key.trim(), `Tool non configurato in '${workflow.key}:${node.node_key}'.`);
        }
        if (node.node_kind === "AGENT") {
          assert(node.module_agent?.is_enabled, `Agent non configurato in '${workflow.key}:${node.node_key}'.`);
        }
      }

      const order = planner.buildExecutionOrder(workflow.nodes, workflow.edges, () => true);
      assert(order.length > 0, `Workflow '${workflow.key}' senza piano di esecuzione.`);
      return `${workflow.module.key}/${workflow.key}: ${order.length} nodi`;
    });

    console.log("System smoke e2e passed.");
    for (const summary of summaries) {
      console.log(`- ${summary}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

function readDatabaseUrlFromEnv(): string | null {
  try {
    const source = readFileSync(resolve(process.cwd(), ".env"), "utf8");
    const line = source.split(/\r?\n/).find((item) => item.startsWith("DATABASE_URL="));
    if (!line) {
      return null;
    }
    return line.slice("DATABASE_URL=".length).trim().replace(/^['"]|['"]$/g, "") || null;
  } catch {
    return null;
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertNoDuplicateNodeKeys(workflowKey: string, keys: string[]): void {
  assert(new Set(keys).size === keys.length, `Workflow '${workflowKey}' contiene node_key duplicati.`);
}

function assertNoDanglingEdges(
  workflowKey: string,
  nodeIds: string[],
  edges: Array<{ source_node_id: string; target_node_id: string }>,
): void {
  const validIds = new Set(nodeIds);
  for (const edge of edges) {
    assert(validIds.has(edge.source_node_id) && validIds.has(edge.target_node_id), `Workflow '${workflowKey}' contiene un collegamento non valido.`);
  }
}

function assertNoCycle(
  workflowKey: string,
  nodes: Array<{ id: string; is_enabled: boolean; is_required: boolean }>,
  edges: Array<{ source_node_id: string; target_node_id: string; is_enabled: boolean }>,
): void {
  const activeIds = new Set(nodes.filter((node) => node.is_enabled || node.is_required).map((node) => node.id));
  const outgoing = new Map<string, string[]>();
  for (const id of activeIds) {
    outgoing.set(id, []);
  }
  for (const edge of edges) {
    if (edge.is_enabled && activeIds.has(edge.source_node_id) && activeIds.has(edge.target_node_id)) {
      outgoing.get(edge.source_node_id)?.push(edge.target_node_id);
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (nodeId: string): void => {
    assert(!visiting.has(nodeId), `Workflow '${workflowKey}' contiene un ciclo.`);
    if (visited.has(nodeId)) {
      return;
    }
    visiting.add(nodeId);
    for (const targetId of outgoing.get(nodeId) ?? []) {
      visit(targetId);
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
  };
  for (const nodeId of activeIds) {
    visit(nodeId);
  }
}

function assertWorkflowHandleContracts(
  workflowKey: string,
  nodes: Array<{
    id: string;
    configuration: unknown;
    module_tool: { handler_key: string } | null;
  }>,
  edges: Array<{ source_node_id: string; target_node_id: string; source_handle: string | null; target_handle: string | null }>,
): void {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  for (const edge of edges) {
    const source = nodesById.get(edge.source_node_id);
    const target = nodesById.get(edge.target_node_id);
    const isVerifySource = source?.module_tool?.handler_key === "workflow_logic.verify_and_route";
    const isVerifyTarget = target?.module_tool?.handler_key === "workflow_logic.verify_and_route";

    if (edge.source_handle === "valid" || edge.source_handle === "invalid") {
      assert(isVerifySource, `Workflow '${workflowKey}' usa l'uscita ${edge.source_handle} da un nodo che non e Verifica e instrada.`);
    }
    if (isVerifySource) {
      assert(
        edge.source_handle === "valid" || edge.source_handle === "invalid",
        `Workflow '${workflowKey}' ha un collegamento di Verifica e instrada senza un'uscita V/F esplicita.`,
      );
    }

    if (!edge.target_handle?.startsWith("field:rule_")) {
      continue;
    }
    assert(isVerifyTarget, `Workflow '${workflowKey}' collega una regola a un nodo che non e Verifica e instrada.`);
    const index = Number(edge.target_handle.slice("field:rule_".length));
    const configuration = target?.configuration && typeof target.configuration === "object" && !Array.isArray(target.configuration)
      ? target.configuration as Record<string, unknown>
      : {};
    const rules = Array.isArray(configuration.rules) ? configuration.rules : [];
    assert(Number.isInteger(index) && index >= 0 && index < rules.length, `Workflow '${workflowKey}' collega una regola non piu presente nel nodo Verifica e instrada.`);
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
