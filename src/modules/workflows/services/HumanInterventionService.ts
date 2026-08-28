import { HumanInterventionDecision, HumanInterventionStatus, Prisma, WorkflowRunStatus, WorkflowStepStatus } from "@prisma/client";

import { AppError } from "../../../core/errors/AppError.js";
import { PrismaClientManager } from "../../../database/PrismaClientManager.js";

export class HumanInterventionService {
  public async createDecisionRequest(params: {
    workspaceId: string;
    workflowRunId: string;
    workflowNodeId: string;
    createdByUserId: string | null;
    assignedUserId: string | null;
    title: string;
    message: string;
    priority: string;
    input: Record<string, unknown>;
  }): Promise<{ id: string }> {
    const prisma = PrismaClientManager.getClient();
    if (params.assignedUserId) {
      await this.ensureWorkspaceMember(params.workspaceId, params.assignedUserId);
    }
    const item = await prisma.humanIntervention.create({
      data: {
        workspace_id: params.workspaceId,
        workflow_run_id: params.workflowRunId,
        workflow_node_id: params.workflowNodeId,
        created_by_user_id: params.createdByUserId,
        assigned_user_id: params.assignedUserId,
        title: params.title,
        message: params.message,
        priority: this.normalizePriority(params.priority),
        input_payload: params.input as Prisma.InputJsonValue,
      },
      select: { id: true },
    });
    return item;
  }

  public async list(params: { workspaceId: string; userId: string; mineOnly: boolean }): Promise<Array<Record<string, unknown>>> {
    const prisma = PrismaClientManager.getClient();
    const rows = await prisma.humanIntervention.findMany({
      where: {
        workspace_id: params.workspaceId,
        ...(params.mineOnly ? { OR: [{ assigned_user_id: params.userId }, { assigned_user_id: null }] } : {}),
      },
      include: {
        workflow_run: { include: { workflow: { select: { id: true, label: true } } } },
        assigned_user: { select: { id: true, first_name: true, last_name: true, email: true } },
      },
      orderBy: [{ status: "asc" }, { created_at: "asc" }],
      take: 200,
    });
    return rows.map((row) => ({
      id: row.id,
      status: row.status,
      decision: row.decision,
      priority: row.priority,
      title: row.title,
      message: row.message,
      input: row.input_payload,
      decisionPayload: row.decision_payload,
      createdAt: row.created_at.toISOString(),
      resolvedAt: row.resolved_at?.toISOString() ?? null,
      workflowRunId: row.workflow_run_id,
      workflowId: row.workflow_run.workflow.id,
      workflowLabel: row.workflow_run.workflow.label,
      assignedUser: row.assigned_user ? {
        id: row.assigned_user.id,
        name: `${row.assigned_user.first_name} ${row.assigned_user.last_name ?? ""}`.trim(),
        email: row.assigned_user.email,
      } : null,
    }));
  }

  public async countOpenForUser(workspaceId: string, userId: string): Promise<number> {
    const prisma = PrismaClientManager.getClient();
    return prisma.humanIntervention.count({
      where: {
        workspace_id: workspaceId,
        status: { in: [HumanInterventionStatus.OPEN, HumanInterventionStatus.IN_REVIEW] },
        OR: [{ assigned_user_id: userId }, { assigned_user_id: null }],
      },
    });
  }

  public async decide(params: {
    id: string;
    workspaceId: string;
    userId: string;
    decision: HumanInterventionDecision;
    note: string | null;
  }): Promise<{ workflowRunId: string; resumed: boolean }> {
    const prisma = PrismaClientManager.getClient();
    return prisma.$transaction(async (tx) => {
      const item = await tx.humanIntervention.findFirst({
        where: { id: params.id, workspace_id: params.workspaceId },
      });
      if (!item) throw new AppError("Intervento non trovato.", "HUMAN_INTERVENTION_NOT_FOUND", 404);
      if (item.status === HumanInterventionStatus.RESOLVED || item.status === HumanInterventionStatus.CANCELED) {
        throw new AppError("Intervento gia chiuso.", "HUMAN_INTERVENTION_ALREADY_CLOSED", 409);
      }
      if (item.assigned_user_id && item.assigned_user_id !== params.userId) {
        throw new AppError("L'intervento e assegnato a un altro utente.", "HUMAN_INTERVENTION_NOT_ASSIGNEE", 403);
      }

      const decisionPayload = { decision: params.decision, note: params.note, decidedAt: new Date().toISOString() };
      await tx.humanIntervention.update({
        where: { id: item.id },
        data: {
          status: HumanInterventionStatus.RESOLVED,
          decision: params.decision,
          decision_payload: decisionPayload,
          assigned_user_id: params.userId,
          resolved_by_user_id: params.userId,
          resolved_at: new Date(),
        },
      });
      await tx.moduleWorkflowRunStep.updateMany({
        where: { workflow_run_id: item.workflow_run_id, status: WorkflowStepStatus.WAITING_FOR_DECISION },
        data: {
          status: WorkflowStepStatus.SUCCEEDED,
          completed_at: new Date(),
          output_payload: decisionPayload,
        },
      });
      const resumed = (await tx.moduleWorkflowRun.updateMany({
        where: { id: item.workflow_run_id, status: WorkflowRunStatus.WAITING_FOR_DECISION },
        data: { status: WorkflowRunStatus.QUEUED, completed_at: null, error_message: null },
      })).count > 0;
      return { workflowRunId: item.workflow_run_id, resumed };
    });
  }

  private async ensureWorkspaceMember(workspaceId: string, userId: string): Promise<void> {
    const membership = await PrismaClientManager.getClient().workspaceMembership.findFirst({
      where: { workspace_id: workspaceId, user_id: userId, status: "ACTIVE" },
      select: { user_id: true },
    });
    if (!membership) throw new AppError("Assegnatario non disponibile nel workspace.", "HUMAN_INTERVENTION_INVALID_ASSIGNEE", 400);
  }

  private normalizePriority(value: string): string {
    return ["low", "normal", "high", "urgent"].includes(value) ? value : "normal";
  }
}
