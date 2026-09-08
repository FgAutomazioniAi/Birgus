import {
  CommissionChecklistStatus,
  CommissionDataKind,
  CommissionEventType,
  CommissionFieldSensitivity,
  CommissionFieldType,
  CommissionLockResourceType,
  CommissionRecordPriority,
  CommissionRecordStatus,
} from "@prisma/client";

import { CommissionRecordEntity } from "../domain/CommissionRecordEntity.js";

export interface CommissionRecordWriteParams {
  workspaceId: string;
  title: string;
  code?: string | null;
  description?: string | null;
  status?: CommissionRecordStatus;
  priority?: CommissionRecordPriority;
  companyId?: number | null;
  companyName?: string | null;
  clientId?: string | null;
  projectId?: string | null;
  sourceSystem?: string | null;
  externalReference?: string | null;
  expectedDeliveryAt?: Date | null;
  estimatedBudgetAmount?: string | null;
  currency?: string | null;
  metadata?: unknown;
  ownerUserId?: string | null;
  actorUserId: string;
  formVersionId?: string | null;
}

export interface CommissionRecordUpdateParams {
  workspaceId: string;
  recordId: string;
  actorUserId: string;
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
}

export interface CommissionLockResult {
  id: string;
  resourceType: CommissionLockResourceType;
  resourceId: string;
  lockToken: string;
  expiresAt: Date;
}

export interface CommissionEventListItem {
  id: string;
  eventType: CommissionEventType;
  actorUserId: string | null;
  summary: string;
  payload: unknown;
  createdAt: Date;
}

export interface CommissionFieldOptionItem {
  id: string;
  value: string;
  label: string;
  sortOrder: number;
}

export interface CommissionTableColumnItem {
  id: string;
  key: string;
  label: string;
  placeholder: string | null;
  dataKind: CommissionDataKind;
  sensitivity: CommissionFieldSensitivity;
  required: boolean;
  sortOrder: number;
}

export interface CommissionTableDefinitionItem {
  id: string;
  key: string;
  title: string;
  minRows: number | null;
  maxRows: number | null;
  allowAddRows: boolean;
  defaultRows: Array<Record<string, unknown>>;
  columns: CommissionTableColumnItem[];
}

export interface CommissionFormFieldItem {
  id: string;
  key: string;
  label: string;
  placeholder: string | null;
  helpText: string | null;
  fieldType: CommissionFieldType;
  dataKind: CommissionDataKind;
  sensitivity: CommissionFieldSensitivity;
  required: boolean;
  indexed: boolean;
  sortOrder: number;
  validation: unknown;
  visibility: unknown;
  defaultValue: unknown;
  options: CommissionFieldOptionItem[];
  table: CommissionTableDefinitionItem | null;
}

export interface CommissionFormSectionItem {
  id: string;
  key: string;
  title: string;
  description: string | null;
  sortOrder: number;
  fields: CommissionFormFieldItem[];
}

export interface CommissionFormPageItem {
  id: string;
  pageNumber: number;
  key: string;
  title: string;
  description: string | null;
  sortOrder: number;
  sections: CommissionFormSectionItem[];
}

export interface CommissionFieldValueItem {
  id: string;
  fieldId: string;
  fieldKey: string;
  value: unknown;
  displayValue: string | null;
  updatedAt: Date;
}

export interface CommissionTableCellValueItem {
  columnId: string;
  columnKey: string;
  value: unknown;
  displayValue: string | null;
}

export interface CommissionTableRowItem {
  id: string;
  tableDefinitionId: string;
  rowIndex: number;
  rowKey: string | null;
  cells: CommissionTableCellValueItem[];
}

export interface CommissionSignatureItem {
  id: string;
  signerName: string;
  signerRole: string | null;
  statement: string | null;
  signedByUserId: string;
  signedAt: Date;
}

export interface CommissionAttachmentItem {
  id: string;
  documentId: string;
  fieldKey: string | null;
  label: string | null;
  note: string | null;
  fileName: string | null;
  contentType: string | null;
  sizeBytes: string | null;
  uploadedByUserId: string | null;
  createdAt: Date;
}

