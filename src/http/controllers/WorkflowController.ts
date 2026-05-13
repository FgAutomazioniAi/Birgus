import { FastifyReply } from "fastify";
import { z } from "zod";

import { PermissionKey } from "../../core/authorization/PermissionKey.js";
import { AppError } from "../../core/errors/AppError.js";
import { ModuleKey } from "../../core/module-access/ModuleKey.js";
import { WorkflowService } from "../../modules/workflows/services/WorkflowService.js";
import { ModuleGuard } from "../middleware/ModuleGuard.js";
import { PermissionGuard } from "../middleware/PermissionGuard.js";
import { AuthenticatedRequest } from "../types/AuthenticatedRequest.js";

const workflowNodeSchema = z
  .object({
    id: z.string().uuid().optional(),
    nodeKey: z.string().min(1),
    nodeKind: z.enum(["INPUT", "AGENT", "TOOL", "OUTPUT"]),
    label: z.string().min(1),
    positionX: z.number(),
    positionY: z.number(),
    moduleAgentId: z.string().uuid().nullable().optional(),
    moduleToolId: z.string().uuid().nullable().optional(),
    inputKind: z.string().nullable().optional(),
    outputKind: z.string().nullable().optional(),
    configuration: z.unknown().nullable().optional(),
    inputSchema: z.unknown().nullable().optional(),
    outputSchema: z.unknown().nullable().optional(),
    isEnabled: z.boolean().default(true),
    isRequired: z.boolean().default(false),
  })
  .superRefine((node, ctx) => {
    if (node.nodeKind === "AGENT" && !node.moduleAgentId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["moduleAgentId"],
        message: "moduleAgentId is required for AGENT nodes.",
      });
    }

    if (node.nodeKind === "TOOL" && !node.moduleToolId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["moduleToolId"],
        message: "moduleToolId is required for TOOL nodes.",
      });
    }
  });

const workflowEdgeSchema = z.object({
  id: z.string().uuid().optional(),
  sourceNodeKey: z.string().min(1),
  targetNodeKey: z.string().min(1),
  sourceHandle: z.string().nullable().optional(),
  targetHandle: z.string().nullable().optional(),
  label: z.string().nullable().optional(),
  conditionPayload: z.unknown().nullable().optional(),
  orderNo: z.number().int(),
  isEnabled: z.boolean().default(true),
});

const createWorkflowSchema = z.object({
  moduleKey: z.string().min(1),
  key: z.string().min(1),
  name: z.string().min(1),
  label: z.string().min(1),
  description: z.string().nullable().optional(),
  isEnabled: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  nodes: z.array(workflowNodeSchema).min(1),
  edges: z.array(workflowEdgeSchema).default([]),
});

const updateWorkflowSchema = createWorkflowSchema.partial().extend({
  moduleKey: z.string().min(1).optional(),
  key: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  label: z.string().min(1).optional(),
  nodes: z.array(workflowNodeSchema).min(1).optional(),
  edges: z.array(workflowEdgeSchema).optional(),
});

const createWorkflowRunSchema = z.object({
  triggerSource: z.string().nullable().optional(),
  contextEntityType: z.string().nullable().optional(),
  contextEntityId: z.string().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  projectVersionId: z.number().int().positive().nullable().optional(),
  clientId: z.string().uuid().nullable().optional(),
  shipmentId: z.string().uuid().nullable().optional(),
  documentId: z.string().uuid().nullable().optional(),
  ddtDocumentId: z.string().uuid().nullable().optional(),
  inputPayload: z.unknown().nullable().optional(),
});

export class WorkflowController {
  private readonly service: WorkflowService;
  private readonly moduleGuard: ModuleGuard;
  private readonly permissionGuard: PermissionGuard;

  public constructor(service: WorkflowService, moduleGuard: ModuleGuard, permissionGuard: PermissionGuard) {
    this.service = service;
    this.moduleGuard = moduleGuard;
    this.permissionGuard = permissionGuard;
  }

