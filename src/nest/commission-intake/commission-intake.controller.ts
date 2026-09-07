import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
import {
  CommissionRecordPriority,
  CommissionRecordStatus,
} from "@prisma/client";
import type { FastifyRequest } from "fastify";
import { z } from "zod";

import { PermissionKey } from "../../core/authorization/PermissionKey.js";
import { AppError } from "../../core/errors/AppError.js";
import { ModuleKey } from "../../core/module-access/ModuleKey.js";
import { RequestContext } from "../../core/tenancy/RequestContext.js";
import { CommissionRecordEntity } from "../../modules/commission-intake/domain/CommissionRecordEntity.js";
import { CommissionIntakeService } from "../../modules/commission-intake/services/CommissionIntakeService.js";
import { MultipartFormReader } from "../../shared/http/MultipartFormReader.js";
import { AccessPolicyGuard } from "../auth/access-policy.guard.js";
import { RequestContextAuthGuard } from "../auth/request-context-auth.guard.js";
import { CurrentRequestContext } from "../common/decorators/request-context.decorator.js";
import { RequireModule } from "../common/decorators/require-module.decorator.js";
import { RequirePermission } from "../common/decorators/require-permission.decorator.js";

const uuidSchema = z.string().uuid();

const listRecordsQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: z.nativeEnum(CommissionRecordStatus).optional(),
});

const decimalStringSchema = z.string().trim().regex(/^-?\d+(\.\d{1,6})?$/).optional().nullable();

const createRecordSchema = z.object({
  title: z.string().trim().min(2).max(240),
  code: z.string().trim().min(1).max(80).optional().nullable(),
  description: z.string().trim().max(8000).optional().nullable(),
  status: z.nativeEnum(CommissionRecordStatus).optional().nullable(),
  priority: z.nativeEnum(CommissionRecordPriority).optional().nullable(),
  companyId: z.number().int().positive().optional().nullable(),
  clientId: uuidSchema.optional().nullable(),
  projectId: uuidSchema.optional().nullable(),
  sourceSystem: z.string().trim().max(80).optional().nullable(),
  externalReference: z.string().trim().max(120).optional().nullable(),
  expectedDeliveryAt: z.coerce.date().optional().nullable(),
  estimatedBudgetAmount: decimalStringSchema,
  currency: z.string().trim().length(3).optional().nullable(),
  metadata: z.unknown().optional(),
  ownerUserId: uuidSchema.optional().nullable(),
  formVersionId: uuidSchema.optional().nullable(),
});

const updateRecordSchema = createRecordSchema.partial().extend({
  title: z.string().trim().min(2).max(240).optional(),
});

const deleteRecordSchema = z.object({
  confirmText: z.string().trim().min(1),
});

const eventLimitSchema = z.coerce.number().int().min(1).max(200);

const saveFieldValueSchema = z.object({
  value: z.unknown().optional().nullable(),
});

const replaceTableRowsSchema = z.object({
  rows: z.array(z.object({
    rowKey: z.string().trim().max(120).optional().nullable(),
    cells: z.record(z.string(), z.unknown()),
  })).max(200),
});

const signChecklistSchema = z.object({
  statement: z.string().trim().max(2000).optional().nullable(),
});

@Controller("/api/commission-intake")
@UseGuards(RequestContextAuthGuard, AccessPolicyGuard)
export class CommissionIntakeController {
  public constructor(
    @Inject(CommissionIntakeService)
    private readonly service: CommissionIntakeService,
  ) {}

  @Get("records")
  @RequireModule(ModuleKey.COMMISSION_REGISTRY)
  @RequirePermission(PermissionKey.COMMISSION_REGISTRY_READ)
  public async listRecords(
    @Query() queryRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const query = listRecordsQuerySchema.parse(queryRaw);
    const records = await this.service.listRecords({
      workspaceId: requestContext.workspace.workspaceId,
      userId: requestContext.workspace.userId,
      search: query.search ?? null,
      status: query.status ?? null,
    });

    return { records: records.map((record) => this.serializeRecord(record)) };
  }

