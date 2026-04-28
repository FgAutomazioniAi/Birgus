export interface PermissionReader {
  hasPermission(workspaceId: string, userId: string, permissionKey: string): Promise<boolean>;
}
