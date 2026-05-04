import { NextRequest, NextResponse } from "next/server";

import { NextLmOrchestrator } from "@/lib/orchestrator/NextLmOrchestrator";
import { PythonModulesClient } from "@/lib/orchestrator/PythonModulesClient";
import { ModuleActionExecuteRequest, OrchestratorExecuteRequest, WorkflowExecuteRequest } from "@/lib/orchestrator/types";

export const runtime = "nodejs";

type ErrorPayload = {
  code: string;
  message: string;
};

const orchestrator = new NextLmOrchestrator();
const modulesClient = new PythonModulesClient();

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authError = enforceInternalToken(request);
  if (authError) {
    return NextResponse.json(authError, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as OrchestratorExecuteRequest | null;
  if (!payload || typeof payload !== "object") {
    return NextResponse.json<ErrorPayload>({ code: "INVALID_JSON", message: "Payload JSON non valido." }, { status: 400 });
  }

  try {
    if (payload.kind === "module_action") {
      return await executeModuleAction(payload);
    }

    if (payload.kind === "workflow") {
      return await executeWorkflow(payload);
    }

    return NextResponse.json<ErrorPayload>({ code: "UNSUPPORTED_KIND", message: "Kind non supportato." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore interno orchestrator.";
    return NextResponse.json<ErrorPayload>({ code: "ORCHESTRATOR_ERROR", message }, { status: 500 });
  }
}

function enforceInternalToken(request: NextRequest): ErrorPayload | null {
  const expected = (process.env.ORCHESTRATOR_INTERNAL_TOKEN ?? "").trim();
  if (!expected) {
    return null;
  }

  const received = (request.headers.get("x-orchestrator-token") ?? "").trim();
  if (received !== expected) {
    return { code: "UNAUTHORIZED", message: "Token orchestrator non valido." };
  }

  return null;
}

async function executeModuleAction(payload: ModuleActionExecuteRequest): Promise<NextResponse> {
  if (!payload.module?.trim() || !payload.action?.trim()) {
    return NextResponse.json<ErrorPayload>(
      { code: "MODULE_ACTION_INVALID", message: "module/action obbligatori per module_action." },
      { status: 400 },
    );
  }

  const result = await modulesClient.execute(payload.module.trim(), payload.action.trim(), payload.input ?? {});
  return NextResponse.json(result, { status: 200 });
}

async function executeWorkflow(payload: WorkflowExecuteRequest): Promise<NextResponse> {
  if (payload.workflow !== "ddt_analysis_from_storage") {
    return NextResponse.json<ErrorPayload>(
      { code: "WORKFLOW_UNSUPPORTED", message: `Workflow non supportato: ${payload.workflow}` },
      { status: 400 },
    );
  }

  const storagePath = payload.input?.storagePath?.trim();
  const fileName = payload.input?.fileName?.trim() || "document.pdf";
  if (!storagePath) {
    return NextResponse.json<ErrorPayload>(
      { code: "WORKFLOW_INPUT_INVALID", message: "input.storagePath obbligatorio." },
      { status: 400 },
    );
  }

  const result = await orchestrator.analyzeFromStorage({
    storagePath,
    fileName,
    maxPages: payload.input.maxPages,
  });

  return NextResponse.json(result, { status: 200 });
}