  @Post("records")
  @HttpCode(201)
  @RequireModule(ModuleKey.COMMISSION_REGISTRY)
  @RequirePermission(PermissionKey.COMMISSION_REGISTRY_WRITE)
  public async createRecord(
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const body = createRecordSchema.parse(bodyRaw);
    const record = await this.service.createRecord({
      workspaceId: requestContext.workspace.workspaceId,
      actorUserId: requestContext.workspace.userId,
      ...body,
    });

    return { record: this.serializeRecord(record) };
  }

  @Get("records/:recordId")
  @RequireModule(ModuleKey.COMMISSION_REGISTRY)
  @RequirePermission(PermissionKey.COMMISSION_REGISTRY_READ)
  public async getRecord(
    @Param("recordId") recordIdRaw: string,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const record = await this.service.getRecord({
      workspaceId: requestContext.workspace.workspaceId,
      userId: requestContext.workspace.userId,
      recordId: uuidSchema.parse(recordIdRaw),
    });

    return { record: this.serializeRecord(record) };
  }

  @Get("records/:recordId/checklist")
  @RequireModule(ModuleKey.COMMISSION_INTAKE)
  @RequirePermission(PermissionKey.COMMISSION_INTAKE_READ)
  public async getChecklistView(
    @Param("recordId") recordIdRaw: string,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const view = await this.service.getChecklistView({
      workspaceId: requestContext.workspace.workspaceId,
      userId: requestContext.workspace.userId,
      recordId: uuidSchema.parse(recordIdRaw),
    });

    return { view };
  }

  @Get("checklists")
  @RequireModule(ModuleKey.COMMISSION_INTAKE)
  @RequirePermission(PermissionKey.COMMISSION_INTAKE_READ)
  public async listChecklistRecords(
    @Query() queryRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const query = listRecordsQuerySchema.parse(queryRaw);
    const records = await this.service.listRecords({
      workspaceId: requestContext.workspace.workspaceId,
      userId: requestContext.workspace.userId,
      search: query.search ?? null,
      status: query.status ?? null,
    });

    return { records: records.map((record) => this.serializeRecord(record)) };
  }

  @Patch("records/:recordId")
  @RequireModule(ModuleKey.COMMISSION_REGISTRY)
  @RequirePermission(PermissionKey.COMMISSION_REGISTRY_WRITE)
  public async updateRecord(
    @Param("recordId") recordIdRaw: string,
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const body = updateRecordSchema.parse(bodyRaw);
    const { status, priority, ...rest } = body;
    const record = await this.service.updateRecord({
      workspaceId: requestContext.workspace.workspaceId,
      actorUserId: requestContext.workspace.userId,
      recordId: uuidSchema.parse(recordIdRaw),
      ...rest,
      status: status ?? undefined,
      priority: priority ?? undefined,
    });

    return { record: this.serializeRecord(record) };
  }

  @Delete("records/:recordId")
  @HttpCode(200)
  @RequireModule(ModuleKey.COMMISSION_REGISTRY)
  @RequirePermission(PermissionKey.COMMISSION_REGISTRY_WRITE)
  public async deleteRecord(
    @Param("recordId") recordIdRaw: string,
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const body = deleteRecordSchema.parse(bodyRaw);
    const recordId = uuidSchema.parse(recordIdRaw);
    const record = await this.service.getRecord({
      workspaceId: requestContext.workspace.workspaceId,
      userId: requestContext.workspace.userId,
      recordId,
    });
    if (body.confirmText !== record.code && body.confirmText !== record.title) {
      throw new AppError("Conferma eliminazione non valida: inserisci codice o titolo della commessa.", "COMMISSION_DELETE_CONFIRMATION_INVALID", 400);
    }

    await this.service.deleteRecord({
      workspaceId: requestContext.workspace.workspaceId,
      actorUserId: requestContext.workspace.userId,
      recordId,
    });

    return { ok: true, id: recordId };
  }

