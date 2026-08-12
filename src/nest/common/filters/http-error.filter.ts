import { ArgumentsHost, Catch, ExceptionFilter } from "@nestjs/common";
import { FastifyReply } from "fastify";
import { ZodError } from "zod";

import { AppError } from "../../../core/errors/AppError.js";

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  public catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<FastifyReply>();

    if (exception instanceof ZodError) {
      response.status(400).send({
        code: "VALIDATION_ERROR",
        message: "Invalid payload.",
        issues: exception.issues,
      });
      return;
    }

    if (exception instanceof AppError) {
      response.status(exception.statusCode).send({
        code: exception.code,
        message: exception.message,
      });
      return;
    }

    console.error("[Nest][HttpErrorFilter] Unexpected error", exception);

    response.status(500).send({
      code: "INTERNAL_ERROR",
      message: "Unexpected error.",
    });
  }
}
