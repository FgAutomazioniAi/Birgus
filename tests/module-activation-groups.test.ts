import assert from "node:assert/strict";
import test from "node:test";

import { ModuleManagementService } from "../src/modules/module-management/services/ModuleManagementService.js";
import { ModuleAccessRepository } from "../src/modules/module-management/repositories/ModuleAccessRepository.js";

function repositoryStub(overrides: Partial<ModuleAccessRepository> = {}): ModuleAccessRepository {
  return {
    isModuleEnabledForUser: async () => false,
    isModuleEnabledForWorkspace: async () => false,
    listWorkspaceModules: async () => [],
    listUserModules: async () => [],
    setWorkspaceModule: async () => {},
    setUserModuleOverride: async () => {},
    clearUserModuleOverride: async () => {},
    listMissingDependenciesForEnable: async () => [],
    listEnabledDependents: async () => [],
    isModuleEnabledInAnyActiveWorkspace: async () => false,
    ...overrides,
  };
}

test("enabling one planning module enables the complete planning group", async () => {
  const changes: Array<{ moduleKey: string; enabled: boolean }> = [];
  const service = new ModuleManagementService(repositoryStub({
    setWorkspaceModule: async (_workspaceId, moduleKey, enabled) => { changes.push({ moduleKey, enabled }); },
  }));

  await service.enableModule("workspace", "maintenance_calendar", "admin");

  assert.deepEqual(
    changes.sort((left, right) => left.moduleKey.localeCompare(right.moduleKey)),
    [
      { moduleKey: "maintenance_calendar", enabled: true },
      { moduleKey: "maintenance_proposals", enabled: true },
      { moduleKey: "offer_priority", enabled: true },
    ],
  );
});

test("disabling one planning module disables the complete planning group", async () => {
  const changes: Array<{ moduleKey: string; enabled: boolean }> = [];
  const service = new ModuleManagementService(repositoryStub({
    setWorkspaceModule: async (_workspaceId, moduleKey, enabled) => { changes.push({ moduleKey, enabled }); },
  }));

  await service.disableModule("workspace", "offer_priority", "admin");

  assert.equal(changes.length, 3);
  assert.ok(changes.every((change) => change.enabled === false));
});

test("a dependent outside the planning group still blocks a grouped disable", async () => {
  const service = new ModuleManagementService(repositoryStub({
    listEnabledDependents: async (_workspaceId, moduleKey) => moduleKey === "maintenance_calendar" ? ["external_module"] : [],
  }));

  await assert.rejects(
    service.disableModule("workspace", "maintenance_proposals", "admin"),
    /Dependent modules still enabled: external_module/,
  );
});
