import { PermissionReader } from "../core/authorization/PermissionReader.js";
import { PrismaClientManager } from "./PrismaClientManager.js";

export class WorkspacePermissionPrismaReader implements PermissionReader {
  public async hasPermission(workspaceId: string, userId: string, permissionKey: string): Promise<boolean> {
    const prisma = PrismaClientManager.getClient();

    const roleAssignment = await prisma.userWorkspaceRole.findFirst({
      where: {
        workspace_id: workspaceId,
        user_id: userId,
        role: {
          role_permissions: {
            some: {
              permission: {
                key: permissionKey,
              },
            },
          },
        },
      },
      select: {
        id: true,
      },
    });

    return roleAssignment !== null;
  }
}
