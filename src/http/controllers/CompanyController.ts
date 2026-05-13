import { FastifyReply } from "fastify";
import { z } from "zod";

import { PermissionKey } from "../../core/authorization/PermissionKey.js";
import { AppError } from "../../core/errors/AppError.js";
import { ModuleKey } from "../../core/module-access/ModuleKey.js";
import { CompanyService } from "../../modules/companies/services/CompanyService.js";
import { CreateCompanyCommand } from "../../modules/companies/dto/CreateCompanyCommand.js";
import { UpdateCompanyCommand } from "../../modules/companies/dto/UpdateCompanyCommand.js";
import { ModuleGuard } from "../middleware/ModuleGuard.js";
import { PermissionGuard } from "../middleware/PermissionGuard.js";
import { AuthenticatedRequest } from "../types/AuthenticatedRequest.js";

const payloadSchema = z.object({
  name: z.string().min(2),
  address: z.string().trim().optional().default(""),
  postalCode: z.string().trim().optional().default(""),
  city: z.string().trim().optional().default(""),
});

export class CompanyController {
  public constructor(
    private readonly service: CompanyService,
    private readonly moduleGuard: ModuleGuard,
    private readonly permissionGuard: PermissionGuard,
  ) {}

  public list = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.PROJECT_MANAGEMENT);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.CLIENTS_READ);
      const items = await this.service.list(request.requestContext.workspace.workspaceId);
      reply.code(200).send(items.map((item) => ({
        id: item.id,
        name: item.name,
        address: item.address,
        postalCode: item.postalCode,
        city: item.city,
      })));
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public getById = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.PROJECT_MANAGEMENT);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.CLIENTS_READ);
      const item = await this.service.getById(request.requestContext.workspace.workspaceId, this.getCompanyId(request));
      reply.code(200).send({
        id: item.id,
        name: item.name,
        address: item.address,
        postalCode: item.postalCode,
        city: item.city,
      });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public create = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.PROJECT_MANAGEMENT);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.CLIENTS_WRITE);
      const body = payloadSchema.parse(request.body);
      const created = await this.service.create(new CreateCompanyCommand({
        workspaceId: request.requestContext.workspace.workspaceId,
        name: body.name,
        address: body.address,
        postalCode: body.postalCode,
        city: body.city,
        actorUserId: request.requestContext.workspace.userId,
      }));
      reply.code(201).send({
        id: created.id,
        name: created.name,
        address: created.address,
        postalCode: created.postalCode,
        city: created.city,
      });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public update = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.PROJECT_MANAGEMENT);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.CLIENTS_WRITE);
      const body = payloadSchema.parse(request.body);
      const updated = await this.service.update(new UpdateCompanyCommand({
        workspaceId: request.requestContext.workspace.workspaceId,
        companyId: this.getCompanyId(request),
        name: body.name,
        address: body.address,
        postalCode: body.postalCode,
        city: body.city,
        actorUserId: request.requestContext.workspace.userId,
      }));
      reply.code(200).send({
        id: updated.id,
        name: updated.name,
        address: updated.address,
        postalCode: updated.postalCode,
        city: updated.city,
      });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public delete = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.PROJECT_MANAGEMENT);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.CLIENTS_WRITE);
      const companyId = this.getCompanyId(request);
      await this.service.delete(request.requestContext.workspace.workspaceId, companyId, request.requestContext.workspace.userId);
      reply.code(200).send({ ok: true, id: companyId });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  private getCompanyId(request: AuthenticatedRequest): number {
    const value = (request.params as { companyId?: string }).companyId;
    const parsed = Number.parseInt(value ?? "", 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new AppError("Company ID is invalid.", "COMPANY_ID_INVALID", 400);
    }

    return parsed;
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
