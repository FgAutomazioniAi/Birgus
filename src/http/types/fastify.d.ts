import "fastify";

import { RequestContext } from "../../core/tenancy/RequestContext.js";

declare module "fastify" {
  interface FastifyRequest {
    requestContext: RequestContext;
  }
}
