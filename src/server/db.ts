import "server-only";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// PRISMA_QUERY_LOG=1 → in mọi câu SQL ra console, dùng để kiểm tra N+1.
export const db =
  globalForPrisma.prisma ??
  new PrismaClient(process.env.PRISMA_QUERY_LOG ? { log: ["query"] } : undefined);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
