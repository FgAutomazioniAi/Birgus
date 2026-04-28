import { createHash } from "node:crypto";
import { Readable } from "node:stream";

import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

interface GarageConfig {
  accessKeyId: string;
  bucket: string;
  endpoint: string;
  forcePathStyle: boolean;
  region: string;
  secretAccessKey: string;
  storagePrefix: string;
}

export interface BuildGarageObjectKeyInput {
  fileKind: string;
  fileName: string;
  projectUuid: string;
  sha256Hex: string;
  versionLabel: string;
}

export interface PutProjectVersionFileInput {
  bucket?: string;
  bytes: Buffer | Uint8Array;
  contentType?: string;
  fileKind: string;
  fileName: string;
  projectUuid: string;
  storagePrefix?: string;
  versionLabel: string;
}

export interface StoredGarageObject {
  bucket: string;
  contentType: string;
  etag: string | null;
  objectKey: string;
  sha256Hex: string;
  size: number;
  storagePath: string;
}

export interface GarageObjectHead {
  bucket: string;
  contentLength: number | null;
  contentType: string | null;
  etag: string | null;
  metadata: Record<string, string>;
  objectKey: string;
  sha256Hex: string | null;
}

export interface GarageObjectContent extends GarageObjectHead {
  buffer: Buffer;
}

interface TransformToByteArrayCapable {
  transformToByteArray: () => Promise<Uint8Array>;
}

let cachedClient: S3Client | null = null;
let cachedConfig: GarageConfig | null = null;

const isTruthyValue = (value: string) => ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());

