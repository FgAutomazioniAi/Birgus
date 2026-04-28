export interface WorkspaceMembershipReader {
  isUserActiveInWorkspace(workspaceId: string, userId: string): Promise<boolean>;
  findPrimaryWorkspaceIdForUser(userId: string): Promise<string | null>;
}
