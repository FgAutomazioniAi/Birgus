import { Prisma } from "@prisma/client";

import { PrismaClientManager } from "../../../database/PrismaClientManager.js";
import { KnowledgeDocumentEntity } from "../domain/KnowledgeDocumentEntity.js";
import { KnowledgeSearchHitEntity } from "../domain/KnowledgeSearchHitEntity.js";
import { KnowledgeChunkWriteModel, KnowledgeRepository, SourceDocumentRecord } from "../repositories/KnowledgeRepository.js";

export class PrismaKnowledgeRepository implements KnowledgeRepository {
  public async findSourceDocumentById(workspaceId: string, documentId: string): Promise<SourceDocumentRecord | null> {
    const prisma = PrismaClientManager.getClient();
    const row = await prisma.document.findFirst({
      where: {
        id: documentId,
        workspace_id: workspaceId,
        deleted_at: null,
      },
      select: {
        id: true,
        workspace_id: true,
        module_id: true,
        domain_entity_type: true,
        domain_entity_id: true,
        filename: true,
        storage_path: true,
        deleted_at: true,
        file_type: {
          select: {
            mime_type: true,
          },
        },
        node: {
          select: {
            path_cache: true,
          },
        },
      },
    });

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      workspaceId: row.workspace_id,
      moduleId: row.module_id,
      nodePath: row.node.path_cache,
      domainEntityType: row.domain_entity_type,
      domainEntityId: row.domain_entity_id,
      filename: row.filename,
      storagePath: row.storage_path,
      contentType: row.file_type.mime_type,
      deletedAt: row.deleted_at,
    };
  }

  public async findKnowledgeDocumentByDocumentId(workspaceId: string, documentId: string, representationKey: string): Promise<KnowledgeDocumentEntity | null> {
    const prisma = PrismaClientManager.getClient();
    const row = await prisma.knowledgeDocument.findFirst({
      where: {
        workspace_id: workspaceId,
        document_id: documentId,
        representation_key: representationKey,
        deleted_at: null,
      },
    });

    return row ? this.toKnowledgeDocumentEntity(row) : null;
  }

  public async upsertKnowledgeDocument(params: {
    workspaceId: string;
    documentId: string | null;
    moduleId: number | null;
    sourceEntityType: string;
    sourceEntityId: string;
    representationKey: string;
    title: string | null;
    sourceLabel: string | null;
    contentText: string | null;
    summaryText: string | null;
    structuredPayload: Record<string, unknown> | null;
    extractionStatus: string;
    extractionKind: string | null;
    contentHash: string | null;
    lastError: string | null;
    extractedAt: Date | null;
  }): Promise<KnowledgeDocumentEntity> {
    const prisma = PrismaClientManager.getClient();
    const row = await prisma.knowledgeDocument.upsert({
      where: {
        workspace_id_source_entity_type_source_entity_id_representation_key: {
          workspace_id: params.workspaceId,
          source_entity_type: params.sourceEntityType,
          source_entity_id: params.sourceEntityId,
          representation_key: params.representationKey,
        },
      },
      update: {
        document_id: params.documentId,
        module_id: params.moduleId,
        title: params.title,
        source_label: params.sourceLabel,
        content_text: params.contentText,
        summary_text: params.summaryText,
        structured_payload: this.toInputJson(params.structuredPayload),
        extraction_status: params.extractionStatus as never,
        extraction_kind: params.extractionKind,
        content_hash: params.contentHash,
        last_error: params.lastError,
        extracted_at: params.extractedAt,
        deleted_at: null,
      },
      create: {
        workspace_id: params.workspaceId,
        document_id: params.documentId,
        module_id: params.moduleId,
        source_entity_type: params.sourceEntityType,
        source_entity_id: params.sourceEntityId,
        representation_key: params.representationKey,
        title: params.title,
        source_label: params.sourceLabel,
        content_text: params.contentText,
        summary_text: params.summaryText,
        structured_payload: this.toInputJson(params.structuredPayload),
        extraction_status: params.extractionStatus as never,
        extraction_kind: params.extractionKind,
        content_hash: params.contentHash,
        last_error: params.lastError,
        extracted_at: params.extractedAt,
      },
    });

    return this.toKnowledgeDocumentEntity(row);
  }

  public async replaceKnowledgeChunks(workspaceId: string, knowledgeDocumentId: string, chunks: KnowledgeChunkWriteModel[]): Promise<void> {
    const prisma = PrismaClientManager.getClient();
    await prisma.$transaction(async (tx) => {
      await tx.knowledgeChunk.deleteMany({
        where: {
          workspace_id: workspaceId,
          knowledge_document_id: knowledgeDocumentId,
        },
      });

      if (chunks.length === 0) {
        return;
      }

      for (const chunk of chunks) {
        await tx.knowledgeChunk.create({
          data: {
            workspace_id: workspaceId,
            knowledge_document_id: knowledgeDocumentId,
            chunk_index: chunk.chunkIndex,
            content_text: chunk.contentText,
            token_estimate: chunk.tokenEstimate,
            embedding_status: chunk.embeddingStatus as never,
            embedding_provider: chunk.embeddingProvider,
            embedding_model: chunk.embeddingModel,
            embedding_dimensions: chunk.embeddingDimensions,
            embedding_payload: this.toInputJson(chunk.embeddingPayload),
            metadata: this.toInputJson(chunk.metadata),
            embedded_at: chunk.embeddedAt,
          },
        });
      }
    });

    if (chunks.length === 0) {
      return;
    }

    const refreshed = await prisma.knowledgeChunk.findMany({
      where: {
        workspace_id: workspaceId,
        knowledge_document_id: knowledgeDocumentId,
      },
      select: {
        id: true,
        chunk_index: true,
      },
      orderBy: {
        chunk_index: "asc",
      },
    });

    for (const row of refreshed) {
      const chunk = chunks.find((item) => item.chunkIndex === row.chunk_index);
      if (!chunk?.embeddingVector || chunk.embeddingVector.length === 0) {
        continue;
      }

      const vectorLiteral = this.toVectorLiteral(chunk.embeddingVector);
      await prisma.$executeRawUnsafe(
        `UPDATE knowledge_chunks SET embedding_vector = $1::vector WHERE id = $2`,
        vectorLiteral,
        row.id,
      );
    }
  }

  public async semanticSearch(params: {
    workspaceId: string;
    queryVector: number[];
    topK: number;
    moduleId?: number | null;
    sourceEntityType?: string | null;
    sourceEntityId?: string | null;
  }): Promise<KnowledgeSearchHitEntity[]> {
    const prisma = PrismaClientManager.getClient();
    const vectorLiteral = this.toVectorLiteral(params.queryVector);
    const topK = Math.max(1, Math.min(params.topK, 20));
    const conditions = [
      `kc.workspace_id = $2::uuid`,
      `kd.deleted_at IS NULL`,
      `kc.embedding_vector IS NOT NULL`,
      `kc.embedding_status = 'READY'`,
    ];
    const values: Array<string | number | null> = [vectorLiteral, params.workspaceId];

    if (params.moduleId) {
      values.push(params.moduleId);
      conditions.push(`kd.module_id = $${values.length}::integer`);
    }

    if (params.sourceEntityType?.trim()) {
      values.push(params.sourceEntityType.trim());
      conditions.push(`kd.source_entity_type = $${values.length}`);
    }

    if (params.sourceEntityId?.trim()) {
      values.push(params.sourceEntityId.trim());
      conditions.push(`kd.source_entity_id = $${values.length}`);
    }

    values.push(topK);
    const sql = `
      SELECT
        kc.id AS chunk_id,
        kd.id AS knowledge_document_id,
        kd.document_id,
        kd.source_entity_type,
        kd.source_entity_id,
        kd.title,
        kd.source_label,
        kc.chunk_index,
        kc.content_text,
        (kc.embedding_vector <=> $1::vector) AS distance
      FROM knowledge_chunks kc
      JOIN knowledge_documents kd ON kd.id = kc.knowledge_document_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY kc.embedding_vector <=> $1::vector ASC
      LIMIT $${values.length}
    `;

    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(sql, ...values);
    return rows.map((row) => new KnowledgeSearchHitEntity({
      chunkId: String(row.chunk_id),
      knowledgeDocumentId: String(row.knowledge_document_id),
      documentId: typeof row.document_id === "string" ? row.document_id : null,
      sourceEntityType: String(row.source_entity_type),
      sourceEntityId: String(row.source_entity_id),
      title: typeof row.title === "string" ? row.title : null,
      sourceLabel: typeof row.source_label === "string" ? row.source_label : null,
      chunkIndex: Number(row.chunk_index),
      contentText: String(row.content_text ?? ""),
      distance: Number(row.distance ?? 1),
    }));
  }

  public async keywordSearch(params: {
    workspaceId: string;
    queryText: string;
    topK: number;
    moduleId?: number | null;
    sourceEntityType?: string | null;
    sourceEntityId?: string | null;
  }): Promise<KnowledgeSearchHitEntity[]> {
    const prisma = PrismaClientManager.getClient();
    const queryText = params.queryText.trim();
    if (!queryText) {
      return [];
    }

    const topK = Math.max(1, Math.min(params.topK, 20));
    const conditions = [
      `kc.workspace_id = $2::uuid`,
      `kd.deleted_at IS NULL`,
      `kc.content_text ILIKE '%' || $1 || '%'`,
    ];
    const values: Array<string | number | null> = [queryText, params.workspaceId];

    if (params.moduleId) {
      values.push(params.moduleId);
      conditions.push(`kd.module_id = $${values.length}::integer`);
    }

    if (params.sourceEntityType?.trim()) {
      values.push(params.sourceEntityType.trim());
      conditions.push(`kd.source_entity_type = $${values.length}`);
    }

    if (params.sourceEntityId?.trim()) {
      values.push(params.sourceEntityId.trim());
      conditions.push(`kd.source_entity_id = $${values.length}`);
    }

    values.push(topK);
    const sql = `
      SELECT
        kc.id AS chunk_id,
        kd.id AS knowledge_document_id,
        kd.document_id,
        kd.source_entity_type,
        kd.source_entity_id,
        kd.title,
        kd.source_label,
        kc.chunk_index,
        kc.content_text,
        CASE
          WHEN POSITION(LOWER($1) IN LOWER(kc.content_text)) > 0
            THEN POSITION(LOWER($1) IN LOWER(kc.content_text))
          ELSE 999999
        END AS distance
      FROM knowledge_chunks kc
      JOIN knowledge_documents kd ON kd.id = kc.knowledge_document_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY distance ASC, kc.chunk_index ASC
      LIMIT $${values.length}
    `;

    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(sql, ...values);
    return rows.map((row) => new KnowledgeSearchHitEntity({
      chunkId: String(row.chunk_id),
      knowledgeDocumentId: String(row.knowledge_document_id),
      documentId: typeof row.document_id === "string" ? row.document_id : null,
      sourceEntityType: String(row.source_entity_type),
      sourceEntityId: String(row.source_entity_id),
      title: typeof row.title === "string" ? row.title : null,
      sourceLabel: typeof row.source_label === "string" ? row.source_label : null,
      chunkIndex: Number(row.chunk_index),
      contentText: String(row.content_text ?? ""),
      distance: Number(row.distance ?? 999999),
    }));
  }

  private toVectorLiteral(values: number[]): string {
    return `[${values.map((value) => Number.isFinite(value) ? value.toFixed(8) : "0").join(",")}]`;
  }

  private toInputJson(value: Record<string, unknown> | null | undefined): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return Prisma.JsonNull;
    }

    return value as Prisma.InputJsonValue;
  }

  private toKnowledgeDocumentEntity(row: Record<string, unknown>): KnowledgeDocumentEntity {
    return new KnowledgeDocumentEntity({
      id: String(row.id),
      workspaceId: String(row.workspace_id),
      moduleId: typeof row.module_id === "number" ? row.module_id : null,
      documentId: typeof row.document_id === "string" ? row.document_id : null,
      sourceEntityType: String(row.source_entity_type),
      sourceEntityId: String(row.source_entity_id),
      representationKey: String(row.representation_key),
      title: typeof row.title === "string" ? row.title : null,
      sourceLabel: typeof row.source_label === "string" ? row.source_label : null,
      contentText: typeof row.content_text === "string" ? row.content_text : null,
      summaryText: typeof row.summary_text === "string" ? row.summary_text : null,
      structuredPayload: row.structured_payload && typeof row.structured_payload === "object" ? row.structured_payload as Record<string, unknown> : null,
      extractionStatus: String(row.extraction_status),
      extractionKind: typeof row.extraction_kind === "string" ? row.extraction_kind : null,
      contentHash: typeof row.content_hash === "string" ? row.content_hash : null,
      lastError: typeof row.last_error === "string" ? row.last_error : null,
      extractedAt: row.extracted_at instanceof Date ? row.extracted_at : row.extracted_at ? new Date(String(row.extracted_at)) : null,
      createdAt: row.created_at instanceof Date ? row.created_at : new Date(String(row.created_at)),
      updatedAt: row.updated_at instanceof Date ? row.updated_at : new Date(String(row.updated_at)),
    });
  }
}
