import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { FastifyRequest } from "fastify";

import { RequestContext } from "../../../core/tenancy/RequestContext.js";

export const CurrentRequestContext = createParamDecorator(
  (_data: unknown, context: ExecutionContext): RequestContext => {
    const request = context.switchToHttp().getRequest<FastifyRequest & { requestContext: RequestContext }>();
    return request.requestContext;
  },
);
