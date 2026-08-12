import "reflect-metadata";

import multipart from "@fastify/multipart";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

import { AppModule } from "./app.module.js";
import { BackendRuntimeService } from "./runtime/runtime.service.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: true,
      trustProxy: resolveTrustProxy(),
    }),
  );
  await app.register(multipart, {
    throwFileSizeLimit: true,
    limits: {
      fileSize: resolveNumberEnv("UPLOAD_MAX_FILE_BYTES", 20 * 1024 * 1024),
      files: resolveNumberEnv("UPLOAD_MAX_FILES", 1),
      fields: resolveNumberEnv("UPLOAD_MAX_FIELDS", 20),
    },
  });

  if (shouldEnableSwagger()) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("Birgus API")
      .setVersion("1.0.0")
      .build();
    const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup("/documentation", app, swaggerDocument);
  }

  const port = resolveNestPort();
  const host = resolveNestHost();

  await app.listen(port, host);
  await app.get(BackendRuntimeService).start();
  Logger.log(`Nest HTTP server listening on ${host}:${port}`, "NestBootstrap");
}

function resolveTrustProxy(): boolean | string | number | string[] {
  const raw = (process.env.TRUST_PROXY ?? "").trim();
  if (!raw) {
    return false;
  }

  if (raw === "true") {
    return true;
  }

  if (raw === "false") {
    return false;
  }

  const parsedNumber = Number.parseInt(raw, 10);
  if (!Number.isNaN(parsedNumber) && String(parsedNumber) === raw) {
    return parsedNumber;
  }

  if (raw.includes(",")) {
    return raw
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }

  return raw;
}

function resolveNestHost(): string {
  return resolveStringEnv("NEST_HOST", resolveStringEnv("HOST", "0.0.0.0"));
}

function resolveNestPort(): number {
  return resolveNumberEnv("NEST_PORT", resolveNumberEnv("PORT", 3000));
}

function shouldEnableSwagger(): boolean {
  const explicit = process.env.ENABLE_SWAGGER?.trim();
  if (explicit) {
    return ["1", "true", "yes", "on"].includes(explicit.toLowerCase());
  }

  return process.env.NODE_ENV !== "production";
}

function resolveStringEnv(key: string, fallback: string): string {
  const value = process.env[key];
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function resolveNumberEnv(key: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[key] ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

bootstrap().catch((error) => {
  console.error("Nest HTTP server startup failed.", error);
  process.exitCode = 1;
});
