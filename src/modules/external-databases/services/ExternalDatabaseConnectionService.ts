import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import sql from "mssql";

import { AppError } from "../../../core/errors/AppError.js";
import { PrismaService } from "../../../nest/prisma/prisma.service.js";
import { ExternalDatabaseCredentialCipherService } from "./ExternalDatabaseCredentialCipherService.js";

export type ExternalDatabaseConnectionInput = {
  name: string;
  dbType: "sqlserver";
  host: string;
  port: number;
  databaseName: string;
  sourceView?: string | null;
  username: string;
  password?: string;
  trustServerCertificate: boolean;
  isEnabled: boolean;
};

export type ExternalDatabaseConnectionView = Omit<
  ExternalDatabaseConnectionInput,
  "password"
> & {
  id: string;
  passwordConfigured: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ExternalCommissionFilters = {
  commessa?: string;
  anno?: string;
  week?: string;
  dipendente?: string;
};

export type ExternalDatabaseModuleKey = "commission_registry";

@Injectable()
export class ExternalDatabaseConnectionService {
  public constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ExternalDatabaseCredentialCipherService)
    private readonly cipher: ExternalDatabaseCredentialCipherService,
  ) {}

  public async list(
    workspaceId: string,
  ): Promise<ExternalDatabaseConnectionView[]> {
    const rows = await this.prisma.externalDatabaseConnection.findMany({
      where: { workspace_id: workspaceId },
      orderBy: { name: "asc" },
    });
    return rows.map((row) => this.toView(row));
  }

  public async create(
    workspaceId: string,
    userId: string,
    input: ExternalDatabaseConnectionInput,
  ): Promise<ExternalDatabaseConnectionView> {
    if (!input.password?.trim()) {
      throw new AppError(
        "La password SQL Server e obbligatoria.",
        "EXTERNAL_DATABASE_PASSWORD_REQUIRED",
        400,
      );
    }
    try {
      const row = await this.prisma.externalDatabaseConnection.create({
        data: {
          workspace_id: workspaceId,
          created_by_user_id: userId,
          name: input.name,
          db_type: input.dbType,
          host: input.host,
          port: input.port,
          database_name: input.databaseName,
          source_view: this.normalizeSourceView(input.sourceView),
          username: input.username,
          password_ciphertext: this.cipher.encrypt(input.password.trim()),
          trust_server_certificate: input.trustServerCertificate,
          is_enabled: input.isEnabled,
        },
      });
      return this.toView(row);
    } catch (error) {
      this.throwConflict(error);
    }
  }

  public async listModuleBindings(workspaceId: string): Promise<
    Array<{
      moduleKey: ExternalDatabaseModuleKey;
      connectionId: string;
      connectionName: string;
    }>
  > {
    const rows = await this.prisma.externalDatabaseModuleBinding.findMany({
      where: { workspace_id: workspaceId },
      include: {
        external_database_connection: {
          select: { id: true, name: true },
        },
      },
      orderBy: { module_key: "asc" },
    });
    return rows.map((row) => ({
      moduleKey: row.module_key as ExternalDatabaseModuleKey,
      connectionId: row.external_database_connection.id,
      connectionName: row.external_database_connection.name,
    }));
  }

  public async setModuleBinding(
    workspaceId: string,
    moduleKey: ExternalDatabaseModuleKey,
    connectionId: string | null,
  ): Promise<void> {
    if (!connectionId) {
      await this.prisma.externalDatabaseModuleBinding.deleteMany({
        where: { workspace_id: workspaceId, module_key: moduleKey },
      });
      return;
    }
    const connection = await this.prisma.externalDatabaseConnection.findFirst({
      where: {
        id: connectionId,
        workspace_id: workspaceId,
        db_type: "sqlserver",
      },
      select: { id: true },
    });
    if (!connection) {
      throw new AppError(
        "La connessione selezionata non e disponibile nel workspace.",
        "EXTERNAL_DATABASE_BINDING_INVALID",
        400,
      );
    }
    await this.prisma.externalDatabaseModuleBinding.upsert({
      where: {
        workspace_id_module_key: {
          workspace_id: workspaceId,
          module_key: moduleKey,
        },
      },
      create: {
        workspace_id: workspaceId,
        module_key: moduleKey,
        external_database_connection_id: connectionId,
      },
      update: { external_database_connection_id: connectionId },
    });
  }

  public async getModuleConnectionForUser(
    workspaceId: string,
    userId: string,
    moduleKey: ExternalDatabaseModuleKey,
  ): Promise<{ id: string; name: string }> {
    const binding = await this.prisma.externalDatabaseModuleBinding.findUnique({
      where: {
        workspace_id_module_key: {
          workspace_id: workspaceId,
          module_key: moduleKey,
        },
      },
      select: {
        external_database_connection: { select: { id: true, name: true } },
      },
    });
    if (!binding) {
      throw new AppError(
        "Nessun database e associato al modulo Commesse. Configuralo in Impostazioni.",
        "EXTERNAL_DATABASE_MODULE_BINDING_REQUIRED",
        409,
      );
    }
    const accessible = await this.listForRead(workspaceId, userId);
    const connection = binding.external_database_connection;
    if (!accessible.some((item) => item.id === connection.id)) {
      throw new AppError(
        "Non hai accesso al database associato al modulo Commesse.",
        "EXTERNAL_DATABASE_ACCESS_DENIED",
        403,
      );
    }
    return connection;
  }

  public async update(
    workspaceId: string,
    id: string,
    input: ExternalDatabaseConnectionInput,
  ): Promise<ExternalDatabaseConnectionView> {
    const data: Prisma.ExternalDatabaseConnectionUpdateManyMutationInput = {
      name: input.name,
      db_type: input.dbType,
      host: input.host,
      port: input.port,
      database_name: input.databaseName,
      source_view: this.normalizeSourceView(input.sourceView),
      username: input.username,
      trust_server_certificate: input.trustServerCertificate,
      is_enabled: input.isEnabled,
    };
    if (input.password?.trim())
      data.password_ciphertext = this.cipher.encrypt(input.password.trim());
    try {
      const result = await this.prisma.externalDatabaseConnection.updateMany({
        where: { id, workspace_id: workspaceId },
        data,
      });
      if (result.count === 0)
        throw new AppError(
          "Connessione database non trovata.",
          "EXTERNAL_DATABASE_NOT_FOUND",
          404,
        );
      const row =
        await this.prisma.externalDatabaseConnection.findUniqueOrThrow({
          where: { id },
        });
      return this.toView(row);
    } catch (error) {
      this.throwConflict(error);
    }
  }

  public async delete(workspaceId: string, id: string): Promise<void> {
    const result = await this.prisma.externalDatabaseConnection.deleteMany({
      where: { id, workspace_id: workspaceId },
    });
    if (result.count === 0)
      throw new AppError(
        "Connessione database non trovata.",
        "EXTERNAL_DATABASE_NOT_FOUND",
        404,
      );
  }

  public async listForRead(
    workspaceId: string,
    userId: string,
  ): Promise<Array<{ id: string; name: string }>> {
    const [rows, userRoles] = await Promise.all([
      this.prisma.externalDatabaseConnection.findMany({
        where: {
          workspace_id: workspaceId,
          is_enabled: true,
          db_type: "sqlserver",
        },
        select: {
          id: true,
          name: true,
          user_accesses: {
            where: { user_id: userId },
            select: { id: true },
          },
        },
        orderBy: { name: "asc" },
      }),
      this.prisma.userWorkspaceRole.findMany({
        where: { workspace_id: workspaceId, user_id: userId },
        select: { role: { select: { key: true } } },
      }),
    ]);
    const hasAdministrativeAccess = userRoles.some(({ role }) =>
      ["developer", "superuser"].includes(role.key),
    );
    return rows
      .filter(
        (connection) =>
          hasAdministrativeAccess || connection.user_accesses.length > 0,
      )
      .map(({ id, name }) => ({ id, name }));
  }

  public async listUserAccess(
    workspaceId: string,
    userId: string,
  ): Promise<Array<{ id: string; name: string; isAllowed: boolean }>> {
    const rows = await this.prisma.externalDatabaseConnection.findMany({
      where: {
        workspace_id: workspaceId,
        db_type: "sqlserver",
      },
      select: {
        id: true,
        name: true,
        user_accesses: {
          where: { user_id: userId },
          select: { id: true },
        },
      },
      orderBy: { name: "asc" },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      isAllowed: row.user_accesses.length > 0,
    }));
  }

  public async replaceUserAccess(
    workspaceId: string,
    userId: string,
    connectionIds: string[],
  ): Promise<void> {
    const uniqueConnectionIds = [...new Set(connectionIds)];
    const validConnections =
      await this.prisma.externalDatabaseConnection.findMany({
        where: { id: { in: uniqueConnectionIds }, workspace_id: workspaceId },
        select: { id: true },
      });
    if (validConnections.length !== uniqueConnectionIds.length) {
      throw new AppError(
        "Una delle connessioni database selezionate non e disponibile nel workspace.",
        "EXTERNAL_DATABASE_ACCESS_INVALID",
        400,
      );
    }
    await this.prisma.$transaction(async (transaction) => {
      await transaction.externalDatabaseConnectionUserAccess.deleteMany({
        where: { workspace_id: workspaceId, user_id: userId },
      });
      if (uniqueConnectionIds.length > 0) {
        await transaction.externalDatabaseConnectionUserAccess.createMany({
          data: uniqueConnectionIds.map((connectionId) => ({
            external_database_connection_id: connectionId,
            workspace_id: workspaceId,
            user_id: userId,
          })),
        });
      }
    });
  }

  public async testConnection(workspaceId: string, id: string): Promise<void> {
    const connection = await this.prisma.externalDatabaseConnection.findFirst({
      where: {
        id,
        workspace_id: workspaceId,
        is_enabled: true,
        db_type: "sqlserver",
      },
    });
    if (!connection) {
      throw new AppError(
        "Connessione SQL Server non trovata o non attiva.",
        "EXTERNAL_DATABASE_NOT_FOUND",
        404,
      );
    }
    let pool: sql.ConnectionPool | null = null;
    try {
      pool = await this.openPool(connection);
      await pool.request().query("SELECT 1 AS connection_test");
    } catch {
      throw new AppError(
        "Connessione SQL Server non riuscita. Verifica server, porta, database e credenziali.",
        "EXTERNAL_DATABASE_CONNECTION_FAILED",
        502,
      );
    } finally {
      await pool?.close().catch(() => undefined);
    }
  }

  public async queryExternalCommissionRows(
    workspaceId: string,
    userId: string,
    id: string,
    filters: ExternalCommissionFilters,
  ): Promise<{
    columns: string[];
    rows: Array<Record<string, string | number | boolean | null>>;
  }> {
    const accessibleConnections = await this.listForRead(workspaceId, userId);
    if (!accessibleConnections.some((connection) => connection.id === id)) {
      throw new AppError(
        "Non hai accesso alla connessione database selezionata.",
        "EXTERNAL_DATABASE_ACCESS_DENIED",
        403,
      );
    }
    const connection = await this.prisma.externalDatabaseConnection.findFirst({
      where: {
        id,
        workspace_id: workspaceId,
        is_enabled: true,
        db_type: "sqlserver",
      },
    });
    if (!connection) {
      throw new AppError(
        "Connessione SQL Server non trovata o non attiva.",
        "EXTERNAL_DATABASE_NOT_FOUND",
        404,
      );
    }
    const sourceView = this.toSqlSourceView(connection.source_view);

    let pool: sql.ConnectionPool | null = null;
    try {
      pool = await this.openPool(connection);
      const request = pool.request();
      const conditions: string[] = [];
      const filterColumns = [
        ["COMMESSA", filters.commessa],
        ["ANNO", filters.anno],
        ["WEEK", filters.week],
        ["DIPENDENTE", filters.dipendente],
      ] as const;
      for (const [column, value] of filterColumns) {
        const normalized = value?.trim();
        if (!normalized) continue;
        const parameter = column.toLowerCase();
        request.input(parameter, sql.NVarChar(4000), `%${normalized}%`);
        conditions.push(
          `CAST([${column}] AS nvarchar(4000)) LIKE @${parameter}`,
        );
      }
      const whereClause = conditions.length
        ? ` WHERE ${conditions.join(" AND ")}`
        : "";
      const result = await request.query(
        `SELECT * FROM ${sourceView}${whereClause}`,
      );
      const rows = result.recordset.map((row) =>
        Object.fromEntries(
          Object.entries(row).map(([key, value]) => [
            key,
            this.toPublicCell(value),
          ]),
        ),
      );
      const columns = result.recordset.columns
        ? Object.keys(result.recordset.columns)
        : Object.keys(rows[0] ?? {});
      return { columns, rows };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        "Connessione SQL Server o lettura della vista non riuscita. Verifica host, porta, credenziali e autorizzazioni sulla vista.",
        "EXTERNAL_DATABASE_QUERY_FAILED",
        502,
      );
    } finally {
      await pool?.close().catch(() => undefined);
    }
  }

  private toView(row: {
    id: string;
    name: string;
    db_type: string;
    host: string;
    port: number;
    database_name: string;
    source_view: string | null;
    username: string;
    password_ciphertext: string;
    trust_server_certificate: boolean;
    is_enabled: boolean;
    created_at: Date;
    updated_at: Date;
  }): ExternalDatabaseConnectionView {
    return {
      id: row.id,
      name: row.name,
      dbType: "sqlserver",
      host: row.host,
      port: row.port,
      databaseName: row.database_name,
      sourceView: row.source_view,
      username: row.username,
      trustServerCertificate: row.trust_server_certificate,
      isEnabled: row.is_enabled,
      passwordConfigured: Boolean(row.password_ciphertext),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  private async openPool(connection: {
    host: string;
    port: number;
    database_name: string;
    username: string;
    password_ciphertext: string;
    trust_server_certificate: boolean;
  }): Promise<sql.ConnectionPool> {
    return new sql.ConnectionPool({
      server: connection.host,
      port: connection.port,
      database: connection.database_name,
      user: connection.username,
      password: this.cipher.decrypt(connection.password_ciphertext),
      options: {
        encrypt: true,
        trustServerCertificate: connection.trust_server_certificate,
      },
      connectionTimeout: 10000,
      requestTimeout: 30000,
    }).connect();
  }

  private normalizeSourceView(value: string | null | undefined): string | null {
    const normalized = value?.trim() ?? "";
    if (!normalized) return null;
    this.toSqlSourceView(normalized);
    return normalized;
  }

  private toSqlSourceView(value: string | null): string {
    if (!value) {
      throw new AppError(
        "Per leggere le commesse seleziona una vista sorgente nella connessione database.",
        "EXTERNAL_DATABASE_SOURCE_REQUIRED",
        409,
      );
    }
    const match =
      /^([A-Za-z_][A-Za-z0-9_$#@]*)\.([A-Za-z_][A-Za-z0-9_$#@]*)$/.exec(value);
    if (!match) {
      throw new AppError(
        "La vista deve avere il formato schema.nome_vista, ad esempio dbo.vw_ext_commesse.",
        "EXTERNAL_DATABASE_SOURCE_INVALID",
        400,
      );
    }
    return `[${match[1]}].[${match[2]}]`;
  }

  private throwConflict(error: unknown): never {
    if (error instanceof AppError) throw error;
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AppError(
        "Esiste gia una connessione con questo nome nel workspace.",
        "EXTERNAL_DATABASE_NAME_CONFLICT",
        409,
      );
    }
    throw error;
  }

  private toPublicCell(value: unknown): string | number | boolean | null {
    if (value === null || value === undefined) return null;
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    )
      return value;
    if (typeof value === "bigint") return value.toString();
    if (value instanceof Date) return value.toISOString();
    return String(value);
  }
}
