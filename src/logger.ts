import pino from "pino";
import { config } from "./config";

export const logger: pino.Logger = pino({
  name: `audit-tool-${config.NETWORK}`,
  level: config.AUDIT_LOG_LEVEL || "debug",
  ...(process.env.NODE_ENV !== "production"
    ? {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
          },
        },
      }
    : {}),
});
