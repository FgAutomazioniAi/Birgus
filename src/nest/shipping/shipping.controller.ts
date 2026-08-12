import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, Put, UseGuards } from "@nestjs/common";
import { z } from "zod";

import { PermissionKey } from "../../core/authorization/PermissionKey.js";
import { AppError } from "../../core/errors/AppError.js";
import { ModuleKey } from "../../core/module-access/ModuleKey.js";
import { RequestContext } from "../../core/tenancy/RequestContext.js";
import { CreateShipmentCommand } from "../../modules/shipping/dto/CreateShipmentCommand.js";
import { ShipmentService } from "../../modules/shipping/services/ShipmentService.js";
import { jsonObjectSchema, jsonValueSchema } from "../../shared/validation/json.js";
import { AccessPolicyGuard } from "../auth/access-policy.guard.js";
import { RequestContextAuthGuard } from "../auth/request-context-auth.guard.js";
import { CurrentRequestContext } from "../common/decorators/request-context.decorator.js";
import { RequireModule } from "../common/decorators/require-module.decorator.js";
import { RequirePermission } from "../common/decorators/require-permission.decorator.js";

const createShipmentSchema = z.object({
  projectVersionId: z.number().int().positive(),
  code: z.string().min(2).nullable().optional(),
  statusKey: z.string().min(1).optional(),
  notes: z.string().nullable().optional(),
});

const updateShipmentSpecificationSchema = z.object({
  inputPayload: jsonObjectSchema,
  calculationPayload: jsonObjectSchema,
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
  payload: jsonValueSchema.nullable().optional(),
});

@Controller("/api/shipments")
@UseGuards(RequestContextAuthGuard, AccessPolicyGuard)
@RequireModule(ModuleKey.SHIPMENT_MANAGEMENT)
export class NestShippingController {
  public constructor(
    @Inject(ShipmentService)
    private readonly service: ShipmentService,
  ) {}

  @Get()
  @RequirePermission(PermissionKey.SHIPMENTS_READ)
  public async listShipments(
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const workspaceId = requestContext.workspace.workspaceId;
    const shipments = await this.service.listShipments(workspaceId);

    return {
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
    };
  }

  @Post()
  @HttpCode(201)
  @RequirePermission(PermissionKey.SHIPMENTS_WRITE)
  public async createShipment(
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const body = createShipmentSchema.parse(bodyRaw);
    const workspaceId = requestContext.workspace.workspaceId;
    const userId = requestContext.workspace.userId;

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

    return {
      id: created.id,
      projectVersionId: created.projectVersionId,
      code: created.code,
      statusKey: created.statusKey,
    };
  }

  @Get(":shipmentId")
  @RequirePermission(PermissionKey.SHIPMENTS_READ)
  public async getShipment(
    @Param("shipmentId") shipmentIdRaw: string,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const workspaceId = requestContext.workspace.workspaceId;
    const shipmentId = this.getShipmentId(shipmentIdRaw);
    const shipment = await this.service.getShipment(workspaceId, shipmentId);

    return {
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
    };
  }

  @Patch(":shipmentId/specification")
  @HttpCode(200)
  @RequirePermission(PermissionKey.SHIPMENTS_WRITE)
  public async updateShipmentSpecification(
    @Param("shipmentId") shipmentIdRaw: string,
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const body = updateShipmentSpecificationSchema.parse(bodyRaw);
    const workspaceId = requestContext.workspace.workspaceId;
    const shipmentId = this.getShipmentId(shipmentIdRaw);
    const updated = await this.service.saveShipmentSpecification({
      workspaceId,
      shipmentId,
      inputPayload: body.inputPayload,
      calculationPayload: body.calculationPayload,
    });

    return {
      id: updated.id,
      specificationUpdatedAt: updated.specificationUpdatedAt,
    };
  }

  @Put(":shipmentId/items")
  @HttpCode(200)
  @RequirePermission(PermissionKey.SHIPMENTS_WRITE)
  public async replaceShipmentItems(
    @Param("shipmentId") shipmentIdRaw: string,
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const body = replaceShipmentItemsSchema.parse(bodyRaw);
    const workspaceId = requestContext.workspace.workspaceId;
    const shipmentId = this.getShipmentId(shipmentIdRaw);
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

    return {
      id: updated.id,
      items: updated.items,
    };
  }

  @Post(":shipmentId/events")
  @HttpCode(201)
  @RequirePermission(PermissionKey.SHIPMENTS_WRITE)
  public async addShipmentEvent(
    @Param("shipmentId") shipmentIdRaw: string,
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const body = addShipmentEventSchema.parse(bodyRaw);
    const workspaceId = requestContext.workspace.workspaceId;
    const userId = requestContext.workspace.userId;
    const shipmentId = this.getShipmentId(shipmentIdRaw);
    const updated = await this.service.addShipmentEvent({
      workspaceId,
      shipmentId,
      statusKey: body.statusKey ?? null,
      eventType: body.eventType,
      payload: body.payload ?? null,
      actorUserId: userId,
    });

    return {
      id: updated.id,
      events: updated.events,
    };
  }

  private getShipmentId(shipmentId: string): string {
    if (!shipmentId || !shipmentId.trim()) {
      throw new AppError("Shipment ID is required.", "SHIPMENT_ID_REQUIRED", 400);
    }

    return shipmentId.trim();
  }
}
