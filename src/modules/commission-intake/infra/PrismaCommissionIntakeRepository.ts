import {
  CommissionAccessRole,
  CommissionChecklistStatus,
  CommissionDataKind,
  CommissionEventType,
  CommissionFieldType,
  CommissionLockResourceType,
  CommissionRecord,
  CommissionRecordStatus,
  DocumentScope,
  Prisma,
} from "@prisma/client";

import { AppError } from "../../../core/errors/AppError.js";
import { ModuleKey } from "../../../core/module-access/ModuleKey.js";
import { PrismaClientManager } from "../../../database/PrismaClientManager.js";
import { CommissionRecordEntity } from "../domain/CommissionRecordEntity.js";
import {
  CommissionAttachmentItem,
  CommissionEventListItem,
  CommissionChecklistView,
  CommissionFieldValueItem,
  CommissionIntakeRepository,
  CommissionLockResult,
  CommissionRecordUpdateParams,
  CommissionRecordWriteParams,
  CommissionSavedFieldValue,
  CommissionSignatureItem,
  CommissionTableRowItem,
} from "../repositories/CommissionIntakeRepository.js";

type CommissionRecordWithDisplay = CommissionRecord & {
  client?: {
    first_name: string;
    last_name: string | null;
    company?: { name: string } | null;
  } | null;
  company?: { name: string } | null;
};

export class PrismaCommissionIntakeRepository implements CommissionIntakeRepository {
  public async listRecords(params: {
    workspaceId: string;
    userId: string;
    search?: string | null;
    status?: CommissionRecordStatus | null;
  }): Promise<CommissionRecordEntity[]> {
    const prisma = PrismaClientManager.getClient();
    const where: Prisma.CommissionRecordWhereInput = {
      workspace_id: params.workspaceId,
      deleted_at: null,
      ...(params.status ? { status: params.status } : {}),
      ...(params.search ? {
        OR: [
          { code: { contains: params.search, mode: "insensitive" } },
          { title: { contains: params.search, mode: "insensitive" } },
          { search_text: { contains: params.search, mode: "insensitive" } },
          { company: { is: { name: { contains: params.search, mode: "insensitive" } } } },
          { client: { is: { first_name: { contains: params.search, mode: "insensitive" } } } },
          { client: { is: { last_name: { contains: params.search, mode: "insensitive" } } } },
        ],
      } : {}),
    };

    const rows = await prisma.commissionRecord.findMany({
      where,
      include: {
        client: { select: { first_name: true, last_name: true, company: { select: { name: true } } } },
        company: { select: { name: true } },
      },
      orderBy: [
        { updated_at: "desc" },
        { created_at: "desc" },
      ],
      take: 200,
    });

    return rows.map((row) => this.mapRecord(row));
  }

  public async findRecordById(params: {
    workspaceId: string;
    userId: string;
    recordId: string;
  }): Promise<CommissionRecordEntity | null> {
    const prisma = PrismaClientManager.getClient();
    const row = await prisma.commissionRecord.findFirst({
      where: {
        workspace_id: params.workspaceId,
        id: params.recordId,
        deleted_at: null,
      },
      include: {
        client: { select: { first_name: true, last_name: true, company: { select: { name: true } } } },
        company: { select: { name: true } },
      },
    });

    return row ? this.mapRecord(row) : null;
  }

