import "reflect-metadata";

import assert from "node:assert/strict";
import test from "node:test";

import { PermissionKey } from "../../src/core/authorization/PermissionKey.js";
import { REQUIRED_PERMISSION_METADATA_KEY } from "../../src/nest/common/decorators/require-permission.decorator.js";
import { NestProjectCrudController } from "../../src/nest/project-crud/project-crud.controller.js";
import { NestDocumentArchiveController } from "../../src/nest/document-archive/document-archive.controller.js";

function permissionMetadata(controller: object, methodName: string): string[] {
  const method = (controller as Record<string, unknown>)[methodName];
  return Reflect.getMetadata(REQUIRED_PERMISSION_METADATA_KEY, method) ?? [];
}

test("company and client writes require registry write permission", () => {
  for (const method of ["createCompany", "updateCompany", "deleteCompany", "createClient", "updateClient", "deleteClient"]) {
    assert.deepEqual(permissionMetadata(NestProjectCrudController.prototype, method), [PermissionKey.CLIENTS_WRITE]);
  }
});

test("permanent registry deletion requires the developer-only permission", () => {
  assert.deepEqual(permissionMetadata(NestProjectCrudController.prototype, "permanentlyDeleteCompany"), [PermissionKey.CLIENTS_DELETE_PERMANENTLY]);
  assert.deepEqual(permissionMetadata(NestProjectCrudController.prototype, "permanentlyDeleteClient"), [PermissionKey.CLIENTS_DELETE_PERMANENTLY]);
});

test("archive deletion is developer-only while restore keeps document write access", () => {
  assert.deepEqual(permissionMetadata(NestDocumentArchiveController.prototype, "restoreItem"), [PermissionKey.DOCUMENTS_WRITE]);
  assert.deepEqual(permissionMetadata(NestDocumentArchiveController.prototype, "permanentlyDeleteItem"), [PermissionKey.CLIENTS_DELETE_PERMANENTLY]);
  assert.deepEqual(permissionMetadata(NestDocumentArchiveController.prototype, "emptyTrash"), [PermissionKey.CLIENTS_DELETE_PERMANENTLY]);
});
