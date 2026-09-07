import { createHash, randomBytes } from "node:crypto";

import {
  CommissionLockResourceType,
  CommissionRecordPriority,
  CommissionRecordStatus,
} from "@prisma/client";

import { AppError } from "../../../core/errors/AppError.js";
import { ModuleKey } from "../../../core/module-access/ModuleKey.js";
import { GaragePath } from "../../../storage/GaragePath.js";
import { ProjectBinaryStorage } from "../../../storage/ProjectBinaryStorage.js";
import { AuditLogService } from "../../audit/services/AuditLogService.js";
import { NotificationService } from "../../notifications/services/NotificationService.js";
import { CommissionRecordEntity } from "../domain/CommissionRecordEntity.js";
import {
  CommissionChecklistView,
  CommissionEventListItem,
  CommissionAttachmentItem,
  CommissionIntakeRepository,
  CommissionLockResult,
  CommissionSavedFieldValue,
  CommissionSignatureItem,
  CommissionTableRowItem,
} from "../repositories/CommissionIntakeRepository.js";

export class CommissionIntakeService {
  private readonly repository: CommissionIntakeRepository;
  private readonly notificationService: NotificationService | null;
  private readonly auditLogService: AuditLogService | null;
  private readonly storage: ProjectBinaryStorage;

  public constructor(
    repository: CommissionIntakeRepository,
    storage: ProjectBinaryStorage,
    notificationService?: NotificationService | null,
    auditLogService?: AuditLogService | null,
  ) {
    this.repository = repository;
    this.storage = storage;
    this.notificationService = notificationService ?? null;
    this.auditLogService = auditLogService ?? null;
  }

  public async listRecords(params: {
    workspaceId: string;
    userId: string;
    search?: string | null;
    status?: CommissionRecordStatus | null;
  }): Promise<CommissionRecordEntity[]> {
    return this.repository.listRecords(params);
  }

  public async getRecord(params: {
    workspaceId: string;
    userId: string;
    recordId: string;
  }): Promise<CommissionRecordEntity> {
    const record = await this.repository.findRecordById(params);
    if (!record) {
      throw new AppError("Commessa non trovata o non accessibile.", "COMMISSION_RECORD_NOT_FOUND", 404);
    }

    return record;
  }

  public async createRecord(params: {
    workspaceId: string;
    actorUserId: string;
    title: string;
    code?: string | null;
    description?: string | null;
    status?: CommissionRecordStatus | null;
    priority?: CommissionRecordPriority | null;
    companyId?: number | null;
    clientId?: string | null;
    projectId?: string | null;
    sourceSystem?: string | null;
    externalReference?: string | null;
    expectedDeliveryAt?: Date | null;
    estimatedBudgetAmount?: string | null;
    currency?: string | null;
    metadata?: unknown;
    ownerUserId?: string | null;
    formVersionId?: string | null;
  }): Promise<CommissionRecordEntity> {
    const title = this.normalizeTitle(params.title);
    const templateVersion = await this.repository.resolvePublishedTemplateVersion({
      workspaceId: params.workspaceId,
      formVersionId: params.formVersionId ?? null,
    });
    const record = await this.repository.createRecord({
      workspaceId: params.workspaceId,
      title,
      code: this.normalizeOptional(params.code) ?? this.generateRecordCode(),
      description: this.normalizeOptional(params.description),
      status: params.status ?? CommissionRecordStatus.DRAFT,
      priority: params.priority ?? CommissionRecordPriority.NORMAL,
      companyId: params.companyId ?? null,
      clientId: params.clientId ?? null,
      projectId: params.projectId ?? null,
      sourceSystem: this.normalizeOptional(params.sourceSystem),
      externalReference: this.normalizeOptional(params.externalReference),
      expectedDeliveryAt: params.expectedDeliveryAt ?? null,
      estimatedBudgetAmount: this.normalizeOptional(params.estimatedBudgetAmount),
      currency: this.normalizeCurrency(params.currency),
      metadata: params.metadata,
      ownerUserId: params.ownerUserId ?? params.actorUserId,
      actorUserId: params.actorUserId,
      formVersionId: templateVersion?.id ?? null,
    });

    await this.notificationService?.createInfo({
      workspaceId: params.workspaceId,
      userId: record.ownerUserId,
      moduleKey: ModuleKey.COMMISSION_INTAKE,
      title: "Commessa creata",
      message: `${record.code} - ${record.title}`,
    });
    await this.auditLogService?.record({
      workspaceId: params.workspaceId,
      userId: params.actorUserId,
      moduleKey: ModuleKey.COMMISSION_INTAKE,
      action: "commission_record.create",
      entityType: "CommissionRecord",
      entityId: record.id,
      payload: {
        code: record.code,
        title: record.title,
        checklistId: record.currentChecklistId,
      },
    });

    return record;
  }

