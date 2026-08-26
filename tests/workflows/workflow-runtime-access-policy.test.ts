import assert from "node:assert/strict";
import { test } from "node:test";

import { AppError } from "../../src/core/errors/AppError.js";
import { ModuleAccessPolicy } from "../../src/core/module-access/ModuleAccessPolicy.js";
import { WorkflowRuntimeAccessPolicy } from "../../src/modules/workflows/services/WorkflowRuntimeAccessPolicy.js";

test("WorkflowRuntimeAccessPolicy validates every module used by a user-triggered run", async () => {
  const checked: string[] = [];
  const modulePolicy = new ModuleAccessPolicy({
    isModuleEnabledForUser: async (_workspaceId, _userId, key) => {
      checked.push(key);
      return key !== "ddt_processing";
    },
    isModuleEnabledForWorkspace: async () => true,
  });
  const policy = new WorkflowRuntimeAccessPolicy(modulePolicy);

  await assert.rejects(
    policy.ensureRunAllowed({
      workspaceId: "workspace", requestedByUserId: "user", workflowModuleKey: "workflow_management",
      nodes: [{ nodeKey: "ocr", tool: { moduleKey: "ddt_processing", enabled: true, deleted: false } }],
    }),
    (error: unknown) => error instanceof AppError && error.code === "MODULE_DISABLED",
  );
  assert.deepEqual(checked, ["workflow_management", "ddt_processing"]);
});

test("WorkflowRuntimeAccessPolicy checks workspace state for system runs and rejects disabled resources", async () => {
  const workspaceChecks: string[] = [];
  const modulePolicy = new ModuleAccessPolicy({
    isModuleEnabledForUser: async () => true,
    isModuleEnabledForWorkspace: async (_workspaceId, key) => {
      workspaceChecks.push(key);
      return true;
    },
  });
  const policy = new WorkflowRuntimeAccessPolicy(modulePolicy);

  await policy.ensureRunAllowed({
    workspaceId: "workspace", requestedByUserId: null, workflowModuleKey: "workflow_management",
    nodes: [{ nodeKey: "search", tool: { moduleKey: "document_intelligence", enabled: true, deleted: false } }],
  });
  assert.deepEqual(workspaceChecks, ["workflow_management", "document_intelligence"]);

  await assert.rejects(
    policy.ensureRunAllowed({
      workspaceId: "workspace", requestedByUserId: null, workflowModuleKey: "workflow_management",
      nodes: [{ nodeKey: "disabled-tool", tool: { moduleKey: "document_intelligence", enabled: false, deleted: false } }],
    }),
    (error: unknown) => error instanceof AppError && error.code === "WORKFLOW_NODE_RESOURCE_DISABLED",
  );
});
