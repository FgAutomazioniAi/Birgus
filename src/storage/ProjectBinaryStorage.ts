import { ObjectStorage } from "./ObjectStorage.js";

export interface ProjectBinaryStorage extends ObjectStorage {
  sha256Hex(buffer: Buffer): string;
  defaultBucket(): string;
  storagePrefix(): string;
}
