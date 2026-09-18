import { Injectable } from "@nestjs/common";

import { AppError } from "../../../core/errors/AppError.js";
import { PrismaService } from "../../../nest/prisma/prisma.service.js";

const ROLE_SCOPE: Record<string, string[]> = {
  developer: ["developer", "superuser", "admin", "operator"],
  superuser: ["admin", "operator"],
  admin: ["admin", "operator"],
};

const SENSITIVE_ACTION =
  /(?:workflow|archive|document|mail|ai|provider|controller|delete|remove|restore|configuration|settings)/i;

@Injectable()
export class DashboardMonitoringService {
  public constructor(private readonly prisma: PrismaService) {}

  public async getOverview(
    workspaceId: string,
    viewerUserId: string,
  ): Promise<Record<string, unknown>> {
    const visibleRoleKeys = await this.resolveVisibleRoleKeys(
      workspaceId,
      viewerUserId,
    );
    const eligibleUserIds = await this.findEligibleUserIds(
      workspaceId,
      visibleRoleKeys,
    );

    const [runs, auditEvents] = await Promise.all([
      this.prisma.moduleWorkflowRun.findMany({
        where: {
          workspace_id: workspaceId,
          requested_by_user_id: { in: eligibleUserIds },
        },
        select: {
          id: true,
          status: true,
          trigger_source: true,
          queued_at: true,
          started_at: true,
          completed_at: true,
          error_message: true,
          workflow: { select: { id: true, label: true, key: true } },
          requested_by_user: {
            select: { email: true, first_name: true, last_name: true },
          },
        },
        orderBy: { queued_at: "desc" },
        take: 200,
      }),
      this.prisma.auditLog.findMany({
        where: { workspace_id: workspaceId, user_id: { in: eligibleUserIds } },
        select: {
          id: true,
          action: true,
          entity_type: true,
          entity_id: true,
          payload: true,
          created_at: true,
          user: { select: { email: true, first_name: true, last_name: true } },
        },
        orderBy: { created_at: "desc" },
        take: 100,
      }),
    ]);

    const workflows = new Map<
      string,
      {
        workflowId: string;
        workflowLabel: string;
        workflowKey: string;
        total: number;
        lastRunAt: Date;
        runs: Array<Record<string, unknown>>;
      }
    >();
    for (const run of runs) {
      const key = run.workflow.id;
      const group = workflows.get(key) ?? {
        workflowId: key,
        workflowLabel: run.workflow.label,
        workflowKey: run.workflow.key,
        total: 0,
        lastRunAt: run.queued_at,
        runs: [],
      };
      group.total += 1;
      group.runs.push({
        id: run.id,
        status: run.status,
        triggerSource: run.trigger_source,
        queuedAt: run.queued_at,
        startedAt: run.started_at,
        completedAt: run.completed_at,
        errorMessage: run.error_message,
        user: this.userLabel(run.requested_by_user),
      });
      workflows.set(key, group);
    }

    return {
      visibleRoleKeys,
      workflowGroups: [...workflows.values()].sort(
        (left, right) => right.lastRunAt.getTime() - left.lastRunAt.getTime(),
      ),
      sensitiveEvents: auditEvents
        .filter(
          (event) =>
            !event.action.startsWith("workflow.run.") &&
            (SENSITIVE_ACTION.test(event.action) ||
              SENSITIVE_ACTION.test(event.entity_type)),
        )
        .map((event) => ({
          id: event.id,
          action: event.action,
          entityType: event.entity_type,
          entityId: event.entity_id,
          payload: event.payload,
          createdAt: event.created_at,
          user: this.userLabel(event.user),
        })),
    };
  }

  private async resolveVisibleRoleKeys(
    workspaceId: string,
    userId: string,
  ): Promise<string[]> {
    const rows = await this.prisma.userWorkspaceRole.findMany({
      where: { workspace_id: workspaceId, user_id: userId },
      select: { role: { select: { key: true } } },
    });
    const roles = rows.map((row) => row.role.key.trim().toLowerCase());
    for (const role of ["developer", "superuser", "admin"]) {
      if (roles.includes(role)) return ROLE_SCOPE[role];
    }
    throw new AppError(
      "Non sei autorizzato a monitorare le attivita del workspace.",
      "DASHBOARD_MONITORING_FORBIDDEN",
      403,
    );
  }

  private async findEligibleUserIds(
    workspaceId: string,
    roleKeys: string[],
  ): Promise<string[]> {
    const rows = await this.prisma.userWorkspaceRole.findMany({
      where: {
        workspace_id: workspaceId,
        role: { key: { in: roleKeys } },
        user: { deleted_at: null },
      },
      select: { user_id: true },
      distinct: ["user_id"],
    });
    return rows.map((row) => row.user_id);
  }

  private userLabel(
    user: {
      email: string;
      first_name: string;
      last_name: string | null;
    } | null,
  ): string {
    if (!user) return "Utente non disponibile";
    return (
      [user.first_name, user.last_name ?? ""].join(" ").trim() || user.email
    );
  }
}
