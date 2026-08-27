import { Body, Controller, Get, HttpCode, Inject, Patch, UseGuards } from "@nestjs/common";
import { z } from "zod";

import { RequestContext } from "../../core/tenancy/RequestContext.js";
import { UserPreferenceService } from "../../modules/preferences/services/UserPreferenceService.js";
import { jsonValueSchema } from "../../shared/validation/json.js";
import { RequestContextAuthGuard } from "../auth/request-context-auth.guard.js";
import { CurrentRequestContext } from "../common/decorators/request-context.decorator.js";

const columnConfigSchema = z.object({
  hidden: z.array(z.string().min(1).max(80)).max(80),
  order: z.array(z.string().min(1).max(80)).max(80),
}).strict();

const patchPreferencesSchema = z.object({
  paletteId: z.string().min(1).optional(),
  notificationPosition: z.enum([
    "top-left",
    "top-center",
    "top-right",
    "bottom-left",
    "bottom-center",
    "bottom-right",
  ]).optional(),
  notificationPopups: z.boolean().optional(),
  languageCode: z.string().min(2).optional(),
  righeProgetti: z.number().int().min(1).max(500).optional(),
  righeClienti: z.number().int().min(1).max(500).optional(),
  righeSpedizioni: z.number().int().min(1).max(500).optional(),
  colonneProgetti: columnConfigSchema.nullable().optional(),
  colonneClienti: columnConfigSchema.nullable().optional(),
  colonneSpedizioni: columnConfigSchema.nullable().optional(),
  rowsProjects: z.number().int().min(1).max(500).optional(),
  rowsClients: z.number().int().min(1).max(500).optional(),
  rowsShipments: z.number().int().min(1).max(500).optional(),
  columnsProjects: columnConfigSchema.nullable().optional(),
  columnsClients: columnConfigSchema.nullable().optional(),
  columnsShipments: columnConfigSchema.nullable().optional(),
}).catchall(jsonValueSchema.optional());

@Controller("/api/user/preferences")
@UseGuards(RequestContextAuthGuard)
export class NestPreferencesController {
  public constructor(
    @Inject(UserPreferenceService)
    private readonly service: UserPreferenceService,
  ) {}

  @Get()
  public async get(
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const workspaceId = requestContext.workspace.workspaceId;
    const userId = requestContext.workspace.userId;
    const preferences = await this.service.getPreferences(userId, workspaceId);

    if (!preferences) {
      return {
        paletteId: "predefinito",
        notificationPosition: "bottom-right",
        notificationPopups: true,
        languageCode: "it",
        righeProgetti: 10,
        righeClienti: 10,
        righeSpedizioni: 10,
        colonneProgetti: null,
        colonneClienti: null,
        colonneSpedizioni: null,
        rowsProjects: 10,
        rowsClients: 10,
        rowsShipments: 10,
        columnsProjects: null,
        columnsClients: null,
        columnsShipments: null,
      };
    }

    return {
      paletteId: preferences.paletteId,
      notificationPosition: preferences.notificationPosition,
      notificationPopups: preferences.notificationPopups,
      languageCode: preferences.languageCode,
      righeProgetti: preferences.rowsProjects,
      righeClienti: preferences.rowsClients,
      righeSpedizioni: preferences.rowsShipments,
      colonneProgetti: preferences.columnsProjects,
      colonneClienti: preferences.columnsClients,
      colonneSpedizioni: preferences.columnsShipments,
      rowsProjects: preferences.rowsProjects,
      rowsClients: preferences.rowsClients,
      rowsShipments: preferences.rowsShipments,
      columnsProjects: preferences.columnsProjects,
      columnsClients: preferences.columnsClients,
      columnsShipments: preferences.columnsShipments,
    };
  }

  @Patch()
  @HttpCode(200)
  public async patch(
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const body = patchPreferencesSchema.parse(bodyRaw);
    const workspaceId = requestContext.workspace.workspaceId;
    const userId = requestContext.workspace.userId;

    const updated = await this.service.updatePreferences(userId, workspaceId, {
      paletteId: body.paletteId,
      notificationPosition: body.notificationPosition,
      notificationPopups: body.notificationPopups,
      languageCode: body.languageCode,
      rowsProjects: body.rowsProjects ?? body.righeProgetti,
      rowsClients: body.rowsClients ?? body.righeClienti,
      rowsShipments: body.rowsShipments ?? body.righeSpedizioni,
      columnsProjects: body.columnsProjects ?? body.colonneProgetti,
      columnsClients: body.columnsClients ?? body.colonneClienti,
      columnsShipments: body.columnsShipments ?? body.colonneSpedizioni,
    });

    return {
      paletteId: updated.paletteId,
      notificationPosition: updated.notificationPosition,
      notificationPopups: updated.notificationPopups,
      languageCode: updated.languageCode,
      righeProgetti: updated.rowsProjects,
      righeClienti: updated.rowsClients,
      righeSpedizioni: updated.rowsShipments,
      colonneProgetti: updated.columnsProjects,
      colonneClienti: updated.columnsClients,
      colonneSpedizioni: updated.columnsShipments,
      rowsProjects: updated.rowsProjects,
      rowsClients: updated.rowsClients,
      rowsShipments: updated.rowsShipments,
      columnsProjects: updated.columnsProjects,
      columnsClients: updated.columnsClients,
      columnsShipments: updated.columnsShipments,
    };
  }
}
