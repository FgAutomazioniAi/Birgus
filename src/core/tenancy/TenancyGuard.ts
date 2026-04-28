import { AppError } from "../errors/AppError.js";
import { WorkspaceMembershipReader } from "./WorkspaceMembershipReader.js";

export class TenancyGuard {
  private readonly membershipReader: WorkspaceMembershipReader;

  public constructor(membershipReader: WorkspaceMembershipReader) {
    this.membershipReader = membershipReader;
  }

  public async ensureWorkspaceAccess(workspaceId: string, userId: string): Promise<void> {
    const hasAccess = await this.membershipReader.isUserActiveInWorkspace(workspaceId, userId);

    if (!hasAccess) {
      throw new AppError("User is not active in workspace.", "WORKSPACE_ACCESS_DENIED", 403);
    }
  }

  public async resolveWorkspaceIdForUser(userId: string, preferredWorkspaceId?: string | null): Promise<string> {
    if (preferredWorkspaceId && preferredWorkspaceId.trim()) {
      await this.ensureWorkspaceAccess(preferredWorkspaceId, userId);
      return preferredWorkspaceId;
    }

    const workspaceId = await this.membershipReader.findPrimaryWorkspaceIdForUser(userId);
    if (!workspaceId) {
      throw new AppError("No active workspace available for user.", "WORKSPACE_NOT_AVAILABLE", 403);
    }

    return workspaceId;
  }
}
