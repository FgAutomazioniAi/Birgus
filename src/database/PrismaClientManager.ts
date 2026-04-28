import { PrismaClient } from "@prisma/client";

export class PrismaClientManager {
  private static instance: PrismaClient | null = null;

  public static getClient(): PrismaClient {
    if (!PrismaClientManager.instance) {
      PrismaClientManager.instance = new PrismaClient({ log: ["error"] });
    }

    return PrismaClientManager.instance;
  }
}
