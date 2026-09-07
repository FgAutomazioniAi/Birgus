import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CommissionChecklistStatus,
  CommissionLockResourceType,
  CommissionRecordPriority,
  CommissionRecordStatus,
} from "@prisma/client";

import { AppError } from "../../src/core/errors/AppError.js";
import { CommissionRecordEntity } from "../../src/modules/commission-intake/domain/CommissionRecordEntity.js";
import {
  CommissionEventListItem,
  CommissionChecklistView,
  CommissionIntakeRepository,
  CommissionLockResult,
  CommissionRecordUpdateParams,
  CommissionRecordWriteParams,
} from "../../src/modules/commission-intake/repositories/CommissionIntakeRepository.js";
import { CommissionIntakeService } from "../../src/modules/commission-intake/services/CommissionIntakeService.js";

class FakeCommissionIntakeRepository implements CommissionIntakeRepository {
  public createdRecordParams: CommissionRecordWriteParams | null = null;
  public listedEventsLimit: number | null = null;
  public publishedVersion: { id: string; title: string } | null = { id: "form-version-1", title: "Checklist standard" };
  public reopenParams: {
    workspaceId: string;
    recordId: string;
    checklistId: string;
    actorUserId: string;
  } | null = null;

  public async listRecords(): Promise<CommissionRecordEntity[]> {
    return [];
  }

  public async findRecordById(): Promise<CommissionRecordEntity | null> {
    return null;
  }

  public async createRecord(params: CommissionRecordWriteParams): Promise<CommissionRecordEntity> {
    this.createdRecordParams = params;
    return new CommissionRecordEntity({
      id: "record-1",
      workspaceId: params.workspaceId,
      code: params.code ?? "COM-TEST",
      title: params.title,
      description: params.description ?? null,
      status: params.status ?? CommissionRecordStatus.DRAFT,
      priority: params.priority ?? CommissionRecordPriority.NORMAL,
      companyId: params.companyId ?? null,
      clientId: params.clientId ?? null,
      projectId: params.projectId ?? null,
      sourceSystem: params.sourceSystem ?? null,
      externalReference: params.externalReference ?? null,
      currentChecklistId: params.formVersionId ? "checklist-1" : null,
      expectedDeliveryAt: params.expectedDeliveryAt ?? null,
      estimatedBudgetAmount: params.estimatedBudgetAmount ?? null,
      currency: params.currency ?? null,
      ownerUserId: params.ownerUserId ?? null,
      createdByUserId: params.actorUserId,
      updatedByUserId: params.actorUserId,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
  }

  public async updateRecord(_params: CommissionRecordUpdateParams): Promise<CommissionRecordEntity | null> {
    return null;
  }

  public async softDeleteRecord(): Promise<boolean> {
    return false;
  }

  public async listEvents(params: {
    limit: number;
  }): Promise<CommissionEventListItem[]> {
    this.listedEventsLimit = params.limit;
    return [];
  }

  public async getChecklistView(): Promise<CommissionChecklistView> {
    return {
      record: new CommissionRecordEntity({
        id: "record-1",
        workspaceId: "workspace-1",
        code: "COM-TEST",
        title: "Commessa test",
        description: null,
        status: CommissionRecordStatus.DRAFT,
        priority: CommissionRecordPriority.NORMAL,
        companyId: null,
        clientId: null,
        projectId: null,
        sourceSystem: null,
        externalReference: null,
        currentChecklistId: "checklist-1",
        expectedDeliveryAt: null,
        estimatedBudgetAmount: null,
        currency: null,
        ownerUserId: "user-1",
        createdByUserId: "user-1",
        updatedByUserId: "user-1",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
      currentUser: { id: "user-1", fullName: "Utente Test", canReopenSignedChecklist: false },
      checklist: {
        id: "checklist-1",
        title: "Checklist standard",
        status: CommissionChecklistStatus.DRAFT,
        revisionNo: 1,
        progressPercent: 0,
        currentPageNumber: null,
        signedAt: null,
        formVersionId: "form-version-1",
      },
      pages: [],
      values: [],
      tableRows: [],
      signatures: [],
    };
  }

  public async acquireLock(params: {
    resourceType: CommissionLockResourceType;
    resourceId: string;
    lockToken: string;
    expiresAt: Date;
  }): Promise<CommissionLockResult> {
    return {
      id: "lock-1",
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      lockToken: params.lockToken,
      expiresAt: params.expiresAt,
    };
  }

  public async releaseOwnActiveLock(): Promise<boolean> {
    return true;
  }

  public async resolvePublishedTemplateVersion(): Promise<{ id: string; title: string } | null> {
    return this.publishedVersion;
  }

  public async createChecklistForRecord(): Promise<string> {
    return "checklist-1";
  }

  public async reopenChecklist(params: {
    workspaceId: string;
    recordId: string;
    checklistId: string;
    actorUserId: string;
  }): Promise<void> {
    this.reopenParams = params;
  }
}

test("CommissionIntakeService creates a normalized record with default owner, priority and template", async () => {
  const repository = new FakeCommissionIntakeRepository();
  const service = new CommissionIntakeService(repository);

  const record = await service.createRecord({
    workspaceId: "workspace-1",
    actorUserId: "user-1",
    title: "  Nuova   commessa  ",
    currency: "eur",
  });

  assert.equal(record.title, "Nuova commessa");
  assert.equal(repository.createdRecordParams?.ownerUserId, "user-1");
  assert.equal(repository.createdRecordParams?.priority, CommissionRecordPriority.NORMAL);
  assert.equal(repository.createdRecordParams?.formVersionId, "form-version-1");
  assert.equal(repository.createdRecordParams?.currency, "EUR");
});

test("CommissionIntakeService rejects too-short titles before writing", async () => {
  const repository = new FakeCommissionIntakeRepository();
  const service = new CommissionIntakeService(repository);

  await assert.rejects(
    service.createRecord({
      workspaceId: "workspace-1",
      actorUserId: "user-1",
      title: " x ",
    }),
    (error: unknown) => error instanceof AppError && error.code === "COMMISSION_TITLE_INVALID",
  );
  assert.equal(repository.createdRecordParams, null);
});

test("CommissionIntakeService clamps event limits before repository access", async () => {
  const repository = new FakeCommissionIntakeRepository();
  const service = new CommissionIntakeService(repository);

  await service.listEvents({
    workspaceId: "workspace-1",
    userId: "user-1",
    recordId: "record-1",
    limit: 500,
  });

  assert.equal(repository.listedEventsLimit, 200);
});

test("CommissionIntakeService delegates signed checklist reopening", async () => {
  const repository = new FakeCommissionIntakeRepository();
  const service = new CommissionIntakeService(repository);

  await service.reopenChecklist({
    workspaceId: "workspace-1",
    recordId: "record-1",
    checklistId: "checklist-1",
    actorUserId: "admin-1",
  });

  assert.deepEqual(repository.reopenParams, {
    workspaceId: "workspace-1",
    recordId: "record-1",
    checklistId: "checklist-1",
    actorUserId: "admin-1",
  });
});
