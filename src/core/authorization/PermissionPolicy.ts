import { AppError } from "../errors/AppError.js";
import { PermissionReader } from "./PermissionReader.js";

export class PermissionPolicy {
  private readonly permissionReader: PermissionReader;

  public constructor(permissionReader: PermissionReader) {
    this.permissionReader = permissionReader;
  }

  public async ensureAllowed(workspaceId: string, userId: string, permissionKey: string): Promise<void> {
    const allowed = await this.permissionReader.hasPermission(workspaceId, userId, permissionKey);

    if (!allowed) {
      throw new AppError(
        `Permission '${permissionKey}' is required.`,
        "PERMISSION_DENIED",
        403,
      );
    }
  }
}