const getRequiredEnv = (name: string): string => {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required Garage environment variable: ${name}`);
  }

  return value.trim();
};

const getGarageConfig = (): GarageConfig => {
  if (cachedConfig) {
    return cachedConfig;
  }

  cachedConfig = {
    accessKeyId: getRequiredEnv("GARAGE_S3_ACCESS_KEY_ID"),
    bucket: getRequiredEnv("GARAGE_S3_BUCKET"),
    endpoint: getRequiredEnv("GARAGE_S3_ENDPOINT").replace(/\/+$/, ""),
    forcePathStyle: isTruthyValue(process.env.GARAGE_S3_FORCE_PATH_STYLE ?? "true"),
    region: (process.env.GARAGE_S3_REGION ?? "garage").trim() || "garage",
    secretAccessKey: getRequiredEnv("GARAGE_S3_SECRET_ACCESS_KEY"),
    storagePrefix: (process.env.GARAGE_STORAGE_PREFIX ?? "projects").trim() || "projects",
  };

  return cachedConfig;
};

const getGarageS3Client = (): S3Client => {
  if (cachedClient) {
    return cachedClient;
  }

  const cfg = getGarageConfig();
  cachedClient = new S3Client({
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
    endpoint: cfg.endpoint,
    forcePathStyle: cfg.forcePathStyle,
    region: cfg.region,
  });

  return cachedClient;
};

const normalizeSegment = (value: string): string => {
  const cleaned = value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return cleaned || "na";
};

const normalizeFileName = (value: string): string => {
  const [name, ...rest] = value.trim().split(".");
  const extension = rest.join(".");
  const normalizedName = normalizeSegment(name || "file");

  if (!extension) {
    return normalizedName;
  }

  const normalizedExt = extension.replace(/[^a-zA-Z0-9]+/g, "").toLowerCase();
  return normalizedExt ? `${normalizedName}.${normalizedExt}` : normalizedName;
};

const toSha256Hex = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");

const isReadableNodeStream = (value: unknown): value is Readable => value instanceof Readable;

const hasTransformToByteArray = (value: unknown): value is TransformToByteArrayCapable =>
  typeof value === "object" &&
  value !== null &&
  "transformToByteArray" in value &&
  typeof (value as { transformToByteArray?: unknown }).transformToByteArray === "function";

const readNodeStream = async (stream: Readable): Promise<Buffer> =>
  new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];

    stream.on("data", (chunk: Buffer | string | Uint8Array) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });

const bodyToBuffer = async (body: unknown): Promise<Buffer> => {
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

  if (hasTransformToByteArray(body)) {
    const bytes = await body.transformToByteArray();
    return Buffer.from(bytes);
  }

  if (isReadableNodeStream(body)) {
    return readNodeStream(body);
  }

  throw new Error("Unsupported S3 response body type.");
};

export const garageStoragePath = (bucket: string, objectKey: string): string => `garage://${bucket}/${objectKey}`;

export const parseGarageStoragePath = (storagePath: string): { bucket: string; objectKey: string } => {
  if (!storagePath.startsWith("garage://")) {
    throw new Error(`Invalid Garage storage path: ${storagePath}`);
  }

  const withoutProtocol = storagePath.slice("garage://".length);
  const slashIndex = withoutProtocol.indexOf("/");
  if (slashIndex <= 0 || slashIndex === withoutProtocol.length - 1) {
    throw new Error(`Invalid Garage storage path: ${storagePath}`);
  }

  return {
    bucket: withoutProtocol.slice(0, slashIndex),
    objectKey: withoutProtocol.slice(slashIndex + 1),
  };
};

export const buildGarageObjectKey = ({
  fileKind,
  fileName,
  projectUuid,
  sha256Hex,
  versionLabel,
}: BuildGarageObjectKeyInput): string => {
  const cfg = getGarageConfig();
  return [
    normalizeSegment(cfg.storagePrefix),
    normalizeSegment(projectUuid),
    normalizeSegment(versionLabel),
    normalizeSegment(fileKind),
    sha256Hex.toLowerCase(),
    normalizeFileName(fileName),
  ].join("/");
};

export async function putProjectVersionFileInGarage({
  bucket,
  bytes,
  contentType,
  fileKind,
  fileName,
  projectUuid,
  storagePrefix,
  versionLabel,
}: PutProjectVersionFileInput): Promise<StoredGarageObject> {
  const cfg = getGarageConfig();
  const client = getGarageS3Client();
  const payload = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  const sha256Hex = toSha256Hex(payload);

  const objectKey = [
    normalizeSegment(storagePrefix ?? cfg.storagePrefix),
    normalizeSegment(projectUuid),
    normalizeSegment(versionLabel),
    normalizeSegment(fileKind),
    sha256Hex,
    normalizeFileName(fileName),
  ].join("/");

  const targetBucket = bucket ?? cfg.bucket;
  const resolvedContentType = contentType?.trim() || "application/octet-stream";

  const putResponse = await client.send(
    new PutObjectCommand({
      Body: payload,
      Bucket: targetBucket,
      ContentType: resolvedContentType,
      Key: objectKey,
      Metadata: {
        filekind: normalizeSegment(fileKind),
        originalfilename: fileName,
        projectuuid: projectUuid,
        sha256: sha256Hex,
        versionlabel: versionLabel,
      },
    }),
  );

  return {
    bucket: targetBucket,
    contentType: resolvedContentType,
    etag: putResponse.ETag ?? null,
    objectKey,
    sha256Hex,
    size: payload.length,
    storagePath: garageStoragePath(targetBucket, objectKey),
  };
}

export async function getGarageObjectHead(objectKey: string, bucket?: string): Promise<GarageObjectHead> {
  const cfg = getGarageConfig();
  const client = getGarageS3Client();
  const targetBucket = bucket ?? cfg.bucket;

  const headResponse = await client.send(
    new HeadObjectCommand({
      Bucket: targetBucket,
      Key: objectKey,
    }),
  );

  return {
    bucket: targetBucket,
    contentLength: headResponse.ContentLength ?? null,
    contentType: headResponse.ContentType ?? null,
    etag: headResponse.ETag ?? null,
    metadata: headResponse.Metadata ?? {},
    objectKey,
    sha256Hex: headResponse.Metadata?.sha256 ?? null,
  };
}

export async function getGarageObjectContent(objectKey: string, bucket?: string): Promise<GarageObjectContent> {
  const cfg = getGarageConfig();
  const client = getGarageS3Client();
  const targetBucket = bucket ?? cfg.bucket;

  const getResponse = await client.send(
    new GetObjectCommand({
      Bucket: targetBucket,
      Key: objectKey,
    }),
  );

  const buffer = await bodyToBuffer(getResponse.Body);

  return {
    bucket: targetBucket,
    buffer,
    contentLength: buffer.length,
    contentType: getResponse.ContentType ?? null,
    etag: getResponse.ETag ?? null,
    metadata: getResponse.Metadata ?? {},
    objectKey,
    sha256Hex: getResponse.Metadata?.sha256 ?? null,
  };
}

export async function deleteGarageObject(objectKey: string, bucket?: string): Promise<void> {
  const cfg = getGarageConfig();
  const client = getGarageS3Client();
  const targetBucket = bucket ?? cfg.bucket;

  await client.send(
    new DeleteObjectCommand({
      Bucket: targetBucket,
      Key: objectKey,
    }),
  );
}
