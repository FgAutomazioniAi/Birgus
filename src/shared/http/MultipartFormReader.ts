import { FastifyRequest } from "fastify";

import { AppError } from "../../core/errors/AppError.js";

export interface MultipartFormFile {
  fieldName: string;
  fileName: string;
  mimeType: string;
  bytes: Buffer;
}

export interface MultipartFormPayload {
  fields: Record<string, string>;
  files: MultipartFormFile[];
}

export class MultipartFormReader {
  public static async read(request: FastifyRequest): Promise<MultipartFormPayload> {
    const partsMethod = (request as { parts?: () => AsyncIterable<any> }).parts;
    if (typeof partsMethod !== "function") {
      throw new AppError("Multipart non disponibile su questo endpoint.", "MULTIPART_NOT_AVAILABLE", 400);
    }

    const fields: Record<string, string> = {};
    const files: MultipartFormFile[] = [];

    for await (const part of partsMethod.call(request)) {
      if (part?.type === "file") {
        const bytes = await part.toBuffer();
        files.push({
          fieldName: String(part.fieldname ?? "file"),
          fileName: MultipartFormReader.sanitizeFileName(String(part.filename ?? "file.bin")),
          mimeType: String(part.mimetype ?? "application/octet-stream"),
          bytes,
        });
        continue;
      }

      const fieldName = String(part?.fieldname ?? "").trim();
      if (!fieldName) {
        continue;
      }

      const value = part?.value;
      fields[fieldName] = typeof value === "string" ? value : String(value ?? "");
    }

    return { fields, files };
  }

  private static sanitizeFileName(fileName: string): string {
    const normalized = fileName.replace(/\\/g, "/").split("/").pop()?.trim() ?? "";
    const safeName = normalized.replace(/[^a-zA-Z0-9._ -]/g, "_").replace(/\s+/g, " ");
    return safeName || "file.bin";
  }
}
