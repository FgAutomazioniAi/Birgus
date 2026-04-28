import { FileKindValue } from "../domain/FileKind.js";

export class PutProjectFileCommand {
  public readonly workspaceId: string;
  public readonly projectId: string;
  public readonly versionLabel: string;
  public readonly fileKind: FileKindValue;
  public readonly fileName: string;
  public readonly contentType: string;
  public readonly bytes: Buffer;
  public readonly uploadedByUserId: string | null;

  public constructor(params: {
    workspaceId: string;
    projectId: string;
    versionLabel: string;
    fileKind: FileKindValue;
    fileName: string;
    contentType: string;
    bytes: Buffer;
    uploadedByUserId?: string | null;
  }) {
    this.workspaceId = params.workspaceId;
    this.projectId = params.projectId;
    this.versionLabel = params.versionLabel.trim().toLowerCase();
    this.fileKind = params.fileKind;
    this.fileName = params.fileName.trim();
    this.contentType = params.contentType;
    this.bytes = params.bytes;
    this.uploadedByUserId = params.uploadedByUserId ?? null;
  }
}