  public async updateRecord(params: {
    workspaceId: string;
    actorUserId: string;
    recordId: string;
    title?: string;
    description?: string | null;
    status?: CommissionRecordStatus;
    priority?: CommissionRecordPriority;
    companyId?: number | null;
    clientId?: string | null;
    projectId?: string | null;
    sourceSystem?: string | null;
    externalReference?: string | null;
    expectedDeliveryAt?: Date | null;
    estimatedBudgetAmount?: string | null;
    currency?: string | null;
    metadata?: unknown;
  }): Promise<CommissionRecordEntity> {
    const record = await this.repository.updateRecord({
      ...params,
      title: params.title === undefined ? undefined : this.normalizeTitle(params.title),
      description: params.description === undefined ? undefined : this.normalizeOptional(params.description),
      sourceSystem: params.sourceSystem === undefined ? undefined : this.normalizeOptional(params.sourceSystem),
      externalReference: params.externalReference === undefined ? undefined : this.normalizeOptional(params.externalReference),
      estimatedBudgetAmount: params.estimatedBudgetAmount === undefined ? undefined : this.normalizeOptional(params.estimatedBudgetAmount),
      currency: params.currency === undefined ? undefined : this.normalizeCurrency(params.currency),
    });

    if (!record) {
      throw new AppError("Commessa non trovata o non modificabile.", "COMMISSION_RECORD_NOT_FOUND", 404);
    }

    await this.auditLogService?.record({
      workspaceId: params.workspaceId,
      userId: params.actorUserId,
      moduleKey: ModuleKey.COMMISSION_INTAKE,
      action: "commission_record.update",
      entityType: "CommissionRecord",
      entityId: record.id,
      payload: { code: record.code, title: record.title },
    });

    return record;
  }

  public async deleteRecord(params: {
    workspaceId: string;
    actorUserId: string;
    recordId: string;
  }): Promise<void> {
    const deleted = await this.repository.softDeleteRecord(params);
    if (!deleted) {
      throw new AppError("Commessa non trovata o non modificabile.", "COMMISSION_RECORD_NOT_FOUND", 404);
    }

    await this.auditLogService?.record({
      workspaceId: params.workspaceId,
      userId: params.actorUserId,
      moduleKey: ModuleKey.COMMISSION_INTAKE,
      action: "commission_record.delete",
      entityType: "CommissionRecord",
      entityId: params.recordId,
      payload: null,
    });
  }

  public async listEvents(params: {
    workspaceId: string;
    userId: string;
    recordId: string;
    limit?: number;
  }): Promise<CommissionEventListItem[]> {
    return this.repository.listEvents({
      ...params,
      limit: Math.min(Math.max(params.limit ?? 50, 1), 200),
    });
  }

  public async getChecklistView(params: {
    workspaceId: string;
    userId: string;
    recordId: string;
  }): Promise<CommissionChecklistView> {
    return this.repository.getChecklistView(params);
  }

  public async saveFieldValue(params: {
    workspaceId: string;
    recordId: string;
    checklistId: string;
    fieldId: string;
    actorUserId: string;
    value: unknown;
  }): Promise<CommissionSavedFieldValue> {
    return this.repository.saveFieldValue(params);
  }

