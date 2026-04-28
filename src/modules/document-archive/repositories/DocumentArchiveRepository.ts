import { FileKindValue } from "../domain/FileKind.js";
import { DocumentEntity } from "../domain/DocumentEntity.js";

export interface DocumentArchiveRepository {
  getCurrentProjectFile(params: {
    workspaceId: string;
    projectId: string;
    versionLabel: string;
    fileKind: FileKindValue;
    fileName?: string;
  }): Promise<DocumentEntity | null>;
  upsertProjectFileRecord(params: {
    workspaceId: string;
    projectId: string;
    versionLabel: string;
    fileKind: FileKindValue;
    fileName: string;
    storagePath: string;
    sizeBytes: number;
    uploadedByUserId: string | null;
  }): Promise<{ document: DocumentEntity; previousStoragePath: string | null }>;
  listProjectVersionFiles(params: {
    workspaceId: string;
    projectId: string;
    versionLabel: string;
  }): Promise<DocumentEntity[]>;
  softDeleteProjectFile(params: {
    workspaceId: string;
    projectId: string;
    versionLabel: string;
    fileKind: FileKindValue;
    fileName?: string;
  }): Promise<DocumentEntity | null>;
}
