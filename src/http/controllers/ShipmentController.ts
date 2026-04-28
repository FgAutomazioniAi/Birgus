import { FastifyReply } from "fastify";
import { z } from "zod";

import { PermissionKey } from "../../core/authorization/PermissionKey.js";
import { AppError } from "../../core/errors/AppError.js";
import { ModuleKey } from "../../core/module-access/ModuleKey.js";
import { ModuleGuard } from "../middleware/ModuleGuard.js";
import { PermissionGuard } from "../middleware/PermissionGuard.js";
import { AuthenticatedRequest } from "../types/AuthenticatedRequest.js";
import { CreateShipmentCommand } from "../../modules/shipping/dto/CreateShipmentCommand.js";
import { ShipmentService } from "../../modules/shipping/services/ShipmentService.js";

const createShipmentSchema = z.object({
  code: z.string().min(2),
  clientId: z.string().uuid().nullable().optional(),
  statusKey: z.string().min(1),
  notes: z.string().nullable().optional(),
});

export class ShipmentController {
  private readonly service: ShipmentService;
  private readonly moduleGuard: ModuleGuard;
  private readonly permissionGuard: PermissionGuard;

  public constructor(service: ShipmentService, moduleGuard: ModuleGuard, permissionGuard: PermissionGuard) {
    this.service = service;
    this.moduleGuard = moduleGuard;
    this.permissionGuard = permissionGuard;
  }

  public listShipments = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.SHIPMENT_MANAGEMENT);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.SHIPMENTS_READ);

      const workspaceId = request.requestContext.workspace.workspaceId;
      const shipments = await this.service.listShipments(workspaceId);

      reply.code(200).send({
        workspaceId,
        shipments: shipments.map((item) => ({
          id: item.id,
          code: item.code,
          clientId: item.clientId,
          statusKey: item.statusKey,
          createdAt: item.createdAt,
        })),
      });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public createShipment = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.SHIPMENT_MANAGEMENT);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.SHIPMENTS_WRITE);

      const body = createShipmentSchema.parse(request.body);
      const workspaceId = request.requestContext.workspace.workspaceId;
      const userId = request.requestContext.workspace.userId;

      const created = await this.service.createShipment(
        new CreateShipmentCommand({
          workspaceId,
          code: body.code,
          clientId: body.clientId ?? null,
          statusKey: body.statusKey,
          notes: body.notes ?? null,
          createdByUserId: userId,
        }),
      );

      reply.code(201).send({
        id: created.id,
        code: created.code,
        statusKey: created.statusKey,
      });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

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
