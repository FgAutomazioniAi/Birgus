import { createHash } from "node:crypto";
import { Readable } from "node:stream";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import { GarageConfig } from "./GarageConfig.js";
import { GetObjectOutput, ObjectDescriptor, ObjectStorage, PutObjectInput } from "./ObjectStorage.js";
import { ProjectBinaryStorage } from "./ProjectBinaryStorage.js";

interface TransformToByteArray {
  transformToByteArray: () => Promise<Uint8Array>;
}

export class GarageObjectStorage implements ObjectStorage, ProjectBinaryStorage {
  private readonly config: GarageConfig;
  private readonly client: S3Client;

  public constructor(config?: GarageConfig) {
    this.config = config ?? new GarageConfig();
    this.client = new S3Client({
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
      },
      endpoint: this.config.endpoint,
      forcePathStyle: this.config.forcePathStyle,
      region: this.config.region,
    });
  }

  public async putObject(input: PutObjectInput): Promise<ObjectDescriptor> {
    const bucket = input.bucket ?? this.config.bucket;
    const payload = Buffer.isBuffer(input.bytes) ? input.bytes : Buffer.from(input.bytes);

    const response = await this.client.send(
      new PutObjectCommand({
        Body: payload,
        Bucket: bucket,
        Key: input.objectKey,
        ContentType: input.contentType ?? "application/octet-stream",
        Metadata: input.metadata,
      }),
    );

    return {
      bucket,
      objectKey: input.objectKey,
      contentType: input.contentType ?? "application/octet-stream",
      etag: response.ETag ?? null,
      size: payload.length,
    };
  }

  public async getObject(bucket: string, objectKey: string): Promise<GetObjectOutput> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: objectKey,
      }),
    );

    const bytes = await this.toBuffer(response.Body);

    return {
      bucket,
      objectKey,
      bytes,
      contentType: response.ContentType ?? null,
      etag: response.ETag ?? null,
      metadata: response.Metadata ?? {},
      size: bytes.length,
    };
  }

  public async headObject(bucket: string, objectKey: string): Promise<ObjectDescriptor> {
    const response = await this.client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: objectKey,
      }),
    );

    return {
      bucket,
      objectKey,
      contentType: response.ContentType ?? null,
      etag: response.ETag ?? null,
      size: response.ContentLength ?? null,
    };
  }

  public async deleteObject(bucket: string, objectKey: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: objectKey,
      }),
    );
  }

  public sha256Hex(buffer: Buffer): string {
    return createHash("sha256").update(buffer).digest("hex");
  }

  public defaultBucket(): string {
    return this.config.bucket;
  }

  public storagePrefix(): string {
    return this.config.storagePrefix;
  }

  private async toBuffer(body: unknown): Promise<Buffer> {
    if (!body) {
      return Buffer.alloc(0);
    }

    if (Buffer.isBuffer(body)) {
      return body;
    }

    if (body instanceof Uint8Array) {
      return Buffer.from(body);
    }

    if (typeof body === "string") {
      return Buffer.from(body);
    }

    if (this.hasTransformToByteArray(body)) {
      return Buffer.from(await body.transformToByteArray());
    }

    if (body instanceof Readable) {
      return this.readNodeStream(body);
    }

    throw new Error("Unsupported S3 body type.");
  }

  private hasTransformToByteArray(value: unknown): value is TransformToByteArray {
    return (
      typeof value === "object"
      && value !== null
      && "transformToByteArray" in value
      && typeof (value as { transformToByteArray?: unknown }).transformToByteArray === "function"
    );
  }

  private async readNodeStream(stream: Readable): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on("data", (chunk: Buffer | string | Uint8Array) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      stream.on("end", () => resolve(Buffer.concat(chunks)));
      stream.on("error", reject);
    });
  }
}
