export interface ObjectDescriptor {
  bucket: string;
  objectKey: string;
  contentType: string | null;
  etag: string | null;
  size: number | null;
}

export interface PutObjectInput {
  bucket?: string;
  objectKey: string;
  bytes: Buffer;
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface GetObjectOutput extends ObjectDescriptor {
  bytes: Buffer;
  metadata: Record<string, string>;
}

export interface ObjectStorage {
  putObject(input: PutObjectInput): Promise<ObjectDescriptor>;
  getObject(bucket: string, objectKey: string): Promise<GetObjectOutput>;
  headObject(bucket: string, objectKey: string): Promise<ObjectDescriptor>;
  deleteObject(bucket: string, objectKey: string): Promise<void>;
}
