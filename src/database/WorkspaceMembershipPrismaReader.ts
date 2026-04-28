import { WorkspaceMembershipReader } from "../core/tenancy/WorkspaceMembershipReader.js";
import { PrismaClientManager } from "./PrismaClientManager.js";

export class WorkspaceMembershipPrismaReader implements WorkspaceMembershipReader {
  public async isUserActiveInWorkspace(workspaceId: string, userId: string): Promise<boolean> {
    const prisma = PrismaClientManager.getClient();
    const membership = await prisma.workspaceMembership.findFirst({
      where: {
        workspace_id: workspaceId,
        user_id: userId,
        status: "ACTIVE",
      },
      select: {
        id: true,
      },
    });

    return membership !== null;
  }

  public async findPrimaryWorkspaceIdForUser(userId: string): Promise<string | null> {
    const prisma = PrismaClientManager.getClient();
    const membership = await prisma.workspaceMembership.findFirst({
      where: {
        user_id: userId,
        status: "ACTIVE",
      },
      select: {
        workspace_id: true,
      },
      orderBy: {
        joined_at: "asc",
      },
    });

    return membership?.workspace_id ?? null;
  }
}
