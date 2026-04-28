export class GaragePath {
  public static toStoragePath(bucket: string, objectKey: string): string {
    return `garage://${bucket}/${objectKey}`;
  }

  public static parse(storagePath: string): { bucket: string; objectKey: string } {
    if (!storagePath.startsWith("garage://")) {
      throw new Error(`Invalid storage path: ${storagePath}`);
    }

    const withoutPrefix = storagePath.slice("garage://".length);
    const slash = withoutPrefix.indexOf("/");

    if (slash <= 0 || slash >= withoutPrefix.length - 1) {
      throw new Error(`Invalid storage path: ${storagePath}`);
    }

    return {
      bucket: withoutPrefix.slice(0, slash),
      objectKey: withoutPrefix.slice(slash + 1),
    };
  }

  public static buildObjectKey(
    storagePrefix: string,
    workspaceId: string,
    projectId: string,
    versionLabel: string,
    fileKind: string,
    sha256Hex: string,
    fileName: string,
  ): string {
    return [
      this.normalize(storagePrefix),
      this.normalize(workspaceId),
      this.normalize(projectId),
      this.normalize(versionLabel),
      this.normalize(fileKind),
      this.normalize(sha256Hex),
      this.normalizeFileName(fileName),
    ].join("/");
  }

  private static normalize(value: string): string {
    const cleaned = value
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    return cleaned || "na";
  }

  private static normalizeFileName(value: string): string {
    const trimmed = value.trim();
    const lastDot = trimmed.lastIndexOf(".");

    if (lastDot < 1 || lastDot === trimmed.length - 1) {
      return this.normalize(trimmed || "file");
    }

    const base = trimmed.slice(0, lastDot);
    const ext = trimmed.slice(lastDot + 1).replace(/[^a-zA-Z0-9]+/g, "").toLowerCase();

    return `${this.normalize(base)}.${ext || "bin"}`;
  }
}
