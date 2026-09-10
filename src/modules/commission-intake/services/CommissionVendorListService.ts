import { Prisma } from "@prisma/client";

import { AppError } from "../../../core/errors/AppError.js";
import { PrismaClientManager } from "../../../database/PrismaClientManager.js";

export interface VendorListCategory {
  name: string;
  note: string;
  items: Array<{ component: string; brands: string }>;
}

export interface VendorListConfiguration {
  categories: VendorListCategory[];
  isCustomized: boolean;
  revision: number;
}

const CATALOG_KEY = "commission_vendor_list";

export class CommissionVendorListService {
  public async get(workspaceId: string): Promise<VendorListConfiguration> {
    const prisma = PrismaClientManager.getClient();
    const saved = await prisma.commissionCatalog.findFirst({
      where: { workspace_id: workspaceId, key: CATALOG_KEY, deleted_at: null },
      select: { metadata: true },
    });
    const parsed = this.parseMetadata(saved?.metadata);
    if (parsed) return { ...parsed, isCustomized: true };
    return { categories: await this.loadDefaultCategories(), revision: 0, isCustomized: false };
  }

  public async save(workspaceId: string, categories: VendorListCategory[]): Promise<VendorListConfiguration> {
    const normalized = this.normalizeCategories(categories);
    if (!normalized.length) {
      throw new AppError("La Vendor List deve contenere almeno una categoria.", "VENDOR_LIST_EMPTY", 400);
    }

    const prisma = PrismaClientManager.getClient();
    const existing = await prisma.commissionCatalog.findFirst({
      where: { workspace_id: workspaceId, key: CATALOG_KEY },
      select: { id: true, metadata: true },
    });
    const revision = (this.parseMetadata(existing?.metadata)?.revision ?? 0) + 1;
    const metadata = { revision, categories: normalized };

    if (existing) {
      await prisma.commissionCatalog.update({ where: { id: existing.id }, data: { metadata: metadata as unknown as Prisma.InputJsonValue, is_active: true, deleted_at: null } });
    } else {
      await prisma.commissionCatalog.create({
        data: {
          workspace_id: workspaceId,
          key: CATALOG_KEY,
          identity_key: `${workspaceId}:${CATALOG_KEY}`,
          label: "Vendor List componenti",
          description: "Configurazione personalizzata della Vendor List per le nuove checklist.",
          metadata: metadata as unknown as Prisma.InputJsonValue,
        },
      });
    }
    return { categories: normalized, revision, isCustomized: true };
  }

  public async reset(workspaceId: string): Promise<VendorListConfiguration> {
    const prisma = PrismaClientManager.getClient();
    await prisma.commissionCatalog.updateMany({
      where: { workspace_id: workspaceId, key: CATALOG_KEY, deleted_at: null },
      data: { deleted_at: new Date(), is_active: false },
    });
    return { categories: await this.loadDefaultCategories(), revision: 0, isCustomized: false };
  }

  private async loadDefaultCategories(): Promise<VendorListCategory[]> {
    const prisma = PrismaClientManager.getClient();
    const table = await prisma.commissionTableDefinition.findFirst({
      where: { key: { contains: "vendor_list" }, field: { version: { workspace_id: null, status: "PUBLISHED" } } },
      orderBy: { created_at: "asc" },
      select: { metadata: true },
    });
    const rows = this.extractDefaultRows(table?.metadata);
    return this.rowsToCategories(rows);
  }

  private parseMetadata(metadata: Prisma.JsonValue | null | undefined): Omit<VendorListConfiguration, "isCustomized"> | null {
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
    const value = metadata as { revision?: unknown; categories?: unknown };
    if (!Array.isArray(value.categories)) return null;
    return {
      revision: typeof value.revision === "number" && Number.isInteger(value.revision) ? value.revision : 0,
      categories: this.normalizeCategories(value.categories as VendorListCategory[]),
    };
  }

  private extractDefaultRows(metadata: Prisma.JsonValue | null | undefined): Array<Record<string, unknown>> {
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return [];
    const rows = (metadata as { defaultRows?: unknown }).defaultRows;
    return Array.isArray(rows) ? rows.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object" && !Array.isArray(row)) : [];
  }

  private rowsToCategories(rows: Array<Record<string, unknown>>): VendorListCategory[] {
    const categories = new Map<string, VendorListCategory>();
    for (const row of rows) {
      const name = this.clean(row.col_1_categoria) || "Altro";
      if (name === "Altro") continue;
      const category = categories.get(name) ?? { name, note: "", items: [] };
      category.items.push({ component: this.clean(row.col_2_componente), brands: this.clean(row.col_3_marche_di_riferimento) || this.clean(row._placeholder_col_3_marche_di_riferimento) });
      categories.set(name, category);
    }
    return [...categories.values()];
  }

  private normalizeCategories(categories: VendorListCategory[]): VendorListCategory[] {
    return categories.map((category) => ({
      name: this.clean(category?.name),
      note: this.clean(category?.note),
      items: Array.isArray(category?.items) ? category.items.map((item) => ({ component: this.clean(item?.component), brands: this.clean(item?.brands) })).filter((item) => item.component.length > 0) : [],
    })).filter((category) => category.name.length > 0);
  }

  private clean(value: unknown): string {
    return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 2000) : "";
  }
}