  public listTools = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.WORKFLOW_MANAGEMENT);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.WORKFLOWS_READ);

      const workspaceId = request.requestContext.workspace.workspaceId;
      const moduleKey = this.getOptionalQueryValue(request, "moduleKey");
      const tools = await this.service.listModuleTools(workspaceId, moduleKey ?? undefined);

      reply.code(200).send({
        tools: tools.map((item) => ({
          id: item.id,
          moduleKey: item.moduleKey,
          key: item.key,
          name: item.name,
          label: item.label,
          description: item.description,
          runtimeKind: item.runtimeKind,
          handlerKey: item.handlerKey,
          inputSchema: item.inputSchema,
          outputSchema: item.outputSchema,
          configuration: item.configuration,
          isEnabled: item.isEnabled,
          updatedAt: item.updatedAt,
        })),
      });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public listWorkflows = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.WORKFLOW_MANAGEMENT);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.WORKFLOWS_READ);

      const workspaceId = request.requestContext.workspace.workspaceId;
      const moduleKey = this.getOptionalQueryValue(request, "moduleKey");
      const workflows = await this.service.listWorkflows(workspaceId, moduleKey ?? undefined);

      reply.code(200).send({
        workflows: workflows.map((item) => ({
          id: item.id,
          moduleKey: item.moduleKey,
          key: item.key,
          name: item.name,
          label: item.label,
          description: item.description,
          versionNo: item.versionNo,
          isEnabled: item.isEnabled,
          isDefault: item.isDefault,
          updatedAt: item.updatedAt,
        })),
      });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public getWorkflow = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.WORKFLOW_MANAGEMENT);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.WORKFLOWS_READ);

      const workspaceId = request.requestContext.workspace.workspaceId;
      const workflow = await this.service.getWorkflow(workspaceId, this.getPathId(request, "workflowId"));

      reply.code(200).send(this.serializeWorkflow(workflow));
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public createWorkflow = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.WORKFLOW_MANAGEMENT);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.WORKFLOWS_CONFIGURE);

      const body = createWorkflowSchema.parse(request.body);
      const workspaceId = request.requestContext.workspace.workspaceId;
      const userId = request.requestContext.workspace.userId;
      const saved = await this.service.saveWorkflowDefinition({
        workflowId: null,
        workspaceId,
        moduleKey: body.moduleKey,
        key: body.key,
        name: body.name,
        label: body.label,
        description: body.description ?? null,
        isEnabled: body.isEnabled,
        isDefault: body.isDefault,
        actorUserId: userId,
        nodes: body.nodes,
        edges: body.edges,
      });

      reply.code(201).send(this.serializeWorkflow(saved));
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public updateWorkflow = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.WORKFLOW_MANAGEMENT);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.WORKFLOWS_CONFIGURE);

      const workspaceId = request.requestContext.workspace.workspaceId;
      const current = await this.service.getWorkflow(workspaceId, this.getPathId(request, "workflowId"));
      const body = updateWorkflowSchema.parse(request.body);
      const userId = request.requestContext.workspace.userId;

      const saved = await this.service.saveWorkflowDefinition({
        workflowId: current.id,
        workspaceId,
        moduleKey: body.moduleKey ?? current.moduleKey,
        key: body.key ?? current.key,
        name: body.name ?? current.name,
        label: body.label ?? current.label,
        description: body.description ?? current.description,
        isEnabled: body.isEnabled ?? current.isEnabled,
        isDefault: body.isDefault ?? current.isDefault,
        actorUserId: userId,
        nodes: body.nodes ?? current.nodes.map((node) => ({
          id: node.id,
          nodeKey: node.nodeKey,
          nodeKind: node.nodeKind,
          label: node.label,
          positionX: node.positionX,
          positionY: node.positionY,
          moduleAgentId: node.moduleAgentId,
          moduleToolId: node.moduleToolId,
          inputKind: node.inputKind,
          outputKind: node.outputKind,
          configuration: node.configuration,
          inputSchema: node.inputSchema,
          outputSchema: node.outputSchema,
          isEnabled: node.isEnabled,
          isRequired: node.isRequired,
        })),
        edges: body.edges ?? current.edges.map((edge) => {
          const sourceNode = current.nodes.find((node) => node.id === edge.sourceNodeId);
          const targetNode = current.nodes.find((node) => node.id === edge.targetNodeId);
          if (!sourceNode || !targetNode) {
            throw new AppError("Workflow edge references missing nodes.", "WORKFLOW_EDGE_INVALID", 400);
          }

          return {
            id: edge.id,
            sourceNodeKey: sourceNode.nodeKey,
            targetNodeKey: targetNode.nodeKey,
            sourceHandle: edge.sourceHandle,
            targetHandle: edge.targetHandle,
            label: edge.label,
            conditionPayload: edge.conditionPayload,
            orderNo: edge.orderNo,
            isEnabled: edge.isEnabled,
          };
        }),
      });

      reply.code(200).send(this.serializeWorkflow(saved));
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public listWorkflowRuns = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.WORKFLOW_MANAGEMENT);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.WORKFLOWS_READ);

      const workspaceId = request.requestContext.workspace.workspaceId;
      const workflowId = this.getPathId(request, "workflowId");
      const runs = await this.service.listWorkflowRuns(workspaceId, workflowId);

      reply.code(200).send({
        runs: runs.map((item) => ({
          id: item.id,
          workflowId: item.workflowId,
          workflowKey: item.workflowKey,
          moduleKey: item.moduleKey,
          status: item.status,
          triggerSource: item.triggerSource,
          contextEntityType: item.contextEntityType,
          contextEntityId: item.contextEntityId,
          projectId: item.projectId,
          projectVersionId: item.projectVersionId,
          clientId: item.clientId,
          shipmentId: item.shipmentId,
          documentId: item.documentId,
          ddtDocumentId: item.ddtDocumentId,
          queuedAt: item.queuedAt,
          startedAt: item.startedAt,
          completedAt: item.completedAt,
        })),
      });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public createWorkflowRun = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.WORKFLOW_MANAGEMENT);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.WORKFLOWS_WRITE);

      const body = createWorkflowRunSchema.parse(request.body);
      const workspaceId = request.requestContext.workspace.workspaceId;
      const userId = request.requestContext.workspace.userId;
      const run = await this.service.createWorkflowRun({
        workspaceId,
        workflowId: this.getPathId(request, "workflowId"),
        requestedByUserId: userId,
        triggerSource: body.triggerSource ?? "manual_api",
        contextEntityType: body.contextEntityType ?? null,
        contextEntityId: body.contextEntityId ?? null,
        projectId: body.projectId ?? null,
        projectVersionId: body.projectVersionId ?? null,
        clientId: body.clientId ?? null,
        shipmentId: body.shipmentId ?? null,
        documentId: body.documentId ?? null,
        ddtDocumentId: body.ddtDocumentId ?? null,
        inputPayload: body.inputPayload ?? null,
      });

      reply.code(201).send(this.serializeRun(run));
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public getWorkflowRun = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.WORKFLOW_MANAGEMENT);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.WORKFLOWS_READ);

      const workspaceId = request.requestContext.workspace.workspaceId;
      const run = await this.service.getWorkflowRun(workspaceId, this.getPathId(request, "runId"));

      reply.code(200).send(this.serializeRun(run));
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  private serializeWorkflow(workflow: Awaited<ReturnType<WorkflowService["getWorkflow"]>>) {
    return {
      id: workflow.id,
      moduleKey: workflow.moduleKey,
      key: workflow.key,
      name: workflow.name,
      label: workflow.label,
      description: workflow.description,
      versionNo: workflow.versionNo,
      isEnabled: workflow.isEnabled,
      isDefault: workflow.isDefault,
      updatedAt: workflow.updatedAt,
      nodes: workflow.nodes,
      edges: workflow.edges,
    };
  }

  private serializeRun(run: Awaited<ReturnType<WorkflowService["getWorkflowRun"]>>) {
    return {
      id: run.id,
      workflowId: run.workflowId,
      workflowKey: run.workflowKey,
      moduleKey: run.moduleKey,
      status: run.status,
      triggerSource: run.triggerSource,
      contextEntityType: run.contextEntityType,
      contextEntityId: run.contextEntityId,
      projectId: run.projectId,
      projectVersionId: run.projectVersionId,
      clientId: run.clientId,
      shipmentId: run.shipmentId,
      documentId: run.documentId,
      ddtDocumentId: run.ddtDocumentId,
      inputPayload: run.inputPayload,
      resultPayload: run.resultPayload,
      errorMessage: run.errorMessage,
      queuedAt: run.queuedAt,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      steps: run.steps,
    };
  }

  private getOptionalQueryValue(request: AuthenticatedRequest, key: string): string | null {
    const value = (request.query as Record<string, unknown> | undefined)?.[key];
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }

  private getPathId(request: AuthenticatedRequest, key: string): string {
    const value = (request.params as Record<string, unknown> | undefined)?.[key];
    if (typeof value !== "string" || !value.trim()) {
      throw new AppError(`${key} is required.`, "WORKFLOW_PATH_PARAM_REQUIRED", 400);
    }
    return value.trim();
  }

  private sendError(reply: FastifyReply, error: unknown): void {
    if (error instanceof z.ZodError) {
      reply.code(400).send({ code: "VALIDATION_ERROR", message: "Invalid payload.", issues: error.issues });
      return;
    }
    if (error instanceof AppError) {
      reply.code(error.statusCode).send({ code: error.code, message: error.message });
      return;
    }
    reply.code(500).send({ code: "INTERNAL_ERROR", message: "Unexpected error." });
  }
}
