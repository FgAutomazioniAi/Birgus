import "reflect-metadata";

import assert from "node:assert/strict";
import test from "node:test";

import { PermissionKey } from "../../src/core/authorization/PermissionKey.js";
import { REQUIRED_PERMISSION_METADATA_KEY } from "../../src/nest/common/decorators/require-permission.decorator.js";
import { AiProviderSettingsController } from "../../src/nest/settings/ai-provider-settings.controller.js";
import { MailProviderSettingsController } from "../../src/nest/settings/mail-provider-settings.controller.js";

function permissionMetadata(target: object, methodName: string): string[] {
  const method = (target as Record<string, unknown>)[methodName];
  return Reflect.getMetadata(REQUIRED_PERMISSION_METADATA_KEY, method) ?? [];
}

test("settings provider endpoints require explicit permissions", () => {
  assert.deepEqual(
    permissionMetadata(AiProviderSettingsController.prototype, "getSettings"),
    [PermissionKey.ASSISTANT_READ],
  );
  assert.deepEqual(
    permissionMetadata(AiProviderSettingsController.prototype, "patchSettings"),
    [PermissionKey.ASSISTANT_CONFIGURE],
  );
  assert.deepEqual(
    permissionMetadata(AiProviderSettingsController.prototype, "loadModels"),
    [PermissionKey.ASSISTANT_CONFIGURE],
  );
  assert.deepEqual(
    permissionMetadata(AiProviderSettingsController.prototype, "validate"),
    [PermissionKey.ASSISTANT_CONFIGURE],
  );

  assert.deepEqual(
    permissionMetadata(MailProviderSettingsController.prototype, "getSettings"),
    [PermissionKey.NOTIFICATIONS_READ],
  );
  assert.deepEqual(
    permissionMetadata(MailProviderSettingsController.prototype, "patchSettings"),
    [PermissionKey.NOTIFICATIONS_WRITE],
  );
  assert.deepEqual(
    permissionMetadata(MailProviderSettingsController.prototype, "validate"),
    [PermissionKey.NOTIFICATIONS_WRITE],
  );
});