  public async replaceTableRows(params: {
    workspaceId: string;
    recordId: string;
    checklistId: string;
    tableDefinitionId: string;
    actorUserId: string;
    rows: Array<{ rowKey?: string | null; cells: Record<string, unknown> }>;
  }): Promise<CommissionTableRowItem[]> {
    return this.repository.replaceTableRows(params);
  }

  public async uploadAttachment(params: {
    workspaceId: string;
    recordId: string;
    checklistId: string;
    actorUserId: string;
    fieldKey?: string | null;
    label?: string | null;
    note?: string | null;
    fileName: string;
    mimeType: string;
    bytes: Buffer;
  }): Promise<CommissionAttachmentItem> {
    if (params.bytes.length === 0) {
      throw new AppError("File vuoto.", "COMMISSION_ATTACHMENT_EMPTY", 400);
    }
    if (params.bytes.length > 25 * 1024 * 1024) {
      throw new AppError("File troppo grande: massimo 25 MB.", "COMMISSION_ATTACHMENT_TOO_LARGE", 400);
    }

    const fileName = this.resolveFileName(params.fileName);
    const checksum = this.storage.sha256Hex(params.bytes);
    const objectKey = [
      this.sanitizePathSegment(this.storage.storagePrefix()),
      this.sanitizePathSegment(params.workspaceId),
      "commission-intake",
      this.sanitizePathSegment(params.recordId),
      checksum,
      this.sanitizePathSegment(fileName),
    ].join("/");

    const stored = await this.storage.putObject({
      bucket: this.storage.defaultBucket(),
      objectKey,
      bytes: params.bytes,
      contentType: params.mimeType || "application/octet-stream",
      metadata: {
        workspaceid: params.workspaceId,
        scope: "commission-intake",
        recordid: params.recordId,
      },
    });

    const attachment = await this.repository.createAttachment({
      workspaceId: params.workspaceId,
      recordId: params.recordId,
      checklistId: params.checklistId,
      actorUserId: params.actorUserId,
      fieldKey: this.normalizeOptional(params.fieldKey),
      label: this.normalizeOptional(params.label),
      note: this.normalizeOptional(params.note),
      fileName,
      mimeType: params.mimeType || "application/octet-stream",
      sizeBytes: params.bytes.length,
      checksumSha256: checksum,
      storagePath: GaragePath.toStoragePath(stored.bucket, stored.objectKey),
    });

    await this.auditLogService?.record({
      workspaceId: params.workspaceId,
      userId: params.actorUserId,
      moduleKey: ModuleKey.COMMISSION_INTAKE,
      action: "commission_attachment.upload",
      entityType: "CommissionAttachment",
      entityId: attachment.id,
      payload: { recordId: params.recordId, checklistId: params.checklistId, fieldKey: params.fieldKey ?? null, fileName },
    });

    return attachment;
  }

  public async deleteAttachment(params: {
    workspaceId: string;
    recordId: string;
    attachmentId: string;
    actorUserId: string;
  }): Promise<void> {
    const deleted = await this.repository.deleteAttachment(params);
    if (!deleted) {
      throw new AppError("Allegato non trovato o non modificabile.", "COMMISSION_ATTACHMENT_NOT_FOUND", 404);
    }

    if (deleted.storagePath.startsWith("garage://")) {
      try {
        const parsed = GaragePath.parse(deleted.storagePath);
        await this.storage.deleteObject(parsed.bucket, parsed.objectKey);
      } catch {
        // Il DB resta la fonte di verita: se la cancellazione fisica fallisce, l'allegato non resta visibile.
      }
    }

    await this.auditLogService?.record({
      workspaceId: params.workspaceId,
      userId: params.actorUserId,
      moduleKey: ModuleKey.COMMISSION_INTAKE,
      action: "commission_attachment.delete",
      entityType: "CommissionAttachment",
      entityId: params.attachmentId,
      payload: { recordId: params.recordId },
    });
  }