export interface CommissionChecklistView {
  record: CommissionRecordEntity;
  currentUser: {
    id: string;
    fullName: string;
    canReopenSignedChecklist: boolean;
  };
  checklist: {
    id: string;
    title: string;
    status: CommissionChecklistStatus;
    revisionNo: number;
    progressPercent: number;
    currentPageNumber: number | null;
    signedAt: Date | null;
    formVersionId: string;
  } | null;
  pages: CommissionFormPageItem[];
  values: CommissionFieldValueItem[];
  tableRows: CommissionTableRowItem[];
  attachments: CommissionAttachmentItem[];
  signatures: CommissionSignatureItem[];
}

export interface CommissionSavedFieldValue {
  fieldValue: CommissionFieldValueItem;
  progressPercent: number;
}

export interface CommissionIntakeRepository {
  listRecords(params: {
    workspaceId: string;
    userId: string;
    search?: string | null;
    status?: CommissionRecordStatus | null;
  }): Promise<CommissionRecordEntity[]>;

  findRecordById(params: {
    workspaceId: string;
    userId: string;
    recordId: string;
  }): Promise<CommissionRecordEntity | null>;

  createRecord(params: CommissionRecordWriteParams): Promise<CommissionRecordEntity>;

  updateRecord(params: CommissionRecordUpdateParams): Promise<CommissionRecordEntity | null>;

  softDeleteRecord(params: {
    workspaceId: string;
    recordId: string;
    actorUserId: string;
  }): Promise<boolean>;

  listEvents(params: {
    workspaceId: string;
    userId: string;
    recordId: string;
    limit: number;
  }): Promise<CommissionEventListItem[]>;

  getChecklistView(params: {
    workspaceId: string;
    userId: string;
    recordId: string;
  }): Promise<CommissionChecklistView>;

  saveFieldValue(params: {
    workspaceId: string;
    recordId: string;
    checklistId: string;
    fieldId: string;
    actorUserId: string;
    value: unknown;
  }): Promise<CommissionSavedFieldValue>;

  replaceTableRows(params: {
    workspaceId: string;
    recordId: string;
    checklistId: string;
    tableDefinitionId: string;
    actorUserId: string;
    rows: Array<{ rowKey?: string | null; cells: Record<string, unknown> }>;
  }): Promise<CommissionTableRowItem[]>;

  createAttachment(params: {
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
  }): Promise<CommissionAttachmentItem>;

  deleteAttachment(params: {
    workspaceId: string;
    recordId: string;
    attachmentId: string;
    actorUserId: string;
  }): Promise<{ storagePath: string } | null>;

  signChecklist(params: {
    workspaceId: string;
    recordId: string;
    checklistId: string;
    actorUserId: string;
    statement?: string | null;
  }): Promise<CommissionSignatureItem>;

  reopenChecklist(params: {
    workspaceId: string;
    recordId: string;
    checklistId: string;
    actorUserId: string;
  }): Promise<void>;

  acquireLock(params: {
    workspaceId: string;
    recordId: string;
    userId: string;
    resourceType: CommissionLockResourceType;
    resourceId: string;
    lockTokenHash: string;
    lockToken: string;
    expiresAt: Date;
  }): Promise<CommissionLockResult>;

  releaseOwnActiveLock(params: {
    workspaceId: string;
    recordId: string;
    userId: string;
    resourceType: CommissionLockResourceType;
    resourceId?: string | null;
    reason?: string | null;
  }): Promise<boolean>;

  resolvePublishedTemplateVersion(params: {
    workspaceId: string;
    formVersionId?: string | null;
  }): Promise<{ id: string; title: string } | null>;

  createChecklistForRecord(params: {
    workspaceId: string;
    recordId: string;
    formVersionId: string;
    title: string;
    status?: CommissionChecklistStatus;
    actorUserId: string;
  }): Promise<string>;
}
