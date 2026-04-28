import { FastifyReply } from "fastify";
import { z } from "zod";

import { PermissionKey } from "../../core/authorization/PermissionKey.js";
import { AppError } from "../../core/errors/AppError.js";
import { ModuleKey } from "../../core/module-access/ModuleKey.js";
import { CreateClientCommand } from "../../modules/clients/dto/CreateClientCommand.js";
import { UpdateClientCommand } from "../../modules/clients/dto/UpdateClientCommand.js";
import { ClientService } from "../../modules/clients/services/ClientService.js";
import { ModuleGuard } from "../middleware/ModuleGuard.js";
import { PermissionGuard } from "../middleware/PermissionGuard.js";
import { AuthenticatedRequest } from "../types/AuthenticatedRequest.js";

const createClientSchema = z.object({
  name: z.string().min(2),
  email: z.string().trim().optional().default(""),
  phone: z.string().trim().optional().default(""),
  notes: z.string().trim().optional().default(""),
});

const updateClientSchema = z.object({
  name: z.string().min(2),
  email: z.string().trim().optional().default(""),
  phone: z.string().trim().optional().default(""),
  notes: z.string().trim().optional().default(""),
});

export class ClientController {
  private readonly service: ClientService;
  private readonly moduleGuard: ModuleGuard;
  private readonly permissionGuard: PermissionGuard;

  public constructor(service: ClientService, moduleGuard: ModuleGuard, permissionGuard: PermissionGuard) {
    this.service = service;
    this.moduleGuard = moduleGuard;
    this.permissionGuard = permissionGuard;
  }

  public list = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.PROJECT_MANAGEMENT);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.CLIENTS_READ);

      const workspaceId = request.requestContext.workspace.workspaceId;
      const clients = await this.service.list(workspaceId);

      reply.code(200).send(
        clients.map((item) => ({
          id: item.id,
          name: item.name,
          email: item.email,
          phone: item.phone,
          notes: item.notes,
        })),
      );
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public getById = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.PROJECT_MANAGEMENT);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.CLIENTS_READ);

      const workspaceId = request.requestContext.workspace.workspaceId;
      const clientId = this.getClientId(request);
      const client = await this.service.getById(workspaceId, clientId);

      reply.code(200).send({
        id: client.id,
        name: client.name,
        email: client.email,
        phone: client.phone,
        notes: client.notes,
      });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public create = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.PROJECT_MANAGEMENT);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.CLIENTS_WRITE);

      const body = createClientSchema.parse(request.body);
      const workspaceId = request.requestContext.workspace.workspaceId;
      const created = await this.service.create(
        new CreateClientCommand({
          workspaceId,
          name: body.name,
          email: body.email,
          phone: body.phone,
          notes: body.notes,
        }),
      );

      reply.code(201).send({
        id: created.id,
        name: created.name,
        email: created.email,
        phone: created.phone,
        notes: created.notes,
      });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public update = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.PROJECT_MANAGEMENT);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.CLIENTS_WRITE);

      const body = updateClientSchema.parse(request.body);
      const workspaceId = request.requestContext.workspace.workspaceId;
      const clientId = this.getClientId(request);
      const updated = await this.service.update(
        new UpdateClientCommand({
          workspaceId,
          clientId,
          name: body.name,
          email: body.email,
          phone: body.phone,
          notes: body.notes,
        }),
      );

      reply.code(200).send({
        id: updated.id,
        name: updated.name,
        email: updated.email,
        phone: updated.phone,
        notes: updated.notes,
      });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public delete = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.PROJECT_MANAGEMENT);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.CLIENTS_WRITE);

      const workspaceId = request.requestContext.workspace.workspaceId;
      const clientId = this.getClientId(request);
      await this.service.delete(workspaceId, clientId);

      reply.code(200).send({ ok: true, id: clientId });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  private getClientId(request: AuthenticatedRequest): string {
    const value = (request.params as { clientId?: string }).clientId;
    if (!value || !value.trim()) {
      throw new AppError("Client ID is required.", "CLIENT_ID_REQUIRED", 400);
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
