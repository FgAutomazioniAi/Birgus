export class GarageConfig {
  public readonly endpoint: string;
  public readonly region: string;
  public readonly bucket: string;
  public readonly accessKeyId: string;
  public readonly secretAccessKey: string;
  public readonly forcePathStyle: boolean;
  public readonly storagePrefix: string;

  public constructor() {
    this.endpoint = this.read("GARAGE_S3_ENDPOINT").replace(/\/+$/, "");
    this.region = process.env.GARAGE_S3_REGION?.trim() || "garage";
    this.bucket = this.read("GARAGE_S3_BUCKET");
    this.accessKeyId = this.read("GARAGE_S3_ACCESS_KEY_ID");
    this.secretAccessKey = this.read("GARAGE_S3_SECRET_ACCESS_KEY");
    this.forcePathStyle = this.toBoolean(process.env.GARAGE_S3_FORCE_PATH_STYLE ?? "true");
    this.storagePrefix = process.env.GARAGE_STORAGE_PREFIX?.trim() || "projects";
  }

  private read(name: string): string {
    const value = process.env[name];

    if (!value || !value.trim()) {
      throw new Error(`Missing required env var: ${name}`);
    }

    return value.trim();
  }

  private toBoolean(value: string): boolean {
    return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
  }
}
