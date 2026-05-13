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
  projectVersionId: z.number().int().positive(),
  code: z.string().min(2).nullable().optional(),
  statusKey: z.string().min(1).optional(),
  notes: z.string().nullable().optional(),
});

const updateShipmentSpecificationSchema = z.object({
  inputPayload: z.unknown(),
  calculationPayload: z.unknown(),
});

const replaceShipmentItemsSchema = z.object({
  items: z.array(z.object({
    sku: z.string().nullable().optional(),
    description: z.string().min(1),
    quantity: z.number().positive(),
    unit: z.string().nullable().optional(),
    weightKg: z.number().positive().nullable().optional(),
  })),
});

const addShipmentEventSchema = z.object({
  statusKey: z.string().min(1).nullable().optional(),
  eventType: z.string().min(1),
  payload: z.unknown().nullable().optional(),
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
          projectId: item.projectId,
          projectName: item.projectName,
          projectVersionId: item.projectVersionId,
          projectVersionLabel: item.projectVersionLabel,
          code: item.code,
          clientId: item.clientId,
          clientName: item.clientName,
          statusKey: item.statusKey,
          specificationUpdatedAt: item.specificationUpdatedAt,
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
          projectVersionId: body.projectVersionId,
          code: body.code ?? null,
          statusKey: body.statusKey ?? "draft",
          notes: body.notes ?? null,
          createdByUserId: userId,
        }),
      );

      reply.code(201).send({
        id: created.id,
        projectVersionId: created.projectVersionId,
        code: created.code,
        statusKey: created.statusKey,
      });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public getShipment = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.SHIPMENT_MANAGEMENT);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.SHIPMENTS_READ);

      const workspaceId = request.requestContext.workspace.workspaceId;
      const shipmentId = this.getShipmentId(request);
      const shipment = await this.service.getShipment(workspaceId, shipmentId);

      reply.code(200).send({
        id: shipment.id,
        projectId: shipment.projectId,
        projectName: shipment.projectName,
        projectVersionId: shipment.projectVersionId,
        projectVersionLabel: shipment.projectVersionLabel,
        code: shipment.code,
        clientId: shipment.clientId,
        clientName: shipment.clientName,
        statusKey: shipment.statusKey,
        notes: shipment.notes,
        specification: shipment.specificationInput || shipment.specificationCalculation
          ? {
              inputPayload: shipment.specificationInput,
              calculationPayload: shipment.specificationCalculation,
              updatedAt: shipment.specificationUpdatedAt,
            }
          : null,
        items: shipment.items,
        events: shipment.events,
        createdAt: shipment.createdAt,
      });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public updateShipmentSpecification = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.SHIPMENT_MANAGEMENT);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.SHIPMENTS_WRITE);

      const body = updateShipmentSpecificationSchema.parse(request.body);
      const workspaceId = request.requestContext.workspace.workspaceId;
      const shipmentId = this.getShipmentId(request);
      const updated = await this.service.saveShipmentSpecification({
        workspaceId,
        shipmentId,
        inputPayload: body.inputPayload,
        calculationPayload: body.calculationPayload,
      });

      reply.code(200).send({
        id: updated.id,
        specificationUpdatedAt: updated.specificationUpdatedAt,
      });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public replaceShipmentItems = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.SHIPMENT_MANAGEMENT);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.SHIPMENTS_WRITE);

      const body = replaceShipmentItemsSchema.parse(request.body);
      const workspaceId = request.requestContext.workspace.workspaceId;
      const shipmentId = this.getShipmentId(request);
      const updated = await this.service.replaceShipmentItems({
        workspaceId,
        shipmentId,
        items: body.items.map((item) => ({
          sku: item.sku ?? null,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit ?? null,
          weightKg: item.weightKg ?? null,
        })),
      });

      reply.code(200).send({
        id: updated.id,
        items: updated.items,
      });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public addShipmentEvent = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.SHIPMENT_MANAGEMENT);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.SHIPMENTS_WRITE);

      const body = addShipmentEventSchema.parse(request.body);
      const workspaceId = request.requestContext.workspace.workspaceId;
      const userId = request.requestContext.workspace.userId;
      const shipmentId = this.getShipmentId(request);
      const updated = await this.service.addShipmentEvent({
        workspaceId,
        shipmentId,
        statusKey: body.statusKey ?? null,
        eventType: body.eventType,
        payload: body.payload ?? null,
        actorUserId: userId,
      });

      reply.code(201).send({
        id: updated.id,
        events: updated.events,
      });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  private getShipmentId(request: AuthenticatedRequest): string {
    const shipmentId = (request.params as { shipmentId?: string }).shipmentId;
    if (!shipmentId || !shipmentId.trim()) {
      throw new AppError("Shipment ID is required.", "SHIPMENT_ID_REQUIRED", 400);
    }

    return shipmentId.trim();
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
