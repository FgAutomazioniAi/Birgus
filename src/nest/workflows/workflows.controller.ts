import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { z } from "zod";

import { PermissionKey } from "../../core/authorization/PermissionKey.js";
import { AppError } from "../../core/errors/AppError.js";
import { ModuleKey } from "../../core/module-access/ModuleKey.js";
import { RequestContext } from "../../core/tenancy/RequestContext.js";
import { WorkflowService } from "../../modules/workflows/services/WorkflowService.js";
import { WorkflowRunExecutorService } from "../../modules/workflows/services/WorkflowRunExecutorService.js";
import { HumanInterventionService } from "../../modules/workflows/services/HumanInterventionService.js";
import { jsonObjectSchema, jsonValueSchema } from "../../shared/validation/json.js";
import { AccessPolicyGuard } from "../auth/access-policy.guard.js";
import { RequestContextAuthGuard } from "../auth/request-context-auth.guard.js";
import { CurrentRequestContext } from "../common/decorators/request-context.decorator.js";
import { RequireModule } from "../common/decorators/require-module.decorator.js";
import { RequirePermission } from "../common/decorators/require-permission.decorator.js";

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
    configuration: jsonObjectSchema.nullable().optional(),
    inputSchema: jsonObjectSchema.nullable().optional(),
    outputSchema: jsonObjectSchema.nullable().optional(),
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
  conditionPayload: jsonValueSchema.nullable().optional(),
  orderNo: z.number().int(),
  isEnabled: z.boolean().default(true),
});

const createWorkflowSchema = z.object({
  moduleKey: z.string().min(1),
  key: z.string().min(1),
  name: z.string().min(1),
  label: z.string().min(1),
  description: z.string().nullable().optional(),
  configuration: jsonObjectSchema.nullable().optional(),
  isEnabled: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  nodes: z.array(workflowNodeSchema).min(1),
  edges: z.array(workflowEdgeSchema).default([]),
});

const updateWorkflowSchema = createWorkflowSchema.partial().extend({
  incrementVersion: z.boolean().optional(),
  moduleKey: z.string().min(1).optional(),
  key: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  label: z.string().min(1).optional(),
  nodes: z.array(workflowNodeSchema).min(1).optional(),
  edges: z.array(workflowEdgeSchema).optional(),
});

type WorkflowRunJsonValue = string | number | boolean | null | WorkflowRunJsonValue[] | { [key: string]: WorkflowRunJsonValue };

const workflowRunJsonValueSchema: z.ZodType<WorkflowRunJsonValue> = z.lazy(() =>
  z.union([
    z.string().max(30_000_000),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(workflowRunJsonValueSchema).max(500),
    z.record(z.string().min(1).max(200), workflowRunJsonValueSchema),
  ]),
);

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
  measureReportDocumentId: z.string().uuid().nullable().optional(),
  inputPayload: workflowRunJsonValueSchema.nullable().optional(),
});

const decideHumanInterventionSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED", "CHANGES_REQUIRED"]),
  note: z.string().max(4000).nullable().optional(),
});

@Controller("/api")
@UseGuards(RequestContextAuthGuard, AccessPolicyGuard)
@RequireModule(ModuleKey.WORKFLOW_MANAGEMENT)
export class NestWorkflowsController {
  public constructor(
    @Inject(WorkflowService)
    private readonly service: WorkflowService,
    @Inject(HumanInterventionService)
    private readonly humanInterventionService: HumanInterventionService,
    @Inject(WorkflowRunExecutorService)
    private readonly workflowRunExecutorService: WorkflowRunExecutorService,
  ) {}

  @Get("workflow-interventions")
  @RequirePermission(PermissionKey.WORKFLOWS_READ)
  public async listHumanInterventions(
    @CurrentRequestContext() requestContext: RequestContext,
    @Query("scope") scope?: string,
  ): Promise<Record<string, unknown>> {
    const { workspaceId, userId } = requestContext.workspace;
    return {
      interventions: await this.humanInterventionService.list({
        workspaceId,
        userId,
        mineOnly: scope !== "all",
      }),
    };
  }

