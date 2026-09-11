import {
  CommissionRecordPriority,
  CommissionRecordStatus,
} from "@prisma/client";

export class CommissionRecordEntity {
  public readonly id: string;
  public readonly workspaceId: string;
  public readonly code: string;
  public readonly title: string;
  public readonly description: string | null;
  public readonly status: CommissionRecordStatus;
  public readonly statusLabel: string | null;
  public readonly priority: CommissionRecordPriority;
  public readonly companyId: number | null;
  public readonly clientId: string | null;
  public readonly clientDisplayName: string | null;
  public readonly projectId: string | null;
  public readonly companyName: string | null;
  public readonly sourceSystem: string | null;
  public readonly externalReference: string | null;
  public readonly currentChecklistId: string | null;
  public readonly expectedDeliveryAt: Date | null;
  public readonly estimatedBudgetAmount: string | null;
  public readonly currency: string | null;
  public readonly ownerUserId: string | null;
  public readonly createdByUserId: string | null;
  public readonly updatedByUserId: string | null;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  public constructor(params: {
    id: string;
    workspaceId: string;
    code: string;
    title: string;
    description: string | null;
    status: CommissionRecordStatus;
    statusLabel?: string | null;
    priority: CommissionRecordPriority;
    companyId: number | null;
    clientId: string | null;
    clientDisplayName?: string | null;
    projectId: string | null;
    companyName?: string | null;
    sourceSystem: string | null;
    externalReference: string | null;
    currentChecklistId: string | null;
    expectedDeliveryAt: Date | null;
    estimatedBudgetAmount: string | null;
    currency: string | null;
    ownerUserId: string | null;
    createdByUserId: string | null;
    updatedByUserId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this.id = params.id;
    this.workspaceId = params.workspaceId;
    this.code = params.code;
    this.title = params.title;
    this.description = params.description;
    this.status = params.status;
    this.statusLabel = params.statusLabel ?? null;
    this.priority = params.priority;
    this.companyId = params.companyId;
    this.clientId = params.clientId;
    this.clientDisplayName = params.clientDisplayName ?? null;
    this.projectId = params.projectId;
    this.companyName = params.companyName ?? null;
    this.sourceSystem = params.sourceSystem;
    this.externalReference = params.externalReference;
    this.currentChecklistId = params.currentChecklistId;
    this.expectedDeliveryAt = params.expectedDeliveryAt;
    this.estimatedBudgetAmount = params.estimatedBudgetAmount;
    this.currency = params.currency;
    this.ownerUserId = params.ownerUserId;
    this.createdByUserId = params.createdByUserId;
    this.updatedByUserId = params.updatedByUserId;
    this.createdAt = params.createdAt;
    this.updatedAt = params.updatedAt;
  }
}
