import { AppError } from "../../../core/errors/AppError.js";
import { GaragePath } from "../../../storage/GaragePath.js";
import { ProjectBinaryStorage } from "../../../storage/ProjectBinaryStorage.js";
import { DocumentEntity } from "../domain/DocumentEntity.js";
import { FileKind } from "../domain/FileKind.js";
import { PutProjectFileCommand } from "../dto/PutProjectFileCommand.js";
import { DocumentArchiveRepository } from "../repositories/DocumentArchiveRepository.js";

export class DocumentArchiveService {
  private readonly repository: DocumentArchiveRepository;
  private readonly objectStorage: ProjectBinaryStorage;

  public constructor(repository: DocumentArchiveRepository, objectStorage: ProjectBinaryStorage) {
    this.repository = repository;
    this.objectStorage = objectStorage;
  }

  public async putProjectVersionFile(command: PutProjectFileCommand): Promise<DocumentEntity> {
    if (!FileKind.ALL.includes(command.fileKind)) {
      throw new AppError("Unsupported file kind.", "FILE_KIND_INVALID", 400);
    }

    const sha256Hex = this.objectStorage.sha256Hex(command.bytes);
    const objectKey = GaragePath.buildObjectKey(
      this.objectStorage.storagePrefix(),
      command.workspaceId,
      command.projectId,
      command.versionLabel,
      command.fileKind,
      sha256Hex,
      command.fileName,
    );

    const storedObject = await this.objectStorage.putObject({
      objectKey,
      bytes: command.bytes,
      contentType: command.contentType,
      metadata: {
        workspaceid: command.workspaceId,
        projectid: command.projectId,
        versionlabel: command.versionLabel,
        filekind: command.fileKind,
        sha256: sha256Hex,
      },
    });

    const storagePath = GaragePath.toStoragePath(storedObject.bucket, storedObject.objectKey);

    const { document, previousStoragePath } = await this.repository.upsertProjectFileRecord({
      workspaceId: command.workspaceId,
      projectId: command.projectId,
      versionLabel: command.versionLabel,
      fileKind: command.fileKind,
      fileName: command.fileName,
      storagePath,
      sizeBytes: command.bytes.length,
      uploadedByUserId: command.uploadedByUserId,
    });

    if (previousStoragePath && previousStoragePath.startsWith("garage://") && previousStoragePath !== storagePath) {
      try {
        const parsed = GaragePath.parse(previousStoragePath);
        await this.objectStorage.deleteObject(parsed.bucket, parsed.objectKey);
      } catch {
        // best effort cleanup
      }
    }

    return document;
  }

  public async getCurrentProjectVersionFile(params: {
    workspaceId: string;
    projectId: string;
    versionLabel: string;
    fileKind: (typeof FileKind.ALL)[number];
    fileName?: string;
  }): Promise<DocumentEntity | null> {
    return this.repository.getCurrentProjectFile(params);
  }

  public async listProjectVersionFiles(params: {
    workspaceId: string;
    projectId: string;
    versionLabel: string;
  }): Promise<DocumentEntity[]> {
    return this.repository.listProjectVersionFiles(params);
  }

  public async deleteProjectVersionFile(params: {
    workspaceId: string;
    projectId: string;
    versionLabel: string;
    fileKind: (typeof FileKind.ALL)[number];
    fileName?: string;
  }): Promise<boolean> {
    const removed = await this.repository.softDeleteProjectFile(params);
    if (!removed) {
      return false;
    }

    if (removed.storagePath.startsWith("garage://")) {
      try {
        const parsed = GaragePath.parse(removed.storagePath);
        await this.objectStorage.deleteObject(parsed.bucket, parsed.objectKey);
      } catch {
        // best effort cleanup
      }
    }

    return true;
  }

  public async getProjectVersionFileBinary(params: {
    workspaceId: string;
    projectId: string;
    versionLabel: string;
    fileKind: (typeof FileKind.ALL)[number];
    fileName?: string;
  }): Promise<{ document: DocumentEntity; bytes: Buffer; contentType: string | null } | null> {
    const document = await this.repository.getCurrentProjectFile(params);
    if (!document) {
      return null;
    }

    const payload = await this.getBinaryByStoragePath(document.storagePath);
    if (!payload) {
      return null;
    }

    return {
      document,
      bytes: payload.bytes,
      contentType: payload.contentType,
    };
  }

  public async getBinaryByStoragePath(
    storagePath: string | null | undefined,
  ): Promise<{ bytes: Buffer; contentType: string | null } | null> {
    if (!storagePath || !storagePath.startsWith("garage://")) {
      return null;
    }

    const parsed = GaragePath.parse(storagePath);
    const object = await this.objectStorage.getObject(parsed.bucket, parsed.objectKey);
    return {
      bytes: object.bytes,
      contentType: object.contentType,
    };
  }
}
