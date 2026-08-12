import { PrismaClient } from "@prisma/client";

export class PrismaClientManager {
  private static instance: PrismaClient | null = null;

  public static getClient(): PrismaClient {
    if (!PrismaClientManager.instance) {
      throw new Error("PrismaClientManager not initialized. Use the Nest PrismaService runtime.");
    }

    return PrismaClientManager.instance;
  }

  public static setClient(client: PrismaClient): void {
    PrismaClientManager.instance = client;
  }
}
