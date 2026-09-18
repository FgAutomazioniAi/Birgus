import { createHash, randomBytes } from "node:crypto";
import { CommissionLockResourceType, Prisma } from "@prisma/client";

import { AppError } from "../../../core/errors/AppError.js";
import { PrismaClientManager } from "../../../database/PrismaClientManager.js";

export interface WorkflowLockResult {
  id: string;
  resourceId: string;
  expiresAt: Date;
}

export class WorkflowLockService {
  public async acquire(
    workspaceId: string,
    workflowId: string,
    userId: string,
  ): Promise<WorkflowLockResult> {
    const prisma = PrismaClientManager.getClient();
    const workflow = await prisma.moduleWorkflow.findFirst({
      where: { id: workflowId, workspace_id: workspaceId, deleted_at: null },
      select: { id: true },
    });
    if (!workflow) {
      throw new AppError("Workflow non trovato.", "WORKFLOW_NOT_FOUND", 404);
    }

    const now = new Date();
    const activeScopeKey = this.scopeKey(workspaceId, workflowId);
    await this.expire(prisma, activeScopeKey, now);
    const blocking = await prisma.commissionResourceLock.findFirst({
      where: {
        active_scope_key: activeScopeKey,
        released_at: null,
        expires_at: { gt: now },
        locked_by_user_id: { not: userId },
      },
      select: { id: true },
    });
    if (blocking) {
      throw new AppError(
        "Questo workflow è in modifica da un altro utente.",
        "WORKFLOW_LOCKED",
        409,
      );
    }

    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);
    const own = await prisma.commissionResourceLock.findFirst({
      where: {
        active_scope_key: activeScopeKey,
        locked_by_user_id: userId,
        released_at: null,
        expires_at: { gt: now },
      },
    });
    if (own) {
      const updated = await prisma.commissionResourceLock.update({
        where: { id: own.id },
        data: { expires_at: expiresAt, heartbeat_at: now },
      });
      return {
        id: updated.id,
        resourceId: workflowId,
        expiresAt: updated.expires_at,
      };
    }

    try {
      const lock = await prisma.commissionResourceLock.create({
        data: {
          workspace_id: workspaceId,
          resource_id: workflowId,
          resource_type: CommissionLockResourceType.WORKFLOW,
          active_scope_key: activeScopeKey,
          lock_token_hash: this.hash(randomBytes(32).toString("base64url")),
          locked_by_user_id: userId,
          expires_at: expiresAt,
        },
      });
      return {
        id: lock.id,
        resourceId: workflowId,
        expiresAt: lock.expires_at,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new AppError(
          "Questo workflow è in modifica da un altro utente.",
          "WORKFLOW_LOCKED",
          409,
        );
      }
      throw error;
    }
  }

  public async heartbeat(
    workspaceId: string,
    workflowId: string,
    userId: string,
  ): Promise<WorkflowLockResult> {
    const prisma = PrismaClientManager.getClient();
    const now = new Date();
    const lock = await prisma.commissionResourceLock.findFirst({
      where: {
        workspace_id: workspaceId,
        resource_id: workflowId,
        resource_type: CommissionLockResourceType.WORKFLOW,
        locked_by_user_id: userId,
        released_at: null,
        expires_at: { gt: now },
      },
      orderBy: { heartbeat_at: "desc" },
    });
    if (!lock) {
      throw new AppError(
        "Il blocco del workflow non è più attivo.",
        "WORKFLOW_LOCK_LOST",
        409,
      );
    }

    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);
    const result = await prisma.commissionResourceLock.updateMany({
      where: { id: lock.id, released_at: null, expires_at: { gt: now } },
      data: { expires_at: expiresAt, heartbeat_at: now },
    });
    if (result.count !== 1) {
      throw new AppError(
        "Il blocco del workflow non è più attivo.",
        "WORKFLOW_LOCK_LOST",
        409,
      );
    }
    return { id: lock.id, resourceId: workflowId, expiresAt };
  }

  public async release(
    workspaceId: string,
    workflowId: string,
    userId: string,
  ): Promise<void> {
    const prisma = PrismaClientManager.getClient();
    await prisma.commissionResourceLock.updateMany({
      where: {
        workspace_id: workspaceId,
        resource_id: workflowId,
        resource_type: CommissionLockResourceType.WORKFLOW,
        locked_by_user_id: userId,
        released_at: null,
      },
      data: {
        active_scope_key: null,
        released_at: new Date(),
        release_reason: "workflow_editor_closed",
      },
    });
  }

  private async expire(
    prisma: ReturnType<typeof PrismaClientManager.getClient>,
    scopeKey: string,
    now: Date,
  ): Promise<void> {
    await prisma.commissionResourceLock.updateMany({
      where: {
        active_scope_key: scopeKey,
        released_at: null,
        expires_at: { lte: now },
      },
      data: {
        active_scope_key: null,
        released_at: now,
        release_reason: "expired",
      },
    });
  }

  private scopeKey(workspaceId: string, workflowId: string): string {
    return `workflow:${workspaceId}:${workflowId}`;
  }

  private hash(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }
}
