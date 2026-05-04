import { FastifyReply } from "fastify";
import { z } from "zod";

import { AppError } from "../../core/errors/AppError.js";
import { UserPreferenceService } from "../../modules/preferences/services/UserPreferenceService.js";
import { AuthenticatedRequest } from "../types/AuthenticatedRequest.js";

const patchPreferencesSchema = z.object({
  paletteId: z.string().min(1).optional(),
  languageCode: z.string().min(2).optional(),
  righeProgetti: z.number().int().min(1).max(500).optional(),
  righeClienti: z.number().int().min(1).max(500).optional(),
  righeSpedizioni: z.number().int().min(1).max(500).optional(),
  colonneProgetti: z.unknown().optional(),
  colonneClienti: z.unknown().optional(),
  colonneSpedizioni: z.unknown().optional(),
  rowsProjects: z.number().int().min(1).max(500).optional(),
  rowsClients: z.number().int().min(1).max(500).optional(),
  rowsShipments: z.number().int().min(1).max(500).optional(),
  columnsProjects: z.unknown().optional(),
  columnsClients: z.unknown().optional(),
  columnsShipments: z.unknown().optional(),
});

export class UserPreferenceController {
  private readonly service: UserPreferenceService;

  public constructor(service: UserPreferenceService) {
    this.service = service;
  }

  public get = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      const workspaceId = request.requestContext.workspace.workspaceId;
      const userId = request.requestContext.workspace.userId;
      const preferences = await this.service.getPreferences(userId, workspaceId);

      if (!preferences) {
        reply.code(200).send({
          paletteId: "predefinito",
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
        });
        return;
      }

      reply.code(200).send({
        paletteId: preferences.paletteId,
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
      });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public patch = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      const body = patchPreferencesSchema.parse(request.body);
      const workspaceId = request.requestContext.workspace.workspaceId;
      const userId = request.requestContext.workspace.userId;

      const updated = await this.service.updatePreferences(userId, workspaceId, {
        paletteId: body.paletteId,
        languageCode: body.languageCode,
        rowsProjects: body.rowsProjects ?? body.righeProgetti,
        rowsClients: body.rowsClients ?? body.righeClienti,
        rowsShipments: body.rowsShipments ?? body.righeSpedizioni,
        columnsProjects: body.columnsProjects ?? body.colonneProgetti,
        columnsClients: body.columnsClients ?? body.colonneClienti,
        columnsShipments: body.columnsShipments ?? body.colonneSpedizioni,
      });

      reply.code(200).send({
        paletteId: updated.paletteId,
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
