import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { AppError } from "../../core/errors/AppError.js";
import { ModuleOverrideMode } from "@prisma/client";
import { SuperadminService } from "../../modules/superadmin/services/SuperadminService.js";
import { AuthenticatedRequest } from "../types/AuthenticatedRequest.js";

const usersQuerySchema = z.object({
  search: z.string().trim().optional(),
});

const userParamsSchema = z.object({
  userId: z.string().uuid(),
});

const userModulesQuerySchema = z.object({
  workspaceId: z.string().uuid(),
});

const resetPasswordSchema = z.object({
  newPassword: z.string().min(5),
});

const moduleOverrideSchema = z.object({
  workspaceId: z.string().uuid(),
  userId: z.string().uuid(),
  moduleKey: z.string().trim().min(1),
  mode: z.enum(["ALLOW", "DENY"]),
  reason: z.string().trim().max(500).optional(),
});

const clearModuleOverrideSchema = z.object({
  workspaceId: z.string().uuid(),
  userId: z.string().uuid(),
  moduleKey: z.string().trim().min(1),
  confirmText: z.literal("cancella"),
});

const workspaceRolesSchema = z.object({
  workspaceId: z.string().uuid(),
  userId: z.string().uuid(),
  roleKeys: z.array(z.string().trim().min(1)).min(1),
});

const archiveParamsSchema = z.object({
  entityType: z.enum(["project", "project_version", "shipment", "document"]),
  entityId: z.string().min(1),
});

const restoreArchiveSchema = z.object({
  workspaceId: z.string().uuid(),
});

const hardDeleteArchiveSchema = z.object({
  workspaceId: z.string().uuid(),
  confirmText: z.literal("ELIMINA DEFINITIVAMENTE"),
  reason: z.string().trim().min(10).max(1000),
});

export class SuperadminController {
  private readonly service: SuperadminService;

  public constructor(service: SuperadminService) {
    this.service = service;
  }

  public listWorkspaces = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.ensureSuperadmin(request);
      const workspaces = await this.service.listWorkspaces();
      reply.code(200).send({ workspaces });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public listRoles = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.ensureSuperadmin(request);
      const roles = await this.service.listRoles();
      reply.code(200).send({ roles });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public listModules = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.ensureSuperadmin(request);
      const modules = await this.service.listModules();
      reply.code(200).send({ modules });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public listUsers = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.ensureSuperadmin(request);
      const query = usersQuerySchema.parse(request.query);
      const users = await this.service.listUsers(query.search ?? null);
      reply.code(200).send({ users });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public listUserMemberships = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.ensureSuperadmin(request);
      const params = userParamsSchema.parse(request.params);
      const memberships = await this.service.listUserMemberships(params.userId);
      reply.code(200).send({ userId: params.userId, memberships });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public listUserModules = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.ensureSuperadmin(request);
      const params = userParamsSchema.parse(request.params);
      const query = userModulesQuerySchema.parse(request.query);
      const modules = await this.service.listUserModules({
        workspaceId: query.workspaceId,
        userId: params.userId,
      });

      reply.code(200).send({
        workspaceId: query.workspaceId,
        userId: params.userId,
        modules,
      });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public resetUserPassword = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.ensureSuperadmin(request);
      const params = userParamsSchema.parse(request.params);
      const body = resetPasswordSchema.parse(request.body);

      await this.service.resetUserPassword({
        targetUserId: params.userId,
        newPassword: body.newPassword,
        auditContext: this.getAuditContext(request),
      });

      reply.code(200).send({ ok: true });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public revokeUserSessions = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.ensureSuperadmin(request);
      const params = userParamsSchema.parse(request.params);

      await this.service.revokeUserSessions({
        targetUserId: params.userId,
        auditContext: this.getAuditContext(request),
      });

      reply.code(200).send({ ok: true });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public resetUserTwoFactor = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.ensureSuperadmin(request);
      const params = userParamsSchema.parse(request.params);

      await this.service.resetUserTwoFactor({
        targetUserId: params.userId,
        auditContext: this.getAuditContext(request),
      });

      reply.code(200).send({ ok: true });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public setModuleOverride = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.ensureSuperadmin(request);
      const body = moduleOverrideSchema.parse(request.body);

      await this.service.setModuleOverride({
        workspaceId: body.workspaceId,
        targetUserId: body.userId,
        moduleKey: body.moduleKey,
        mode: body.mode as ModuleOverrideMode,
        reason: body.reason ?? null,
        auditContext: this.getAuditContext(request),
      });

      reply.code(200).send({ ok: true });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public clearModuleOverride = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.ensureSuperadmin(request);
      const body = clearModuleOverrideSchema.parse(request.body);

      await this.service.clearModuleOverride({
        workspaceId: body.workspaceId,
        targetUserId: body.userId,
        moduleKey: body.moduleKey,
        auditContext: this.getAuditContext(request),
      });

      reply.code(200).send({ ok: true });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public replaceWorkspaceRoles = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.ensureSuperadmin(request);
      const body = workspaceRolesSchema.parse(request.body);

      await this.service.replaceWorkspaceRoles({
        workspaceId: body.workspaceId,
        targetUserId: body.userId,
        roleKeys: body.roleKeys,
        auditContext: this.getAuditContext(request),
      });

      reply.code(200).send({ ok: true });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public restoreArchive = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.ensureSuperadmin(request);
      const params = archiveParamsSchema.parse(request.params);
      const body = restoreArchiveSchema.parse(request.body);

      await this.service.restoreArchivedItem({
        workspaceId: body.workspaceId,
        entityType: params.entityType,
        entityId: params.entityId,
        auditContext: this.getAuditContext(request),
      });

      reply.code(200).send({ ok: true });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public hardDeleteArchive = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.ensureSuperadmin(request);
      const params = archiveParamsSchema.parse(request.params);
      const body = hardDeleteArchiveSchema.parse(request.body);

      await this.service.permanentlyDeleteArchivedItem({
        workspaceId: body.workspaceId,
        entityType: params.entityType,
        entityId: params.entityId,
        reason: body.reason,
        auditContext: this.getAuditContext(request),
      });

      reply.code(200).send({ ok: true });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  private async ensureSuperadmin(request: AuthenticatedRequest): Promise<void> {
    await this.service.assertSuperadmin(request.requestContext.workspace.userId);
  }

  private getAuditContext(request: AuthenticatedRequest): {
    actorUserId: string;
    actorWorkspaceId: string;
    ipAddress: string | null;
    userAgent: string | null;
  } {
    return {
      actorUserId: request.requestContext.workspace.userId,
      actorWorkspaceId: request.requestContext.workspace.workspaceId,
      ipAddress: this.getIpAddress(request),
      userAgent: this.getUserAgent(request),
    };
  }

  private getIpAddress(request: FastifyRequest): string | null {
    const forwarded = request.headers["x-forwarded-for"];

    if (typeof forwarded === "string" && forwarded.trim()) {
      return forwarded.split(",")[0]?.trim() ?? null;
    }

    const realIp = request.headers["x-real-ip"];
    if (typeof realIp === "string" && realIp.trim()) {
      return realIp.trim();
    }

    return null;
  }

  private getUserAgent(request: FastifyRequest): string | null {
    const value = request.headers["user-agent"];
    return typeof value === "string" && value.trim() ? value.trim() : null;
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
