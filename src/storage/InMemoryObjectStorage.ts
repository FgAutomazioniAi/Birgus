import { createHash } from "node:crypto";

import { GetObjectOutput, ObjectDescriptor, PutObjectInput } from "./ObjectStorage.js";
import { ProjectBinaryStorage } from "./ProjectBinaryStorage.js";

export class InMemoryObjectStorage implements ProjectBinaryStorage {
  private readonly objects: Map<string, { bytes: Buffer; contentType: string; metadata: Record<string, string> }>;

  public constructor() {
    this.objects = new Map();
  }

  public async putObject(input: PutObjectInput): Promise<ObjectDescriptor> {
    const bucket = input.bucket ?? "in-memory";
    const key = this.composeKey(bucket, input.objectKey);

    this.objects.set(key, {
      bytes: Buffer.from(input.bytes),
      contentType: input.contentType ?? "application/octet-stream",
      metadata: input.metadata ?? {},
    });

    return {
      bucket,
      objectKey: input.objectKey,
      contentType: input.contentType ?? "application/octet-stream",
      etag: null,
      size: input.bytes.length,
    };
  }

  public async getObject(bucket: string, objectKey: string): Promise<GetObjectOutput> {
    const key = this.composeKey(bucket, objectKey);
    const entry = this.objects.get(key);

    if (!entry) {
      throw new Error(`Object not found: ${bucket}/${objectKey}`);
    }

    return {
      bucket,
      objectKey,
      bytes: entry.bytes,
      contentType: entry.contentType,
      etag: null,
      metadata: entry.metadata,
      size: entry.bytes.length,
    };
  }

  public async headObject(bucket: string, objectKey: string): Promise<ObjectDescriptor> {
    const key = this.composeKey(bucket, objectKey);
    const entry = this.objects.get(key);

    if (!entry) {
      throw new Error(`Object not found: ${bucket}/${objectKey}`);
    }

    return {
      bucket,
      objectKey,
      contentType: entry.contentType,
      etag: null,
      size: entry.bytes.length,
    };
  }

  public async deleteObject(bucket: string, objectKey: string): Promise<void> {
    this.objects.delete(this.composeKey(bucket, objectKey));
  }

  public sha256Hex(buffer: Buffer): string {
    return createHash("sha256").update(buffer).digest("hex");
  }

  public defaultBucket(): string {
    return "in-memory";
  }

  public storagePrefix(): string {
    return "memory";
  }

  private composeKey(bucket: string, objectKey: string): string {
    return `${bucket}/${objectKey}`;
  }
}