  public async signChecklist(params: {
    workspaceId: string;
    recordId: string;
    checklistId: string;
    actorUserId: string;
    statement?: string | null;
  }): Promise<CommissionSignatureItem> {
    return this.repository.signChecklist({
      ...params,
      statement: this.normalizeOptional(params.statement),
    });
  }

  public async acquireChecklistLock(params: {
    workspaceId: string;
    recordId: string;
    userId: string;
  }): Promise<CommissionLockResult> {
    const view = await this.repository.getChecklistView({
      workspaceId: params.workspaceId,
      recordId: params.recordId,
      userId: params.userId,
    });
    if (!view.checklist) {
      throw new AppError("Questa commessa non ha una checklist da bloccare.", "COMMISSION_CHECKLIST_NOT_FOUND", 404);
    }

    return this.acquireLock({
      workspaceId: params.workspaceId,
      recordId: params.recordId,
      userId: params.userId,
      resourceType: CommissionLockResourceType.CHECKLIST,
      resourceId: view.checklist.id,
      ttlSeconds: 600,
    });
  }

  public async releaseOwnChecklistLock(params: {
    workspaceId: string;
    recordId: string;
    userId: string;
    reason?: string | null;
  }): Promise<void> {
    const released = await this.repository.releaseOwnActiveLock({
      workspaceId: params.workspaceId,
      recordId: params.recordId,
      userId: params.userId,
      resourceType: CommissionLockResourceType.CHECKLIST,
      reason: params.reason ?? null,
    });

    if (!released) {
      return;
    }
  }

  private async acquireLock(params: {
    workspaceId: string;
    recordId: string;
    userId: string;
    resourceType: CommissionLockResourceType;
    resourceId: string;
    ttlSeconds: number;
  }): Promise<CommissionLockResult> {
    const ttlSeconds = Math.min(Math.max(params.ttlSeconds, 30), 1800);
    const lockToken = randomBytes(32).toString("base64url");
    const lockTokenHash = this.hashLockToken(lockToken);

    return this.repository.acquireLock({
      workspaceId: params.workspaceId,
      recordId: params.recordId,
      userId: params.userId,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      lockToken,
      lockTokenHash,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000),
    });
  }

  private normalizeTitle(value: string): string {
    const title = value.trim().replace(/\s+/g, " ");
    if (title.length < 2) {
      throw new AppError("Il titolo della commessa è troppo breve.", "COMMISSION_TITLE_INVALID", 400);
    }

    return title;
  }

  private normalizeOptional(value: string | null | undefined): string | null {
    if (typeof value !== "string") {
      return null;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private normalizeCurrency(value: string | null | undefined): string | null {
    const normalized = this.normalizeOptional(value);
    if (!normalized) {
      return null;
    }

    if (!/^[A-Za-z]{3}$/.test(normalized)) {
      throw new AppError("La valuta deve usare il codice ISO a 3 lettere.", "COMMISSION_CURRENCY_INVALID", 400);
    }

    return normalized.toUpperCase();
  }

  private generateRecordCode(): string {
    const date = new Date();
    const stamp = [
      date.getUTCFullYear(),
      String(date.getUTCMonth() + 1).padStart(2, "0"),
      String(date.getUTCDate()).padStart(2, "0"),
      String(date.getUTCHours()).padStart(2, "0"),
      String(date.getUTCMinutes()).padStart(2, "0"),
      String(date.getUTCSeconds()).padStart(2, "0"),
    ].join("");
    return `COM-${stamp}-${randomBytes(3).toString("hex").toUpperCase()}`;
  }

  private hashLockToken(token: string): string {
    return createHash("sha256").update(token).digest("base64url");
  }

  private resolveFileName(fileName: string): string {
    const normalized = fileName.replace(/\\/g, "/").split("/").pop()?.trim() ?? "";
    const safeName = normalized.replace(/[^a-zA-Z0-9._ -]/g, "_").replace(/\s+/g, " ").slice(0, 180);
    return safeName || "allegato.bin";
  }

  private sanitizePathSegment(value: string): string {
    return value
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "na";
  }
}
