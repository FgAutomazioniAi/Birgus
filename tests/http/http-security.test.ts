import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";

import multipart from "@fastify/multipart";
import fastify, { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z, ZodError } from "zod";

import { AppError } from "../../src/core/errors/AppError.js";
import { MultipartFormReader } from "../../src/shared/http/MultipartFormReader.js";
import { SessionCookieFactory } from "../../src/shared/http/SessionCookieFactory.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const uploadedDocuments: Array<{ fileName: string; mimeType: string; bytes: Buffer }> = [];

let app: FastifyInstance;

before(async () => {
  app = fastify({ logger: false });
  await app.register(multipart, {
    throwFileSizeLimit: true,
    limits: {
      fileSize: 1024 * 1024,
      files: 1,
      fields: 5,
    },
  });

  app.setErrorHandler((error: unknown, _request: FastifyRequest, reply: FastifyReply) => {
    if (error instanceof ZodError) {
      reply.status(400).send({
        code: "VALIDATION_ERROR",
        message: "Invalid payload.",
        issues: error.issues,
      });
      return;
    }

    if (error instanceof AppError) {
      reply.status(error.statusCode).send({
        code: error.code,
        message: error.message,
      });
      return;
    }

    reply.status(500).send({
      code: "INTERNAL_ERROR",
      message: "Unexpected error.",
    });
  });

  app.post("/api/auth/login", async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const normalizedEmail = body.email.trim().toLowerCase();
    const cookie = new SessionCookieFactory({ cookieName: "birgus_test", secure: true })
      .createSessionCookie(`token-for-${normalizedEmail}`, 3600);
    reply.header("Set-Cookie", cookie);
    return {
      ok: true,
      user: {
        email: normalizedEmail,
      },
    };
  });

  app.post("/api/ddt-reader/documents", async (request) => {
    assertAuthorized(request);
    const multipartPayload = await MultipartFormReader.read(request);
    const uploaded = multipartPayload.files.find((item) => item.fieldName === "file") ?? multipartPayload.files[0];
    if (!uploaded) {
      throw new AppError("File mancante.", "DDT_FILE_REQUIRED", 400);
    }

    if (!isPdfFile(uploaded.fileName, uploaded.mimeType, uploaded.bytes)) {
      throw new AppError("Sono accettati solo file PDF.", "DDT_FILE_EXTENSION_INVALID", 400);
    }

    uploadedDocuments.push(uploaded);
    return {
      id: "ddt-1",
      fileName: uploaded.fileName,
    };
  });

  await app.ready();
});

beforeEach(() => {
  uploadedDocuments.length = 0;
});

after(async () => {
  await app.close();
});

test("HTTP auth login rejects invalid payloads with validation errors", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: {
      email: "not-an-email",
      password: "",
    },
  });

  assert.equal(response.statusCode, 400);
  const body = response.json() as { code?: string; message?: string };
  assert.equal(body.code, "VALIDATION_ERROR");
  assert.equal(body.message, "Invalid payload.");
});

test("HTTP auth login sets an HttpOnly Secure session cookie", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: {
      email: "User@Example.Test",
      password: "correct-password",
    },
  });

  assert.equal(response.statusCode, 200);
  const setCookie = response.headers["set-cookie"];
  assert.equal(typeof setCookie, "string");
  assert.match(String(setCookie), /birgus_test=token-for-user%40example\.test/);
  assert.match(String(setCookie), /HttpOnly/);
  assert.match(String(setCookie), /Secure/);
});

test("HTTP protected upload endpoints reject missing authorization", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/ddt-reader/documents",
    headers: multipartHeaders("----birgus-test-boundary"),
    payload: multipartBody("----birgus-test-boundary", "document.pdf", "application/pdf", "%PDF-1.7\n"),
  });

  assert.equal(response.statusCode, 401);
  assert.equal((response.json() as { code?: string }).code, "AUTH_TOKEN_REQUIRED");
});

test("HTTP DDT upload rejects fake PDFs even with application/pdf MIME", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/ddt-reader/documents",
    headers: {
      authorization: "Bearer valid-token",
      ...multipartHeaders("----birgus-test-boundary"),
    },
    payload: multipartBody("----birgus-test-boundary", "fake.pdf", "application/pdf", "not a pdf"),
  });

  assert.equal(response.statusCode, 400);
  assert.equal((response.json() as { code?: string }).code, "DDT_FILE_EXTENSION_INVALID");
  assert.equal(uploadedDocuments.length, 0);
});

test("HTTP DDT upload accepts real PDF signatures and sanitizes filenames", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/ddt-reader/documents",
    headers: {
      authorization: "Bearer valid-token",
      ...multipartHeaders("----birgus-test-boundary"),
    },
    payload: multipartBody("----birgus-test-boundary", "../unsafe/<ddt>.pdf", "application/pdf", "%PDF-1.7\n"),
  });

  assert.equal(response.statusCode, 200);
  assert.equal(uploadedDocuments.length, 1);
  assert.equal(uploadedDocuments[0]?.fileName, "_ddt_.pdf");
  assert.equal(uploadedDocuments[0]?.bytes.subarray(0, 5).toString("latin1"), "%PDF-");
});

function assertAuthorized(request: FastifyRequest): void {
  if (request.headers.authorization !== "Bearer valid-token") {
    throw new AppError("Missing authentication token.", "AUTH_TOKEN_REQUIRED", 401);
  }
}

function isPdfFile(fileName: string, mimeType: string, bytes: Buffer): boolean {
  const hasPdfNameOrMime = mimeType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");
  return hasPdfNameOrMime && bytes.subarray(0, 5).toString("latin1") === "%PDF-";
}

function multipartHeaders(boundary: string): Record<string, string> {
  return {
    "content-type": `multipart/form-data; boundary=${boundary}`,
  };
}

function multipartBody(boundary: string, filename: string, contentType: string, content: string): string {
  return [
    `--${boundary}`,
    `Content-Disposition: form-data; name="file"; filename="${filename}"`,
    `Content-Type: ${contentType}`,
    "",
    content,
    `--${boundary}--`,
    "",
  ].join("\r\n");
}
