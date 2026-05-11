export interface QuotationJobStateRecord {
  id: string;
  workspaceId: string;
  projectId: string;
  versionLabel: string;
  requestedByUserId: string | null;
  clientName: string | null;
  status: string;
  progress: number;
  message: string | null;
  step: string | null;
  error: string | null;
  outputDocxPath: string | null;
  outputDocxStoragePath: string | null;
  outputDocxSizeBytes: number | null;
  emailRecipient: string | null;
  mailDeliveryStatus: string;
  mailSentAt: Date | null;
  mailError: string | null;
  finalMessage: string | null;
  queuedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuotationOrchestratorRepository {
  createJob(params: {
    workspaceId: string;
    projectId: string;
    versionLabel: string;
    requestedByUserId: string;
    clientName: string | null;
    status: string;
    progress: number;
    message: string;
    step: string;
  }): Promise<QuotationJobStateRecord>;
  findJobById(jobId: string): Promise<QuotationJobStateRecord | null>;
  updateJob(jobId: string, patch: {
    status?: string;
    progress?: number;
    message?: string | null;
    step?: string | null;
    error?: string | null;
    outputDocxPath?: string | null;
    outputDocxStoragePath?: string | null;
    outputDocxSizeBytes?: number | null;
    emailRecipient?: string | null;
    mailDeliveryStatus?: string;
    mailSentAt?: Date | null;
    mailError?: string | null;
    finalMessage?: string | null;
    startedAt?: Date | null;
    completedAt?: Date | null;
  }): Promise<void>;
  listRecoverableJobs(): Promise<QuotationJobStateRecord[]>;
}
