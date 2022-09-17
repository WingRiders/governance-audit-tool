import { PrismaClient } from "@prisma/client";
import { logger } from "./logger";
export * from "@prisma/client";

export const prisma = new PrismaClient();

export const checkPrismaConnection = async () => {
  try {
    await prisma.$connect();
    return true;
  } catch (error) {
    logger.error(error, "Error during prisma connect");
    return false;
  }
};