  @Get("workflow-interventions/open-count")
  @RequirePermission(PermissionKey.WORKFLOWS_READ)
  public async countOpenHumanInterventions(
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, number>> {
    const { workspaceId, userId } = requestContext.workspace;
    return { count: await this.humanInterventionService.countOpenForUser(workspaceId, userId) };
  }

  @Patch("workflow-interventions/:id/decision")
  @RequirePermission(PermissionKey.WORKFLOWS_WRITE)
  public async decideHumanIntervention(
    @CurrentRequestContext() requestContext: RequestContext,
    @Param("id") id: string,
    @Body() bodyRaw: unknown,
  ): Promise<Record<string, unknown>> {
    const body = decideHumanInterventionSchema.parse(bodyRaw);
    const result = await this.humanInterventionService.decide({
      id,
      workspaceId: requestContext.workspace.workspaceId,
      userId: requestContext.workspace.userId,
      decision: body.decision,
      note: body.note ?? null,
    });
    if (result.resumed) {
      await this.workflowRunExecutorService.resumeAfterDecision(result.workflowRunId);
    }
    return { ...result, status: "queued" };
  }

  @Get("workflows/tools")
  @RequirePermission(PermissionKey.WORKFLOWS_READ)
  public async listTools(
    @CurrentRequestContext() requestContext: RequestContext,
    @Query("moduleKey") moduleKeyRaw?: string,
  ): Promise<Record<string, unknown>> {
    const workspaceId = requestContext.workspace.workspaceId;
    const moduleKey = this.normalizeOptionalString(moduleKeyRaw);
    const tools = await this.service.listModuleTools(workspaceId, moduleKey ?? undefined);

    return {
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
    };
  }

  @Get("workflows")
  @RequirePermission(PermissionKey.WORKFLOWS_READ)
  public async listWorkflows(
    @CurrentRequestContext() requestContext: RequestContext,
    @Query("moduleKey") moduleKeyRaw?: string,
  ): Promise<Record<string, unknown>> {
    const workspaceId = requestContext.workspace.workspaceId;
    const moduleKey = this.normalizeOptionalString(moduleKeyRaw);
    const workflows = await this.service.listWorkflows(workspaceId, moduleKey ?? undefined);

    return {
      workflows: workflows.map((item) => ({
        id: item.id,
        moduleKey: item.moduleKey,
        key: item.key,
        name: item.name,
        label: item.label,
        description: item.description,
        configuration: item.configuration,
        versionNo: item.versionNo,
        isEnabled: item.isEnabled,
        isDefault: item.isDefault,
        updatedAt: item.updatedAt,
      })),
    };
  }

  @Post("workflows")
  @HttpCode(201)
  @RequirePermission(PermissionKey.WORKFLOWS_CONFIGURE)
  public async createWorkflow(
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const body = createWorkflowSchema.parse(bodyRaw);
    const workspaceId = requestContext.workspace.workspaceId;
    const userId = requestContext.workspace.userId;
    const saved = await this.service.saveWorkflowDefinition({
      workflowId: null,
      workspaceId,
      moduleKey: body.moduleKey,
      key: body.key,
      name: body.name,
      label: body.label,
      description: body.description ?? null,
      configuration: body.configuration ?? null,
      isEnabled: body.isEnabled,
      isDefault: body.isDefault,
      actorUserId: userId,
      nodes: body.nodes,
      edges: body.edges,
    });

    return this.serializeWorkflow(saved);
  }

  @Get("workflows/:workflowId")
  @RequirePermission(PermissionKey.WORKFLOWS_READ)
  public async getWorkflow(
    @Param("workflowId") workflowIdRaw: string,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const workspaceId = requestContext.workspace.workspaceId;
    const workflow = await this.service.getWorkflow(workspaceId, this.getPathId(workflowIdRaw, "workflowId"));
    return this.serializeWorkflow(workflow);
  }

  @Patch("workflows/:workflowId")
  @HttpCode(200)
  @RequirePermission(PermissionKey.WORKFLOWS_CONFIGURE)
  public async updateWorkflow(
    @Param("workflowId") workflowIdRaw: string,
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const workspaceId = requestContext.workspace.workspaceId;
    const workflowId = this.getPathId(workflowIdRaw, "workflowId");
    const current = await this.service.getWorkflow(workspaceId, workflowId);
    const body = updateWorkflowSchema.parse(bodyRaw);
    const userId = requestContext.workspace.userId;

    const saved = await this.service.saveWorkflowDefinition({
      workflowId: current.id,
      workspaceId,
      moduleKey: body.moduleKey ?? current.moduleKey,
      key: body.key ?? current.key,
      name: body.name ?? current.name,
      label: body.label ?? current.label,
      description: body.description ?? current.description,
      configuration: body.configuration ?? current.configuration,
      isEnabled: body.isEnabled ?? current.isEnabled,
      isDefault: body.isDefault ?? current.isDefault,
      incrementVersion: body.incrementVersion ?? true,
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

    return this.serializeWorkflow(saved);
  }

  @Delete("workflows/:workflowId")
  @HttpCode(204)
  @RequirePermission(PermissionKey.WORKFLOWS_CONFIGURE)
  public async deleteWorkflow(
    @Param("workflowId") workflowIdRaw: string,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<void> {
    await this.service.deletePersonalWorkflow(
      requestContext.workspace.workspaceId,
      this.getPathId(workflowIdRaw, "workflowId"),
      requestContext.workspace.userId,
    );
  }

  @Get("workflows/:workflowId/runs")
  @RequirePermission(PermissionKey.WORKFLOWS_READ)
  public async listWorkflowRuns(
    @Param("workflowId") workflowIdRaw: string,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const workspaceId = requestContext.workspace.workspaceId;
    const workflowId = this.getPathId(workflowIdRaw, "workflowId");
    const runs = await this.service.listWorkflowRuns(workspaceId, workflowId);

    return {
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
        measureReportDocumentId: item.measureReportDocumentId,
        queuedAt: item.queuedAt,
        startedAt: item.startedAt,
        completedAt: item.completedAt,
      })),
    };
  }

  @Post("workflows/:workflowId/runs")
  @HttpCode(201)
  @RequirePermission(PermissionKey.WORKFLOWS_WRITE)
  public async createWorkflowRun(
    @Param("workflowId") workflowIdRaw: string,
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const body = createWorkflowRunSchema.parse(bodyRaw);
    const workspaceId = requestContext.workspace.workspaceId;
    const userId = requestContext.workspace.userId;
    const workflowId = this.getPathId(workflowIdRaw, "workflowId");
    const run = await this.service.createWorkflowRun({
      workspaceId,
      workflowId,
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
      measureReportDocumentId: body.measureReportDocumentId ?? null,
      inputPayload: body.inputPayload ?? null,
    });

    return this.serializeRun(run);
  }

  @Get("workflow-runs/:runId")
  @RequirePermission(PermissionKey.WORKFLOWS_READ)
  public async getWorkflowRun(
    @Param("runId") runIdRaw: string,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const workspaceId = requestContext.workspace.workspaceId;
    const runId = this.getPathId(runIdRaw, "runId");
    const run = await this.service.getWorkflowRun(workspaceId, runId);
    return this.serializeRun(run);
  }

  private serializeWorkflow(workflow: Awaited<ReturnType<WorkflowService["getWorkflow"]>>): Record<string, unknown> {
    return {
      id: workflow.id,
      moduleKey: workflow.moduleKey,
      key: workflow.key,
      name: workflow.name,
      label: workflow.label,
      description: workflow.description,
      configuration: workflow.configuration,
      versionNo: workflow.versionNo,
      isEnabled: workflow.isEnabled,
      isDefault: workflow.isDefault,
      updatedAt: workflow.updatedAt,
      nodes: workflow.nodes,
      edges: workflow.edges,
    };
  }

  private serializeRun(run: Awaited<ReturnType<WorkflowService["getWorkflowRun"]>>): Record<string, unknown> {
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
      measureReportDocumentId: run.measureReportDocumentId,
      inputPayload: run.inputPayload,
      resultPayload: run.resultPayload,
      errorMessage: run.errorMessage,
      queuedAt: run.queuedAt,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      steps: run.steps,
    };
  }

  private normalizeOptionalString(value: string | undefined): string | null {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }

  private getPathId(value: string, key: string): string {
    if (!value || !value.trim()) {
      throw new AppError(`${key} is required.`, "WORKFLOW_PATH_PARAM_REQUIRED", 400);
    }

    return value.trim();
  }
}