  @Get("records/:recordId/events")
  @RequireModule(ModuleKey.COMMISSION_INTAKE)
  @RequirePermission(PermissionKey.COMMISSION_INTAKE_READ)
  public async listEvents(
    @Param("recordId") recordIdRaw: string,
    @Query("limit") limitRaw: string | undefined,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const events = await this.service.listEvents({
      workspaceId: requestContext.workspace.workspaceId,
      userId: requestContext.workspace.userId,
      recordId: uuidSchema.parse(recordIdRaw),
      limit: limitRaw ? eventLimitSchema.parse(limitRaw) : undefined,
    });

    return {
      events: events.map((event) => ({
        id: event.id,
        eventType: event.eventType,
        actorUserId: event.actorUserId,
        summary: event.summary,
        payload: event.payload,
        createdAt: event.createdAt,
      })),
    };
  }

  @Put("records/:recordId/checklists/:checklistId/fields/:fieldId")
  @HttpCode(200)
  @RequireModule(ModuleKey.COMMISSION_INTAKE)
  @RequirePermission(PermissionKey.COMMISSION_INTAKE_WRITE)
  public async saveFieldValue(
    @Param("recordId") recordIdRaw: string,
    @Param("checklistId") checklistIdRaw: string,
    @Param("fieldId") fieldIdRaw: string,
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const body = saveFieldValueSchema.parse(bodyRaw ?? {});
    const result = await this.service.saveFieldValue({
      workspaceId: requestContext.workspace.workspaceId,
      recordId: uuidSchema.parse(recordIdRaw),
      checklistId: uuidSchema.parse(checklistIdRaw),
      fieldId: uuidSchema.parse(fieldIdRaw),
      actorUserId: requestContext.workspace.userId,
      value: body.value ?? null,
    });

    return { fieldValue: result.fieldValue, progressPercent: result.progressPercent };
  }

  @Put("records/:recordId/checklists/:checklistId/tables/:tableDefinitionId/rows")
  @HttpCode(200)
  @RequireModule(ModuleKey.COMMISSION_INTAKE)
  @RequirePermission(PermissionKey.COMMISSION_INTAKE_WRITE)
  public async replaceTableRows(
    @Param("recordId") recordIdRaw: string,
    @Param("checklistId") checklistIdRaw: string,
    @Param("tableDefinitionId") tableDefinitionIdRaw: string,
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const body = replaceTableRowsSchema.parse(bodyRaw ?? {});
    const rows = await this.service.replaceTableRows({
      workspaceId: requestContext.workspace.workspaceId,
      recordId: uuidSchema.parse(recordIdRaw),
      checklistId: uuidSchema.parse(checklistIdRaw),
      tableDefinitionId: uuidSchema.parse(tableDefinitionIdRaw),
      actorUserId: requestContext.workspace.userId,
      rows: body.rows,
    });

    return { rows };
  }

  @Post("records/:recordId/checklists/:checklistId/attachments")
  @HttpCode(201)
  @RequireModule(ModuleKey.COMMISSION_INTAKE)
  @RequirePermission(PermissionKey.COMMISSION_INTAKE_WRITE)
  public async uploadAttachment(
    @Param("recordId") recordIdRaw: string,
    @Param("checklistId") checklistIdRaw: string,
    @Req() request: FastifyRequest,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const multipart = await MultipartFormReader.read(request);
    const uploaded = multipart.files.find((item) => item.fieldName === "file") ?? multipart.files[0];
    if (!uploaded) {
      throw new AppError("Nessun file ricevuto.", "COMMISSION_ATTACHMENT_FILE_MISSING", 400);
    }

    const attachment = await this.service.uploadAttachment({
      workspaceId: requestContext.workspace.workspaceId,
      recordId: uuidSchema.parse(recordIdRaw),
      checklistId: uuidSchema.parse(checklistIdRaw),
      actorUserId: requestContext.workspace.userId,
      fieldKey: multipart.fields.fieldKey ?? null,
      label: multipart.fields.label ?? null,
      note: multipart.fields.note ?? null,
      fileName: uploaded.fileName,
      mimeType: uploaded.mimeType,
      bytes: uploaded.bytes,
    });

    return { attachment };
  }

  @Delete("records/:recordId/attachments/:attachmentId")
  @HttpCode(200)
  @RequireModule(ModuleKey.COMMISSION_INTAKE)
  @RequirePermission(PermissionKey.COMMISSION_INTAKE_WRITE)
  public async deleteAttachment(
    @Param("recordId") recordIdRaw: string,
    @Param("attachmentId") attachmentIdRaw: string,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    await this.service.deleteAttachment({
      workspaceId: requestContext.workspace.workspaceId,
      recordId: uuidSchema.parse(recordIdRaw),
      attachmentId: uuidSchema.parse(attachmentIdRaw),
      actorUserId: requestContext.workspace.userId,
    });

    return { ok: true };
  }