  public async createRecord(params: CommissionRecordWriteParams): Promise<CommissionRecordEntity> {
    const prisma = PrismaClientManager.getClient();

    try {
      const row = await prisma.$transaction(async (tx) => {
        const companyId = params.companyId ?? await this.findOrCreateCompanyByName(tx, params.workspaceId, params.companyName ?? null);
        await this.ensureRelatedEntities(tx, { ...params, companyId });
        await this.ensureUserActiveInWorkspace(tx, params.workspaceId, params.ownerUserId ?? params.actorUserId);

        const record = await tx.commissionRecord.create({
          data: {
            workspace_id: params.workspaceId,
            code: params.code ?? "",
            title: params.title,
            description: params.description ?? null,
            status: params.status ?? CommissionRecordStatus.DRAFT,
            priority: params.priority,
            company_id: companyId,
            client_id: params.clientId ?? null,
            project_id: params.projectId ?? null,
            source_system: params.sourceSystem ?? null,
            external_reference: params.externalReference ?? null,
            expected_delivery_at: params.expectedDeliveryAt ?? null,
            estimated_budget_amount: params.estimatedBudgetAmount ?? null,
            currency: params.currency ?? null,
            metadata: this.toNullableJson(params.metadata),
            search_text: this.buildSearchText({
              code: params.code ?? "",
              title: params.title,
              description: params.description ?? null,
              sourceSystem: params.sourceSystem ?? null,
              externalReference: params.externalReference ?? null,
            }),
            owner_user_id: params.ownerUserId ?? params.actorUserId,
            created_by_user_id: params.actorUserId,
            updated_by_user_id: params.actorUserId,
          },
        });

        await tx.commissionRecordAccess.create({
          data: {
            workspace_id: params.workspaceId,
            record_id: record.id,
            user_id: params.ownerUserId ?? params.actorUserId,
            role: CommissionAccessRole.EDITOR,
            granted_by_user_id: params.actorUserId,
          },
        });

        let currentChecklistId: string | null = null;
        if (params.formVersionId) {
          const version = await this.findPublishedTemplateVersion(tx, params.workspaceId, params.formVersionId);
          if (!version) {
            throw new AppError("Template checklist non trovato o non pubblicato.", "COMMISSION_TEMPLATE_VERSION_NOT_FOUND", 404);
          }

          const checklist = await tx.commissionChecklist.create({
            data: {
              workspace_id: params.workspaceId,
              record_id: record.id,
              form_version_id: version.id,
              title: version.title,
              status: CommissionChecklistStatus.DRAFT,
              created_by_user_id: params.actorUserId,
              updated_by_user_id: params.actorUserId,
            },
          });
          currentChecklistId = checklist.id;
          await tx.commissionRecord.update({
            where: { id: record.id },
            data: { current_checklist_id: checklist.id },
          });
        }

        await this.recordEvent(tx, {
          workspaceId: params.workspaceId,
          recordId: record.id,
          checklistId: currentChecklistId,
          actorUserId: params.actorUserId,
          eventType: CommissionEventType.CREATED,
          summary: "Commessa creata.",
          payload: { code: record.code, title: record.title },
        });

        return tx.commissionRecord.findUniqueOrThrow({
          where: { id: record.id },
          include: {
            client: { select: { first_name: true, last_name: true, company: { select: { name: true } } } },
            company: { select: { name: true } },
          },
        });
      });

      return this.mapRecord(row);
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new AppError("Esiste già una commessa con questo codice nel workspace.", "COMMISSION_CODE_ALREADY_EXISTS", 409);
      }

      throw error;
    }
  }

  public async updateRecord(params: CommissionRecordUpdateParams): Promise<CommissionRecordEntity | null> {
    const prisma = PrismaClientManager.getClient();
    await this.ensureCanWrite(params.workspaceId, params.recordId, params.actorUserId);

    const updated = await prisma.$transaction(async (tx) => {
      await this.ensureRelatedEntities(tx, params);
      const existing = await tx.commissionRecord.findFirst({
        where: {
          workspace_id: params.workspaceId,
          id: params.recordId,
          deleted_at: null,
        },
        select: {
          code: true,
          title: true,
          description: true,
          source_system: true,
          external_reference: true,
        },
      });
      if (!existing) {
        return null;
      }
      await this.ensureNoBlockingLock(tx, params.workspaceId, params.recordId, params.actorUserId);

      const data: Prisma.CommissionRecordUncheckedUpdateInput = {
        ...(params.title !== undefined ? { title: params.title } : {}),
        ...(params.description !== undefined ? { description: params.description } : {}),
        ...(params.status !== undefined ? { status: params.status } : {}),
        ...(params.priority !== undefined ? { priority: params.priority } : {}),
        ...(params.companyId !== undefined ? { company_id: params.companyId } : {}),
        ...(params.clientId !== undefined ? { client_id: params.clientId } : {}),
        ...(params.projectId !== undefined ? { project_id: params.projectId } : {}),
        ...(params.sourceSystem !== undefined ? { source_system: params.sourceSystem } : {}),
        ...(params.externalReference !== undefined ? { external_reference: params.externalReference } : {}),
        ...(params.expectedDeliveryAt !== undefined ? { expected_delivery_at: params.expectedDeliveryAt } : {}),
        ...(params.estimatedBudgetAmount !== undefined ? { estimated_budget_amount: params.estimatedBudgetAmount } : {}),
        ...(params.currency !== undefined ? { currency: params.currency } : {}),
        ...(params.metadata !== undefined ? { metadata: this.toNullableJson(params.metadata) } : {}),
        updated_by_user_id: params.actorUserId,
      };
      if (
        params.title !== undefined
        || params.description !== undefined
        || params.sourceSystem !== undefined
        || params.externalReference !== undefined
      ) {
        data.search_text = this.buildSearchText({
          code: existing.code,
          title: params.title ?? existing.title,
          description: params.description === undefined ? existing.description : params.description,
          sourceSystem: params.sourceSystem === undefined ? existing.source_system : params.sourceSystem,
          externalReference: params.externalReference === undefined ? existing.external_reference : params.externalReference,
        });
      }

      const row = await tx.commissionRecord.update({
        where: { id: params.recordId },
        data,
      });

      await this.recordEvent(tx, {
        workspaceId: params.workspaceId,
        recordId: params.recordId,
        checklistId: row.current_checklist_id,
        actorUserId: params.actorUserId,
        eventType: CommissionEventType.UPDATED,
        summary: "Commessa aggiornata.",
        payload: data,
      });

      return row;
    });

    return updated ? this.mapRecord(updated) : null;
  }

  public async softDeleteRecord(params: {
    workspaceId: string;
    recordId: string;
    actorUserId: string;
  }): Promise<boolean> {
    const prisma = PrismaClientManager.getClient();
    await this.ensureCanWrite(params.workspaceId, params.recordId, params.actorUserId);

    const now = new Date();
    const result = await prisma.$transaction(async (tx) => {
      await this.ensureNoBlockingLock(tx, params.workspaceId, params.recordId, params.actorUserId);
      const update = await tx.commissionRecord.updateMany({
        where: {
          id: params.recordId,
          workspace_id: params.workspaceId,
          deleted_at: null,
        },
        data: {
          deleted_at: now,
          updated_by_user_id: params.actorUserId,
        },
      });

      if (update.count === 0) {
        return false;
      }

      await tx.commissionChecklist.updateMany({
        where: {
          workspace_id: params.workspaceId,
          record_id: params.recordId,
          deleted_at: null,
        },
        data: { deleted_at: now, updated_by_user_id: params.actorUserId },
      });

      await tx.commissionRecordAccess.updateMany({
        where: {
          workspace_id: params.workspaceId,
          record_id: params.recordId,
          revoked_at: null,
        },
        data: { revoked_at: now },
      });

      await tx.commissionResourceLock.updateMany({
        where: {
          workspace_id: params.workspaceId,
          record_id: params.recordId,
          released_at: null,
        },
        data: {
          active_scope_key: null,
          released_at: now,
          release_reason: "record_deleted",
        },
      });

      await this.recordEvent(tx, {
        workspaceId: params.workspaceId,
        recordId: params.recordId,
        checklistId: null,
        actorUserId: params.actorUserId,
        eventType: CommissionEventType.DELETED,
        summary: "Commessa eliminata.",
        payload: null,
      });

      return true;
    });

    return result;
  }

  public async listEvents(params: {
    workspaceId: string;
    userId: string;
    recordId: string;
    limit: number;
  }): Promise<CommissionEventListItem[]> {
    await this.ensureCanRead(params.workspaceId, params.recordId, params.userId);
    const prisma = PrismaClientManager.getClient();
    const rows = await prisma.commissionEvent.findMany({
      where: {
        workspace_id: params.workspaceId,
        record_id: params.recordId,
      },
      orderBy: { created_at: "desc" },
      take: params.limit,
    });

    return rows.map((row) => ({
      id: row.id,
      eventType: row.event_type,
      actorUserId: row.actor_user_id,
      summary: row.summary,
      payload: row.payload,
      createdAt: row.created_at,
    }));
  }

  public async getChecklistView(params: {
    workspaceId: string;
    userId: string;
    recordId: string;
  }): Promise<CommissionChecklistView> {
    const prisma = PrismaClientManager.getClient();
    const record = await this.findRecordById(params);
    if (!record) {
      throw new AppError("Commessa non trovata o non accessibile.", "COMMISSION_RECORD_NOT_FOUND", 404);
    }

    const [currentUser, canReopenSignedChecklist] = await Promise.all([
      this.resolveCurrentUser(prisma, params.userId),
      this.canManageWorkspace(params.workspaceId, params.userId),
    ]);
    const checklist = await prisma.commissionChecklist.findFirst({
      where: {
        workspace_id: params.workspaceId,
        record_id: params.recordId,
        id: record.currentChecklistId ?? undefined,
        deleted_at: null,
      },
      orderBy: { revision_no: "desc" },
      select: {
        id: true,
        title: true,
        status: true,
        revision_no: true,
        progress_percent: true,
        current_page_number: true,
        signed_at: true,
        form_version_id: true,
      },
    });

    if (!checklist) {
      return { record, currentUser: { ...currentUser, canReopenSignedChecklist }, checklist: null, pages: [], values: [], tableRows: [], attachments: [], signatures: [] };
    }

    const pages = await prisma.commissionFormPage.findMany({
      where: { version_id: checklist.form_version_id },
      orderBy: [{ sort_order: "asc" }, { page_number: "asc" }],
      select: {
        id: true,
        page_number: true,
        key: true,
        title: true,
        description: true,
        sort_order: true,
      },
    });
    const pageIds = pages.map((page) => page.id);
    const [sections, fields, values, tableRows, attachments, signatures] = await Promise.all([
      prisma.commissionFormSection.findMany({
        where: { page_id: { in: pageIds } },
        orderBy: [{ page: { sort_order: "asc" } }, { sort_order: "asc" }],
        select: {
          id: true,
          page_id: true,
          key: true,
          title: true,
          description: true,
          sort_order: true,
        },
      }),
      prisma.commissionFormField.findMany({
        where: { version_id: checklist.form_version_id, page_id: { in: pageIds } },
        orderBy: [{ page: { sort_order: "asc" } }, { sort_order: "asc" }],
        include: {
          options: { orderBy: { sort_order: "asc" } },
          table_definition: {
            include: {
              columns: { orderBy: { sort_order: "asc" } },
            },
          },
        },
      }),
      prisma.commissionFieldValue.findMany({
        where: { workspace_id: params.workspaceId, record_id: params.recordId, checklist_id: checklist.id },
        orderBy: { updated_at: "desc" },
      }),
      prisma.commissionTableRow.findMany({
        where: { workspace_id: params.workspaceId, record_id: params.recordId, checklist_id: checklist.id, deleted_at: null },
        orderBy: [{ table_definition_id: "asc" }, { row_index: "asc" }],
        include: { cells: { orderBy: { column_key: "asc" } } },
      }),
      prisma.commissionAttachment.findMany({
        where: { workspace_id: params.workspaceId, record_id: params.recordId, checklist_id: checklist.id, deleted_at: null },
        orderBy: { created_at: "desc" },
        include: {
          document: {
            select: {
              id: true,
              filename: true,
              file_type: { select: { mime_type: true } },
              size_bytes: true,
            },
          },
        },
      }),
      prisma.commissionSignature.findMany({
        where: { workspace_id: params.workspaceId, record_id: params.recordId, checklist_id: checklist.id },
        orderBy: { signed_at: "desc" },
      }),
    ]);

    const sectionsByPage = new Map<string, typeof sections>();
    for (const section of sections) {
      sectionsByPage.set(section.page_id, [...(sectionsByPage.get(section.page_id) ?? []), section]);
    }

    const fieldsBySection = new Map<string, typeof fields>();
    const fieldsByPageWithoutSection = new Map<string, typeof fields>();
    for (const field of fields) {
      if (field.section_id) {
        fieldsBySection.set(field.section_id, [...(fieldsBySection.get(field.section_id) ?? []), field]);
      } else {
        fieldsByPageWithoutSection.set(field.page_id, [...(fieldsByPageWithoutSection.get(field.page_id) ?? []), field]);
      }
    }

    return {
      record,
      currentUser: { ...currentUser, canReopenSignedChecklist },
      checklist: {
        id: checklist.id,
        title: checklist.title,
        status: checklist.status,
        revisionNo: checklist.revision_no,
        progressPercent: checklist.progress_percent,
        currentPageNumber: checklist.current_page_number,
        signedAt: checklist.signed_at,
        formVersionId: checklist.form_version_id,
      },
      pages: pages.map((page) => {
        const mappedSections = (sectionsByPage.get(page.id) ?? []).map((section) => ({
          id: section.id,
          key: section.key,
          title: section.title,
          description: section.description,
          sortOrder: section.sort_order,
          fields: (fieldsBySection.get(section.id) ?? []).map((field) => this.mapFormField(field)),
        }));
        const unsectionedFields = fieldsByPageWithoutSection.get(page.id) ?? [];
        return {
          id: page.id,
          pageNumber: page.page_number,
          key: page.key,
          title: page.title,
          description: page.description,
          sortOrder: page.sort_order,
          sections: unsectionedFields.length > 0
            ? [
              ...mappedSections,
              {
                id: `${page.id}:fields`,
                key: `${page.key}:fields`,
                title: page.title,
                description: null,
                sortOrder: Number.MAX_SAFE_INTEGER,
                fields: unsectionedFields.map((field) => this.mapFormField(field)),
              },
            ]
            : mappedSections,
        };
      }),
      values: values.map((value) => this.mapFieldValue(value)),
      tableRows: tableRows.map((row) => this.mapTableRow(row)),
      attachments: attachments.map((attachment) => this.mapAttachment(attachment)),
      signatures: signatures.map((signature) => this.mapSignature(signature)),
    };
  }

  public async saveFieldValue(params: {
    workspaceId: string;
    recordId: string;
    checklistId: string;
    fieldId: string;
    actorUserId: string;
    value: unknown;
  }): Promise<CommissionSavedFieldValue> {
    const prisma = PrismaClientManager.getClient();
    await this.ensureCanWrite(params.workspaceId, params.recordId, params.actorUserId);

    const result = await prisma.$transaction(async (tx) => {
      const context = await this.resolveEditableField(tx, params);
      this.ensureChecklistEditable(context.checklist.status);
      if (context.field.field_type === CommissionFieldType.TABLE || context.field.field_type === CommissionFieldType.SIGNATURE) {
        throw new AppError("Questo campo richiede un endpoint dedicato.", "COMMISSION_FIELD_ENDPOINT_INVALID", 400);
      }
      await this.ensureNoBlockingLock(tx, params.workspaceId, params.recordId, params.actorUserId);
      await this.ensureOwnActiveChecklistLock(tx, params.workspaceId, params.recordId, params.checklistId, params.actorUserId);

      const normalized = this.normalizeValueForStorage(params.value, context.field.data_kind, context.field.field_type);
      const fieldValue = await tx.commissionFieldValue.upsert({
        where: {
          checklist_id_field_id: {
            checklist_id: params.checklistId,
            field_id: params.fieldId,
          },
        },
        update: {
          ...normalized,
          updated_by_user_id: params.actorUserId,
        },
        create: {
          workspace_id: params.workspaceId,
          record_id: params.recordId,
          checklist_id: params.checklistId,
          field_id: params.fieldId,
          field_key: context.field.key,
          ...normalized,
          updated_by_user_id: params.actorUserId,
        },
      });

      const progressPercent = await this.updateChecklistProgress(tx, params.workspaceId, params.recordId, params.checklistId);
      await this.recordEvent(tx, {
        workspaceId: params.workspaceId,
        recordId: params.recordId,
        checklistId: params.checklistId,
        actorUserId: params.actorUserId,
        eventType: CommissionEventType.FIELD_CHANGED,
        summary: `Campo aggiornato: ${context.field.label}.`,
        payload: { fieldId: params.fieldId, fieldKey: context.field.key, displayValue: normalized.display_value },
      });

      return { fieldValue, progressPercent };
    });

    return { fieldValue: this.mapFieldValue(result.fieldValue), progressPercent: result.progressPercent };
  }

  public async replaceTableRows(params: {
    workspaceId: string;
    recordId: string;
    checklistId: string;
    tableDefinitionId: string;
    actorUserId: string;
    rows: Array<{ rowKey?: string | null; cells: Record<string, unknown> }>;
  }): Promise<CommissionTableRowItem[]> {
    const prisma = PrismaClientManager.getClient();
    await this.ensureCanWrite(params.workspaceId, params.recordId, params.actorUserId);

    return prisma.$transaction(async (tx) => {
      const checklist = await this.resolveChecklist(tx, params.workspaceId, params.recordId, params.checklistId);
      this.ensureChecklistEditable(checklist.status);
      const table = await tx.commissionTableDefinition.findFirst({
        where: {
          id: params.tableDefinitionId,
          field: { version_id: checklist.form_version_id },
        },
        include: {
          field: { select: { id: true, key: true, label: true } },
          columns: { orderBy: { sort_order: "asc" } },
        },
      });
      if (!table) {
        throw new AppError("Tabella non trovata nella checklist.", "COMMISSION_TABLE_NOT_FOUND", 404);
      }
      if (table.max_rows !== null && params.rows.length > table.max_rows) {
        throw new AppError("Sono state inviate troppe righe per questa tabella.", "COMMISSION_TABLE_TOO_MANY_ROWS", 400);
      }
      await this.ensureNoBlockingLock(tx, params.workspaceId, params.recordId, params.actorUserId);
      await this.ensureOwnActiveChecklistLock(tx, params.workspaceId, params.recordId, params.checklistId, params.actorUserId);

      const existingRows = await tx.commissionTableRow.findMany({
        where: {
          workspace_id: params.workspaceId,
          record_id: params.recordId,
          checklist_id: params.checklistId,
          table_definition_id: params.tableDefinitionId,
        },
        select: { id: true },
      });
      if (existingRows.length > 0) {
        await tx.commissionTableCell.deleteMany({ where: { row_id: { in: existingRows.map((row) => row.id) } } });
        await tx.commissionTableRow.deleteMany({ where: { id: { in: existingRows.map((row) => row.id) } } });
      }

      const createdRows = [];
      for (const [rowIndex, rowInput] of params.rows.entries()) {
        const row = await tx.commissionTableRow.create({
          data: {
            workspace_id: params.workspaceId,
            record_id: params.recordId,
            checklist_id: params.checklistId,
            table_definition_id: params.tableDefinitionId,
            row_index: rowIndex + 1,
            row_key: this.normalizeOptionalString(rowInput.rowKey),
            created_by_user_id: params.actorUserId,
            updated_by_user_id: params.actorUserId,
          },
        });

        for (const column of table.columns) {
          const normalized = this.normalizeValueForStorage(rowInput.cells[column.key] ?? null, column.data_kind, null);
          await tx.commissionTableCell.create({
            data: {
              workspace_id: params.workspaceId,
              record_id: params.recordId,
              checklist_id: params.checklistId,
              row_id: row.id,
              column_id: column.id,
              field_id: table.field.id,
              column_key: column.key,
              ...normalized,
              updated_by_user_id: params.actorUserId,
            },
          });
        }
        createdRows.push(row);
      }

      await this.updateChecklistProgress(tx, params.workspaceId, params.recordId, params.checklistId);
      await this.recordEvent(tx, {
        workspaceId: params.workspaceId,
        recordId: params.recordId,
        checklistId: params.checklistId,
        actorUserId: params.actorUserId,
        eventType: CommissionEventType.TABLE_ROW_UPDATED,
        summary: `Tabella aggiornata: ${table.title}.`,
        payload: { tableDefinitionId: table.id, tableKey: table.key, rows: createdRows.length },
      });

      const rows = await tx.commissionTableRow.findMany({
        where: {
          workspace_id: params.workspaceId,
          record_id: params.recordId,
          checklist_id: params.checklistId,
          table_definition_id: params.tableDefinitionId,
          deleted_at: null,
        },
        orderBy: { row_index: "asc" },
        include: { cells: { orderBy: { column_key: "asc" } } },
      });
      return rows.map((row) => this.mapTableRow(row));
    });
  }

  public async createAttachment(params: {
    workspaceId: string;
    recordId: string;
    checklistId: string;
    actorUserId: string;
    fieldKey?: string | null;
    label?: string | null;
    note?: string | null;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    checksumSha256: string;
    storagePath: string;
  }): Promise<CommissionAttachmentItem> {
    const prisma = PrismaClientManager.getClient();
    await this.ensureCanWrite(params.workspaceId, params.recordId, params.actorUserId);

    const created = await prisma.$transaction(async (tx) => {
      const checklist = await this.resolveChecklist(tx, params.workspaceId, params.recordId, params.checklistId);
      this.ensureChecklistEditable(checklist.status);
      await this.ensureNoBlockingLock(tx, params.workspaceId, params.recordId, params.actorUserId);
      await this.ensureOwnActiveChecklistLock(tx, params.workspaceId, params.recordId, params.checklistId, params.actorUserId);

      const node = await this.ensureCommissionDocumentNode(tx, params.workspaceId, params.recordId);
      const extension = this.resolveFileExtension(params.fileName, params.mimeType);
      const [fileType, fileStatus, moduleRow] = await Promise.all([
        tx.fileType.upsert({
          where: { key: extension },
          update: { mime_type: params.mimeType || "application/octet-stream" },
          create: { key: extension, mime_type: params.mimeType || "application/octet-stream" },
        }),
        tx.fileStatus.upsert({
          where: { key: "uploaded" },
          update: {},
          create: { key: "uploaded" },
        }),
        tx.module.findFirst({
          where: { key: ModuleKey.COMMISSION_INTAKE, is_active: true },
          select: { id: true },
        }),
      ]);

      const document = await tx.document.create({
        data: {
          workspace_id: params.workspaceId,
          node_id: node.id,
          file_type_id: fileType.id,
          file_status_id: fileStatus.id,
          module_id: moduleRow?.id ?? null,
          scope: DocumentScope.COMMISSION_INTAKE,
          domain_entity_type: "CommissionRecord",
          domain_entity_id: params.recordId,
          filename: params.fileName,
          size_bytes: BigInt(params.sizeBytes),
          storage_path: params.storagePath,
          checksum_sha256: params.checksumSha256,
          uploaded_by_user_id: params.actorUserId,
        },
        select: { id: true },
      });

      const attachment = await tx.commissionAttachment.create({
        data: {
          workspace_id: params.workspaceId,
          record_id: params.recordId,
          checklist_id: params.checklistId,
          document_id: document.id,
          label: this.normalizeOptionalString(params.fieldKey),
          note: this.normalizeOptionalString(params.note) ?? this.normalizeOptionalString(params.label),
          uploaded_by_user_id: params.actorUserId,
        },
        include: {
          document: {
            select: {
              id: true,
              filename: true,
              file_type: { select: { mime_type: true } },
              size_bytes: true,
            },
          },
        },
      });

      await this.recordEvent(tx, {
        workspaceId: params.workspaceId,
        recordId: params.recordId,
        checklistId: params.checklistId,
        actorUserId: params.actorUserId,
        eventType: CommissionEventType.ATTACHMENT_ADDED,
        summary: `Allegato caricato: ${params.fileName}.`,
        payload: { attachmentId: attachment.id, documentId: document.id, fieldKey: params.fieldKey ?? null },
      });

      return attachment;
    });

    return this.mapAttachment(created);
  }

  public async deleteAttachment(params: {
    workspaceId: string;
    recordId: string;
    attachmentId: string;
    actorUserId: string;
  }): Promise<{ storagePath: string } | null> {
    const prisma = PrismaClientManager.getClient();
    await this.ensureCanWrite(params.workspaceId, params.recordId, params.actorUserId);

    return prisma.$transaction(async (tx) => {
      const attachment = await tx.commissionAttachment.findFirst({
        where: {
          id: params.attachmentId,
          workspace_id: params.workspaceId,
          record_id: params.recordId,
          deleted_at: null,
        },
        include: { document: { select: { id: true, storage_path: true } } },
      });
      if (!attachment) return null;

      if (attachment.checklist_id) {
        const checklist = await this.resolveChecklist(tx, params.workspaceId, params.recordId, attachment.checklist_id);
        this.ensureChecklistEditable(checklist.status);
        await this.ensureNoBlockingLock(tx, params.workspaceId, params.recordId, params.actorUserId);
        await this.ensureOwnActiveChecklistLock(tx, params.workspaceId, params.recordId, attachment.checklist_id, params.actorUserId);
      }

      await tx.commissionAttachment.update({
        where: { id: attachment.id },
        data: { deleted_at: new Date() },
      });
      await tx.document.update({
        where: { id: attachment.document_id },
        data: { deleted_at: new Date() },
      });

      await this.recordEvent(tx, {
        workspaceId: params.workspaceId,
        recordId: params.recordId,
        checklistId: attachment.checklist_id,
        actorUserId: params.actorUserId,
        eventType: CommissionEventType.ATTACHMENT_REMOVED,
        summary: "Allegato rimosso.",
        payload: { attachmentId: attachment.id, documentId: attachment.document_id },
      });

      return { storagePath: attachment.document.storage_path };
    });
  }

  public async signChecklist(params: {
    workspaceId: string;
    recordId: string;
    checklistId: string;
    actorUserId: string;
    statement?: string | null;
  }): Promise<CommissionSignatureItem> {
    const prisma = PrismaClientManager.getClient();
    await this.ensureCanWrite(params.workspaceId, params.recordId, params.actorUserId);

    const signature = await prisma.$transaction(async (tx) => {
      const checklist = await this.resolveChecklist(tx, params.workspaceId, params.recordId, params.checklistId);
      this.ensureChecklistEditable(checklist.status);
      await this.ensureNoBlockingLock(tx, params.workspaceId, params.recordId, params.actorUserId);
      await this.ensureOwnActiveChecklistLock(tx, params.workspaceId, params.recordId, params.checklistId, params.actorUserId);
      const progressPercent = await this.updateChecklistProgress(tx, params.workspaceId, params.recordId, params.checklistId);
      if (progressPercent < 100) {
        throw new AppError("Completa tutti i campi obbligatori prima della firma definitiva.", "COMMISSION_CHECKLIST_INCOMPLETE", 400);
      }
      const signer = await this.resolveCurrentUser(tx, params.actorUserId);
      await tx.commissionSignature.deleteMany({
        where: {
          workspace_id: params.workspaceId,
          record_id: params.recordId,
          checklist_id: params.checklistId,
        },
      });
      const row = await tx.commissionSignature.create({
        data: {
          workspace_id: params.workspaceId,
          record_id: params.recordId,
          checklist_id: params.checklistId,
          signed_by_user_id: params.actorUserId,
          signer_name: signer.fullName,
          signer_role: null,
          statement: this.normalizeOptionalString(params.statement),
        },
      });

      await tx.commissionChecklist.update({
        where: { id: params.checklistId },
        data: { status: CommissionChecklistStatus.SIGNED, signed_at: row.signed_at, updated_by_user_id: params.actorUserId },
      });
      await tx.commissionRecord.update({
        where: { id: params.recordId },
        data: { status: CommissionRecordStatus.SIGNED, updated_by_user_id: params.actorUserId },
      });
      await this.recordEvent(tx, {
        workspaceId: params.workspaceId,
        recordId: params.recordId,
        checklistId: params.checklistId,
        actorUserId: params.actorUserId,
        eventType: CommissionEventType.SIGNED,
        summary: `Checklist firmata da ${signer.fullName}.`,
        payload: { signerName: signer.fullName },
      });
      return row;
    });

    return this.mapSignature(signature);
  }

  public async reopenChecklist(params: {
    workspaceId: string;
    recordId: string;
    checklistId: string;
    actorUserId: string;
  }): Promise<void> {
    const prisma = PrismaClientManager.getClient();
    const canManage = await this.canManageWorkspace(params.workspaceId, params.actorUserId);
    if (!canManage) {
      throw new AppError("Solo un admin può riaprire una checklist firmata.", "COMMISSION_CHECKLIST_REOPEN_FORBIDDEN", 403);
    }

    await prisma.$transaction(async (tx) => {
      const checklist = await this.resolveChecklist(tx, params.workspaceId, params.recordId, params.checklistId);
      if (checklist.status !== CommissionChecklistStatus.SIGNED) {
        throw new AppError("Solo una checklist firmata può essere riaperta.", "COMMISSION_CHECKLIST_REOPEN_INVALID_STATUS", 409);
      }

      await this.ensureNoBlockingLock(tx, params.workspaceId, params.recordId, params.actorUserId);

      await tx.commissionChecklist.update({
        where: { id: params.checklistId },
        data: {
          status: CommissionChecklistStatus.IN_PROGRESS,
          signed_at: null,
          updated_by_user_id: params.actorUserId,
        },
      });

      await tx.commissionRecord.update({
        where: { id: params.recordId },
        data: {
          status: CommissionRecordStatus.IN_PROGRESS,
          updated_by_user_id: params.actorUserId,
        },
      });

      await this.recordEvent(tx, {
        workspaceId: params.workspaceId,
        recordId: params.recordId,
        checklistId: params.checklistId,
        actorUserId: params.actorUserId,
        eventType: CommissionEventType.STATUS_CHANGED,
        summary: "Checklist riaperta.",
        payload: { from: CommissionChecklistStatus.SIGNED, to: CommissionChecklistStatus.IN_PROGRESS },
      });
    });
  }

  public async acquireLock(params: {
    workspaceId: string;
    recordId: string;
    userId: string;
    resourceType: CommissionLockResourceType;
    resourceId: string;
    lockTokenHash: string;
    lockToken: string;
    expiresAt: Date;
  }): Promise<CommissionLockResult> {
    const prisma = PrismaClientManager.getClient();
    await this.ensureCanWrite(params.workspaceId, params.recordId, params.userId);
    await this.ensureLockResourceBelongsToRecord(prisma, {
      workspaceId: params.workspaceId,
      recordId: params.recordId,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
    });

    const activeScopeKey = this.lockScopeKey(params.workspaceId, params.recordId, params.resourceType, params.resourceId);
    const now = new Date();
    await prisma.commissionResourceLock.updateMany({
      where: {
        active_scope_key: activeScopeKey,
        expires_at: { lte: now },
        released_at: null,
      },
      data: {
        active_scope_key: null,
        released_at: now,
        release_reason: "expired",
      },
    });
    await this.ensureNoBlockingLock(prisma, params.workspaceId, params.recordId, params.userId);

    const existingOwnLock = await prisma.commissionResourceLock.findFirst({
      where: {
        active_scope_key: activeScopeKey,
        locked_by_user_id: params.userId,
        released_at: null,
        expires_at: { gt: now },
      },
    });
    if (existingOwnLock) {
      const lock = await prisma.commissionResourceLock.update({
        where: { id: existingOwnLock.id },
        data: {
          lock_token_hash: params.lockTokenHash,
          expires_at: params.expiresAt,
          heartbeat_at: now,
        },
      });
      return {
        id: lock.id,
        resourceType: lock.resource_type,
        resourceId: lock.resource_id,
        lockToken: params.lockToken,
        expiresAt: lock.expires_at,
      };
    }

    try {
      const lock = await prisma.commissionResourceLock.create({
        data: {
          workspace_id: params.workspaceId,
          record_id: params.recordId,
          checklist_id: params.resourceType === CommissionLockResourceType.CHECKLIST ? params.resourceId : null,
          resource_type: params.resourceType,
          resource_id: params.resourceId,
          active_scope_key: activeScopeKey,
          lock_token_hash: params.lockTokenHash,
          locked_by_user_id: params.userId,
          expires_at: params.expiresAt,
        },
      });

      await this.recordEvent(prisma, {
        workspaceId: params.workspaceId,
        recordId: params.recordId,
        checklistId: lock.checklist_id,
        actorUserId: params.userId,
        eventType: CommissionEventType.LOCK_ACQUIRED,
        summary: "Blocco modifica acquisito.",
        payload: { resourceType: params.resourceType, resourceId: params.resourceId },
      });

      return {
        id: lock.id,
        resourceType: lock.resource_type,
        resourceId: lock.resource_id,
        lockToken: params.lockToken,
        expiresAt: lock.expires_at,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new AppError("Questa risorsa è già in modifica da un altro utente.", "COMMISSION_RESOURCE_LOCKED", 409);
      }

      throw error;
    }
  }

  public async releaseOwnActiveLock(params: {
    workspaceId: string;
    recordId: string;
    userId: string;
    resourceType: CommissionLockResourceType;
    resourceId?: string | null;
    reason?: string | null;
  }): Promise<boolean> {
    const prisma = PrismaClientManager.getClient();
    const now = new Date();
    const lock = await prisma.commissionResourceLock.findFirst({
      where: {
        workspace_id: params.workspaceId,
        record_id: params.recordId,
        locked_by_user_id: params.userId,
        resource_type: params.resourceType,
        ...(params.resourceId ? { resource_id: params.resourceId } : {}),
        released_at: null,
        expires_at: { gt: now },
      },
      orderBy: { heartbeat_at: "desc" },
    });

    if (!lock) {
      return false;
    }

    await prisma.commissionResourceLock.update({
      where: { id: lock.id },
      data: {
        active_scope_key: null,
        released_at: now,
        release_reason: params.reason ?? "released",
      },
    });

    await this.recordEvent(prisma, {
      workspaceId: params.workspaceId,
      recordId: lock.record_id,
      checklistId: lock.checklist_id,
      actorUserId: params.userId,
      eventType: CommissionEventType.LOCK_RELEASED,
      summary: "Blocco modifica rilasciato.",
      payload: { resourceType: lock.resource_type, resourceId: lock.resource_id },
    });

    return true;
  }

  public async resolvePublishedTemplateVersion(params: {
    workspaceId: string;
    formVersionId?: string | null;
  }): Promise<{ id: string; title: string } | null> {
    const prisma = PrismaClientManager.getClient();
    if (params.formVersionId) {
      return this.findPublishedTemplateVersion(prisma, params.workspaceId, params.formVersionId);
    }

    const workspaceVersion = await prisma.commissionFormVersion.findFirst({
      where: {
        workspace_id: params.workspaceId,
        status: "PUBLISHED",
        template: {
          is_active: true,
          deleted_at: null,
        },
      },
      orderBy: { version: "desc" },
      select: { id: true, title: true },
    });

    if (workspaceVersion) {
      return workspaceVersion;
    }

    return prisma.commissionFormVersion.findFirst({
      where: {
        workspace_id: null,
        status: "PUBLISHED",
        template: {
          is_active: true,
          deleted_at: null,
        },
      },
      orderBy: { version: "desc" },
      select: { id: true, title: true },
    });
  }

  public async createChecklistForRecord(params: {
    workspaceId: string;
    recordId: string;
    formVersionId: string;
    title: string;
    status?: CommissionChecklistStatus;
    actorUserId: string;
  }): Promise<string> {
    const prisma = PrismaClientManager.getClient();
    await this.ensureCanWrite(params.workspaceId, params.recordId, params.actorUserId);
    const checklist = await prisma.commissionChecklist.create({
      data: {
        workspace_id: params.workspaceId,
        record_id: params.recordId,
        form_version_id: params.formVersionId,
        title: params.title,
        status: params.status ?? CommissionChecklistStatus.DRAFT,
        created_by_user_id: params.actorUserId,
        updated_by_user_id: params.actorUserId,
      },
    });

    await prisma.commissionRecord.update({
      where: { id: params.recordId },
      data: { current_checklist_id: checklist.id },
    });

    return checklist.id;
  }

  private async ensureCanRead(workspaceId: string, recordId: string, userId: string): Promise<void> {
    const prisma = PrismaClientManager.getClient();
    const record = await prisma.commissionRecord.findFirst({
      where: {
        workspace_id: workspaceId,
        id: recordId,
        deleted_at: null,
      },
      select: { id: true },
    });

    if (!record) {
      throw new AppError("Commessa non trovata o non accessibile.", "COMMISSION_RECORD_NOT_FOUND", 404);
    }
  }

  private async ensureCanWrite(workspaceId: string, recordId: string, userId: string): Promise<void> {
    const prisma = PrismaClientManager.getClient();
    const record = await prisma.commissionRecord.findFirst({
      where: {
        workspace_id: workspaceId,
        id: recordId,
        deleted_at: null,
      },
      select: { id: true },
    });

    if (!record) {
      throw new AppError("Commessa non trovata o non modificabile.", "COMMISSION_RECORD_NOT_WRITABLE", 404);
    }
  }

  private async ensureNoBlockingLock(
    prisma: Prisma.TransactionClient | ReturnType<typeof PrismaClientManager.getClient>,
    workspaceId: string,
    recordId: string,
    userId: string,
  ): Promise<void> {
    const now = new Date();
    await prisma.commissionResourceLock.updateMany({
      where: {
        workspace_id: workspaceId,
        record_id: recordId,
        released_at: null,
        expires_at: { lte: now },
      },
      data: {
        active_scope_key: null,
        released_at: now,
        release_reason: "expired",
      },
    });

    const blockingLock = await prisma.commissionResourceLock.findFirst({
      where: {
        workspace_id: workspaceId,
        record_id: recordId,
        released_at: null,
        expires_at: { gt: now },
        locked_by_user_id: { not: userId },
      },
      select: { id: true },
    });

    if (blockingLock) {
      throw new AppError("Questa commessa è in modifica da un altro utente.", "COMMISSION_RESOURCE_LOCKED", 409);
    }
  }

  private async ensureOwnActiveChecklistLock(
    prisma: Prisma.TransactionClient,
    workspaceId: string,
    recordId: string,
    checklistId: string,
    userId: string,
  ): Promise<void> {
    const lock = await prisma.commissionResourceLock.findFirst({
      where: {
        workspace_id: workspaceId,
        record_id: recordId,
        resource_type: CommissionLockResourceType.CHECKLIST,
        resource_id: checklistId,
        locked_by_user_id: userId,
        released_at: null,
        expires_at: { gt: new Date() },
      },
      select: { id: true },
    });

    if (!lock) {
      throw new AppError("Apri la checklist in modifica prima di salvare.", "COMMISSION_LOCK_REQUIRED", 409);
    }
  }

  private async canManageWorkspace(workspaceId: string, userId: string): Promise<boolean> {
    const prisma = PrismaClientManager.getClient();
    const count = await prisma.userWorkspaceRole.count({
      where: {
        workspace_id: workspaceId,
        user_id: userId,
        user: {
          is_active: true,
          deleted_at: null,
          memberships: {
            some: {
              workspace_id: workspaceId,
              status: "ACTIVE",
            },
          },
        },
        role: {
          key: { in: ["developer", "superuser", "admin"] },
        },
      },
    });

    return count > 0;
  }

  private async findOrCreateCompanyByName(
    prisma: Prisma.TransactionClient,
    workspaceId: string,
    companyName: string | null,
  ): Promise<number | null> {
    const name = companyName?.trim().replace(/\s+/g, " ") ?? "";
    if (!name) {
      return null;
    }

    const existing = await prisma.company.findFirst({
      where: {
        workspace_id: workspaceId,
        deleted_at: null,
        name: { equals: name, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (existing) {
      return existing.id;
    }

    const created = await prisma.company.create({
      data: {
        workspace_id: workspaceId,
        name,
      },
      select: { id: true },
    });

    return created.id;
  }

  private async ensureRelatedEntities(
    prisma: Prisma.TransactionClient,
    params: {
      workspaceId: string;
      companyId?: number | null;
      clientId?: string | null;
      projectId?: string | null;
    },
  ): Promise<void> {
    if (params.companyId) {
      const company = await prisma.company.findFirst({
        where: { workspace_id: params.workspaceId, id: params.companyId, deleted_at: null },
        select: { id: true },
      });
      if (!company) {
        throw new AppError("Azienda non trovata nel workspace.", "COMMISSION_COMPANY_NOT_FOUND", 404);
      }
    }

    if (params.clientId) {
      const client = await prisma.client.findFirst({
        where: { workspace_id: params.workspaceId, id: params.clientId, deleted_at: null },
        select: { id: true },
      });
      if (!client) {
        throw new AppError("Cliente non trovato nel workspace.", "COMMISSION_CLIENT_NOT_FOUND", 404);
      }
    }

    if (params.projectId) {
      const project = await prisma.project.findFirst({
        where: { workspace_id: params.workspaceId, id: params.projectId, deleted_at: null },
        select: { id: true },
      });
      if (!project) {
        throw new AppError("Progetto non trovato nel workspace.", "COMMISSION_PROJECT_NOT_FOUND", 404);
      }
    }
  }

  private async resolveCurrentUser(
    prisma: Prisma.TransactionClient | ReturnType<typeof PrismaClientManager.getClient>,
    userId: string,
  ): Promise<{ id: string; fullName: string }> {
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        deleted_at: null,
      },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
      },
    });

    if (!user) {
      throw new AppError("Utente firmatario non trovato.", "COMMISSION_SIGNER_NOT_FOUND", 404);
    }

    const fullName = [user.first_name, user.last_name ?? ""].join(" ").trim() || user.email;
    return { id: user.id, fullName };
  }

  private async ensureUserActiveInWorkspace(
    prisma: Prisma.TransactionClient,
    workspaceId: string,
    userId: string,
  ): Promise<void> {
    const membership = await prisma.workspaceMembership.findFirst({
      where: {
        workspace_id: workspaceId,
        user_id: userId,
        status: "ACTIVE",
        user: {
          is_active: true,
          deleted_at: null,
        },
      },
      select: { id: true },
    });

    if (!membership) {
      throw new AppError("L'utente assegnato non appartiene al workspace o non è attivo.", "COMMISSION_OWNER_NOT_IN_WORKSPACE", 400);
    }
  }

  private async ensureLockResourceBelongsToRecord(
    prisma: ReturnType<typeof PrismaClientManager.getClient>,
    params: {
      workspaceId: string;
      recordId: string;
      resourceType: CommissionLockResourceType;
      resourceId: string;
    },
  ): Promise<void> {
    if (params.resourceType === CommissionLockResourceType.RECORD) {
      if (params.resourceId !== params.recordId) {
        throw new AppError("Il lock RECORD deve puntare alla commessa corrente.", "COMMISSION_LOCK_RESOURCE_INVALID", 400);
      }
      return;
    }

    if (params.resourceType === CommissionLockResourceType.CHECKLIST) {
      const checklist = await prisma.commissionChecklist.findFirst({
        where: {
          workspace_id: params.workspaceId,
          record_id: params.recordId,
          id: params.resourceId,
          deleted_at: null,
        },
        select: { id: true },
      });
      if (!checklist) {
        throw new AppError("Checklist non trovata per questa commessa.", "COMMISSION_LOCK_RESOURCE_INVALID", 400);
      }
      return;
    }

    const page = await prisma.commissionFormPage.findFirst({
      where: {
        id: params.resourceId,
        version: {
          checklists: {
            some: {
              workspace_id: params.workspaceId,
              record_id: params.recordId,
              deleted_at: null,
            },
          },
        },
      },
      select: { id: true },
    });

    if (!page) {
      throw new AppError("Pagina form non trovata per questa commessa.", "COMMISSION_LOCK_RESOURCE_INVALID", 400);
    }
  }

  private async resolveChecklist(
    prisma: Prisma.TransactionClient,
    workspaceId: string,
    recordId: string,
    checklistId: string,
  ): Promise<{ id: string; form_version_id: string; status: CommissionChecklistStatus }> {
    const checklist = await prisma.commissionChecklist.findFirst({
      where: {
        id: checklistId,
        workspace_id: workspaceId,
        record_id: recordId,
        deleted_at: null,
      },
      select: { id: true, form_version_id: true, status: true },
    });

    if (!checklist) {
      throw new AppError("Checklist non trovata per questa commessa.", "COMMISSION_CHECKLIST_NOT_FOUND", 404);
    }

    return checklist;
  }

  private async resolveEditableField(
    prisma: Prisma.TransactionClient,
    params: {
      workspaceId: string;
      recordId: string;
      checklistId: string;
      fieldId: string;
    },
  ): Promise<{ checklist: { id: string; form_version_id: string; status: CommissionChecklistStatus }; field: { id: string; key: string; label: string; field_type: CommissionFieldType; data_kind: CommissionDataKind; is_required: boolean } }> {
    const checklist = await this.resolveChecklist(prisma, params.workspaceId, params.recordId, params.checklistId);
    const field = await prisma.commissionFormField.findFirst({
      where: {
        id: params.fieldId,
        version_id: checklist.form_version_id,
      },
      select: {
        id: true,
        key: true,
        label: true,
        field_type: true,
        data_kind: true,
        is_required: true,
      },
    });

    if (!field) {
      throw new AppError("Campo non trovato nella checklist.", "COMMISSION_FIELD_NOT_FOUND", 404);
    }

    return { checklist, field };
  }

  private ensureChecklistEditable(status: CommissionChecklistStatus): void {
    if (status === CommissionChecklistStatus.SIGNED || status === CommissionChecklistStatus.ARCHIVED) {
      throw new AppError("Checklist già firmata: non può essere modificata.", "COMMISSION_CHECKLIST_FINALIZED", 409);
    }
  }

  private async updateChecklistProgress(
    prisma: Prisma.TransactionClient,
    workspaceId: string,
    recordId: string,
    checklistId: string,
  ): Promise<number> {
    const checklist = await this.resolveChecklist(prisma, workspaceId, recordId, checklistId);
    const requiredFields = await prisma.commissionFormField.findMany({
      where: {
        version_id: checklist.form_version_id,
        is_required: true,
        field_type: { notIn: [CommissionFieldType.SIGNATURE] },
      },
      select: { id: true, field_type: true },
    });

    if (requiredFields.length === 0) {
      await prisma.commissionChecklist.update({
        where: { id: checklistId },
        data: { progress_percent: 0 },
      });
      return 0;
    }

    const requiredFieldIds = requiredFields.map((field) => field.id);
    const [values, tableRows] = await Promise.all([
      prisma.commissionFieldValue.findMany({
        where: {
          checklist_id: checklistId,
          field_id: { in: requiredFieldIds },
        },
        select: {
          field_id: true,
          value_text: true,
          value_number: true,
          value_date: true,
          value_boolean: true,
          value_json: true,
        },
      }),
      prisma.commissionTableRow.findMany({
        where: {
          checklist_id: checklistId,
          table_definition: { field_id: { in: requiredFieldIds } },
          deleted_at: null,
        },
        select: {
          table_definition: { select: { field_id: true } },
        },
      }),
    ]);

    const completedFieldIds = new Set<string>();
    for (const value of values) {
      if (
        this.hasStoredValue(value.value_text)
        || value.value_number !== null
        || value.value_date !== null
        || value.value_boolean !== null
        || value.value_json !== null
      ) {
        completedFieldIds.add(value.field_id);
      }
    }
    for (const row of tableRows) {
      completedFieldIds.add(row.table_definition.field_id);
    }

    const progressPercent = Math.round((completedFieldIds.size / requiredFields.length) * 100);
    await prisma.commissionChecklist.update({
      where: { id: checklistId },
      data: {
        progress_percent: progressPercent,
        status: progressPercent > 0 ? CommissionChecklistStatus.IN_PROGRESS : CommissionChecklistStatus.DRAFT,
      },
    });

    return progressPercent;
  }

  private async findPublishedTemplateVersion(
    prisma: Prisma.TransactionClient | ReturnType<typeof PrismaClientManager.getClient>,
    workspaceId: string,
    formVersionId: string,
  ): Promise<{ id: string; title: string } | null> {
    return prisma.commissionFormVersion.findFirst({
      where: {
        id: formVersionId,
        status: "PUBLISHED",
        OR: [
          { workspace_id: null },
          { workspace_id: workspaceId },
        ],
        template: {
          is_active: true,
          deleted_at: null,
        },
      },
      select: { id: true, title: true },
    });
  }

  private async recordEvent(
    prisma: Prisma.TransactionClient | ReturnType<typeof PrismaClientManager.getClient>,
    params: {
      workspaceId: string;
      recordId: string | null;
      checklistId: string | null;
      eventType: CommissionEventType;
      actorUserId: string | null;
      summary: string;
      payload: unknown;
    },
  ): Promise<void> {
    await prisma.commissionEvent.create({
      data: {
        workspace_id: params.workspaceId,
        record_id: params.recordId,
        checklist_id: params.checklistId,
        event_type: params.eventType,
        actor_user_id: params.actorUserId,
        summary: params.summary,
        payload: this.toNullableJson(params.payload),
      },
    });
  }

  private buildSearchText(params: {
    code: string | null;
    title: string | null;
    description: string | null;
    sourceSystem: string | null;
    externalReference: string | null;
  }): string {
    return [
      params.code,
      params.title,
      params.description,
      params.sourceSystem,
      params.externalReference,
    ].filter((item) => typeof item === "string" && item.trim().length > 0).join(" ");
  }

  private toNullableJson(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
    if (value === null || typeof value === "undefined") {
      return Prisma.JsonNull;
    }

    return value as Prisma.InputJsonValue;
  }

  private normalizeValueForStorage(
    value: unknown,
    dataKind: CommissionDataKind,
    fieldType: CommissionFieldType | null,
  ): Pick<Prisma.CommissionFieldValueUncheckedCreateInput, "value_text" | "value_number" | "value_date" | "value_boolean" | "value_json" | "normalized_value" | "display_value"> {
    if (fieldType === CommissionFieldType.MULTI_SELECT || fieldType === CommissionFieldType.CHECKBOX_GROUP || fieldType === CommissionFieldType.DOCUMENT_CHECKLIST || dataKind === CommissionDataKind.JSON) {
      const jsonValue = value === undefined ? null : value;
      const displayValue = Array.isArray(jsonValue) ? jsonValue.join(", ") : this.displayValue(jsonValue);
      return {
        value_text: null,
        value_number: null,
        value_date: null,
        value_boolean: null,
        value_json: this.toNullableJson(jsonValue),
        normalized_value: this.normalizeForIndex(displayValue),
        display_value: displayValue,
      };
    }

    if (dataKind === CommissionDataKind.BOOLEAN || fieldType === CommissionFieldType.BOOLEAN) {
      const booleanValue = typeof value === "boolean" ? value : value === "true" ? true : value === "false" ? false : null;
      return {
        value_text: null,
        value_number: null,
        value_date: null,
        value_boolean: booleanValue,
        value_json: Prisma.JsonNull,
        normalized_value: booleanValue === null ? null : String(booleanValue),
        display_value: booleanValue === null ? null : booleanValue ? "Sì" : "No",
      };
    }

    if (dataKind === CommissionDataKind.INTEGER || dataKind === CommissionDataKind.DECIMAL || fieldType === CommissionFieldType.NUMBER) {
      const text = this.normalizeOptionalString(value);
      if (text !== null && !/^-?\d+(\.\d+)?$/.test(text)) {
        throw new AppError("Valore numerico non valido.", "COMMISSION_VALUE_NUMBER_INVALID", 400);
      }
      return {
        value_text: null,
        value_number: text,
        value_date: null,
        value_boolean: null,
        value_json: Prisma.JsonNull,
        normalized_value: text,
        display_value: text,
      };
    }

    if (dataKind === CommissionDataKind.DATE || fieldType === CommissionFieldType.DATE) {
      const text = this.normalizeOptionalString(value);
      const date = text ? new Date(text) : null;
      if (date && Number.isNaN(date.getTime())) {
        throw new AppError("Data non valida.", "COMMISSION_VALUE_DATE_INVALID", 400);
      }
      return {
        value_text: null,
        value_number: null,
        value_date: date,
        value_boolean: null,
        value_json: Prisma.JsonNull,
        normalized_value: date ? date.toISOString().slice(0, 10) : null,
        display_value: date ? date.toISOString().slice(0, 10) : null,
      };
    }

    const text = this.normalizeOptionalString(value);
    return {
      value_text: text,
      value_number: null,
      value_date: null,
      value_boolean: null,
      value_json: Prisma.JsonNull,
      normalized_value: this.normalizeForIndex(text),
      display_value: text,
    };
  }

  private normalizeOptionalString(value: unknown): string | null {
    if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
      return null;
    }

    const normalized = String(value).trim();
    return normalized.length > 0 ? normalized : null;
  }

  private normalizeForIndex(value: string | null): string | null {
    if (!value) {
      return null;
    }

    return value.trim().toLowerCase().slice(0, 512);
  }

  private displayValue(value: unknown): string | null {
    if (value === null || typeof value === "undefined") {
      return null;
    }

    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }

    return JSON.stringify(value);
  }

  private hasStoredValue(value: string | null): boolean {
    return typeof value === "string" && value.trim().length > 0;
  }

  private lockScopeKey(workspaceId: string, recordId: string, resourceType: CommissionLockResourceType, resourceId: string): string {
    return `${workspaceId}:${recordId}:${resourceType}:${resourceId}`;
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
  }

  private mapFormField(field: Prisma.CommissionFormFieldGetPayload<{
    include: {
      options: true;
      table_definition: { include: { columns: true } };
    };
  }>) {
    return {
      id: field.id,
      key: field.key,
      label: field.label,
      placeholder: field.placeholder,
      helpText: field.help_text,
      fieldType: field.field_type,
      dataKind: field.data_kind,
      sensitivity: field.sensitivity,
      required: field.is_required,
      indexed: field.is_indexed,
      sortOrder: field.sort_order,
      validation: field.validation_json,
      visibility: field.visibility_json,
      defaultValue: field.default_json,
      options: field.options.map((option) => ({
        id: option.id,
        value: option.value,
        label: option.label,
        sortOrder: option.sort_order,
      })),
      table: field.table_definition
        ? {
          id: field.table_definition.id,
          key: field.table_definition.key,
          title: field.table_definition.title,
          minRows: field.table_definition.min_rows,
          maxRows: field.table_definition.max_rows,
          allowAddRows: field.table_definition.allow_add_rows,
          defaultRows: this.extractTableDefaultRows(field.table_definition.metadata),
          columns: field.table_definition.columns.map((column) => ({
            id: column.id,
            key: column.key,
            label: column.label,
            placeholder: column.placeholder,
            dataKind: column.data_kind,
            sensitivity: column.sensitivity,
            required: column.is_required,
            sortOrder: column.sort_order,
          })),
        }
        : null,
    };
  }

  private extractTableDefaultRows(metadata: Prisma.JsonValue | null): Array<Record<string, unknown>> {
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
      return [];
    }

    const defaultRows = (metadata as { defaultRows?: unknown }).defaultRows;
    if (!Array.isArray(defaultRows)) {
      return [];
    }

    return defaultRows.filter((row): row is Record<string, unknown> => (
      Boolean(row) && typeof row === "object" && !Array.isArray(row)
    ));
  }

  private mapFieldValue(value: {
    id: string;
    field_id: string;
    field_key: string;
    value_text: string | null;
    value_number: Prisma.Decimal | null;
    value_date: Date | null;
    value_boolean: boolean | null;
    value_json: Prisma.JsonValue | null;
    display_value: string | null;
    updated_at: Date;
  }): CommissionFieldValueItem {
    return {
      id: value.id,
      fieldId: value.field_id,
      fieldKey: value.field_key,
      value: this.unpackStoredValue(value),
      displayValue: value.display_value,
      updatedAt: value.updated_at,
    };
  }

  private mapTableRow(row: {
    id: string;
    table_definition_id: string;
    row_index: number;
    row_key: string | null;
    cells: Array<{
      column_id: string;
      column_key: string;
      value_text: string | null;
      value_number: Prisma.Decimal | null;
      value_date: Date | null;
      value_boolean: boolean | null;
      value_json: Prisma.JsonValue | null;
      display_value: string | null;
    }>;
  }): CommissionTableRowItem {
    return {
      id: row.id,
      tableDefinitionId: row.table_definition_id,
      rowIndex: row.row_index,
      rowKey: row.row_key,
      cells: row.cells.map((cell) => ({
        columnId: cell.column_id,
        columnKey: cell.column_key,
        value: this.unpackStoredValue(cell),
        displayValue: cell.display_value,
      })),
    };
  }

  private mapAttachment(attachment: {
    id: string;
    document_id: string;
    label: string | null;
    note: string | null;
    uploaded_by_user_id: string | null;
    created_at: Date;
    document: {
      id: string;
      filename: string | null;
      file_type?: { mime_type: string | null } | null;
      size_bytes: bigint | number | null;
    };
  }): CommissionAttachmentItem {
    return {
      id: attachment.id,
      documentId: attachment.document_id,
      fieldKey: attachment.label,
      label: attachment.note,
      note: attachment.note,
      fileName: attachment.document.filename,
      contentType: attachment.document.file_type?.mime_type ?? null,
      sizeBytes: attachment.document.size_bytes === null ? null : String(attachment.document.size_bytes),
      uploadedByUserId: attachment.uploaded_by_user_id,
      createdAt: attachment.created_at,
    };
  }

  private mapSignature(signature: {
    id: string;
    signer_name: string;
    signer_role: string | null;
    statement: string | null;
    signed_by_user_id: string;
    signed_at: Date;
  }): CommissionSignatureItem {
    return {
      id: signature.id,
      signerName: signature.signer_name,
      signerRole: signature.signer_role,
      statement: signature.statement,
      signedByUserId: signature.signed_by_user_id,
      signedAt: signature.signed_at,
    };
  }

  private unpackStoredValue(value: {
    value_text: string | null;
    value_number: Prisma.Decimal | null;
    value_date: Date | null;
    value_boolean: boolean | null;
    value_json: Prisma.JsonValue | null;
  }): unknown {
    if (value.value_text !== null) return value.value_text;
    if (value.value_number !== null) return value.value_number.toString();
    if (value.value_date !== null) return value.value_date.toISOString().slice(0, 10);
    if (value.value_boolean !== null) return value.value_boolean;
    if (value.value_json !== null) return value.value_json;
    return null;
  }

  private async ensureCommissionDocumentNode(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    recordId: string,
  ): Promise<{ id: string; depth: number }> {
    const root = await this.ensureNode(tx, workspaceId, null, "commission-intake", "/commission-intake", 0);
    return this.ensureNode(tx, workspaceId, root.id, recordId, `/commission-intake/${recordId}`, 1);
  }

  private async ensureNode(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    parentId: string | null,
    name: string,
    pathCache: string,
    depth: number,
  ): Promise<{ id: string; depth: number }> {
    const existing = await tx.node.findFirst({
      where: { workspace_id: workspaceId, path_cache: pathCache },
      select: { id: true, depth: true, deleted_at: true },
    });

    if (existing) {
      if (existing.deleted_at) {
        return tx.node.update({
          where: { id: existing.id },
          data: { parent_id: parentId, name, depth, deleted_at: null },
          select: { id: true, depth: true },
        });
      }
      return existing;
    }

    return tx.node.create({
      data: {
        workspace_id: workspaceId,
        parent_id: parentId,
        name,
        path_cache: pathCache,
        depth,
      },
      select: { id: true, depth: true },
    });
  }

  private resolveFileExtension(fileName: string, mimeType: string): string {
    const extension = fileName.includes(".") ? fileName.split(".").pop()?.trim().toLowerCase() : "";
    if (extension && /^[a-z0-9]{1,12}$/.test(extension)) return extension;
    if (mimeType.includes("pdf")) return "pdf";
    if (mimeType.includes("png")) return "png";
    if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
    if (mimeType.includes("wordprocessingml")) return "docx";
    if (mimeType.includes("spreadsheetml")) return "xlsx";
    return "bin";
  }

  private mapRecord(row: CommissionRecordWithDisplay): CommissionRecordEntity {
    const client = "client" in row ? row.client : null;
    const directCompany = "company" in row ? row.company : null;
    return new CommissionRecordEntity({
      id: row.id,
      workspaceId: row.workspace_id,
      code: row.code,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      companyId: row.company_id,
      clientId: row.client_id,
      clientDisplayName: client ? `${client.first_name} ${client.last_name ?? ""}`.trim() : null,
      projectId: row.project_id,
      companyName: directCompany?.name ?? client?.company?.name ?? null,
      sourceSystem: row.source_system,
      externalReference: row.external_reference,
      currentChecklistId: row.current_checklist_id,
      expectedDeliveryAt: row.expected_delivery_at,
      estimatedBudgetAmount: row.estimated_budget_amount?.toString() ?? null,
      currency: row.currency,
      ownerUserId: row.owner_user_id,
      createdByUserId: row.created_by_user_id,
      updatedByUserId: row.updated_by_user_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}