  @Post("records/:recordId/checklists/:checklistId/signatures")
  @HttpCode(201)
  @RequireModule(ModuleKey.COMMISSION_INTAKE)
  @RequirePermission(PermissionKey.COMMISSION_INTAKE_WRITE)
  public async signChecklist(
    @Param("recordId") recordIdRaw: string,
    @Param("checklistId") checklistIdRaw: string,
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const body = signChecklistSchema.parse(bodyRaw ?? {});
    const signature = await this.service.signChecklist({
      workspaceId: requestContext.workspace.workspaceId,
      recordId: uuidSchema.parse(recordIdRaw),
      checklistId: uuidSchema.parse(checklistIdRaw),
      actorUserId: requestContext.workspace.userId,
      statement: body.statement ?? null,
    });

    return { signature };
  }

  @Post("records/:recordId/checklists/:checklistId/reopen")
  @HttpCode(200)
  @RequireModule(ModuleKey.COMMISSION_INTAKE)
  @RequirePermission(PermissionKey.COMMISSION_INTAKE_CONFIGURE)
  public async reopenChecklist(
    @Param("recordId") recordIdRaw: string,
    @Param("checklistId") checklistIdRaw: string,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    await this.service.reopenChecklist({
      workspaceId: requestContext.workspace.workspaceId,
      recordId: uuidSchema.parse(recordIdRaw),
      checklistId: uuidSchema.parse(checklistIdRaw),
      actorUserId: requestContext.workspace.userId,
    });

    return { ok: true };
  }

  @Post("records/:recordId/checklist/lock")
  @HttpCode(201)
  @RequireModule(ModuleKey.COMMISSION_INTAKE)
  @RequirePermission(PermissionKey.COMMISSION_INTAKE_WRITE)
  public async acquireChecklistLock(
    @Param("recordId") recordIdRaw: string,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const lock = await this.service.acquireChecklistLock({
      workspaceId: requestContext.workspace.workspaceId,
      recordId: uuidSchema.parse(recordIdRaw),
      userId: requestContext.workspace.userId,
    });

    return {
      lock: {
        id: lock.id,
        resourceType: lock.resourceType,
        resourceId: lock.resourceId,
        expiresAt: lock.expiresAt,
      },
    };
  }

  @Post("records/:recordId/checklist/lock/release")
  @HttpCode(200)
  @RequireModule(ModuleKey.COMMISSION_INTAKE)
  @RequirePermission(PermissionKey.COMMISSION_INTAKE_WRITE)
  public async releaseOwnChecklistLock(
    @Param("recordId") recordIdRaw: string,
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const body = z.object({ reason: z.string().trim().max(120).optional().nullable() }).parse(bodyRaw ?? {});
    await this.service.releaseOwnChecklistLock({
      workspaceId: requestContext.workspace.workspaceId,
      recordId: uuidSchema.parse(recordIdRaw),
      userId: requestContext.workspace.userId,
      reason: body.reason ?? null,
    });

    return { ok: true };
  }

  private serializeRecord(record: CommissionRecordEntity): Record<string, unknown> {
    return {
      id: record.id,
      workspaceId: record.workspaceId,
      code: record.code,
      title: record.title,
      description: record.description,
      status: record.status,
      priority: record.priority,
      companyId: record.companyId,
      clientId: record.clientId,
      clientDisplayName: record.clientDisplayName,
      companyName: record.companyName,
      projectId: record.projectId,
      sourceSystem: record.sourceSystem,
      externalReference: record.externalReference,
      currentChecklistId: record.currentChecklistId,
      expectedDeliveryAt: record.expectedDeliveryAt,
      estimatedBudgetAmount: record.estimatedBudgetAmount,
      currency: record.currency,
      ownerUserId: record.ownerUserId,
      createdByUserId: record.createdByUserId,
      updatedByUserId: record.updatedByUserId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
