import {
  createInteractionContext,
  InteractionContext,
} from "@cardano-ogmios/client";
import delay from "delay";
import { config } from "./config";
import { logger } from "./logger";
import {
  closeChainSyncClient,
  initializeChainSyncClient,
} from "./chainSyncClient";

/**
 * Tries to initalize Ogmios and the ChainSync client
 * If it fails retries up to `maxRetries` times in 15 second intervals
 * If it fails even after `maxRetries` times exits the process.
 */
export const initializeOgmios = async (maxRetries = 10) => {
  for (let retryCount = 0; retryCount < maxRetries; retryCount++) {
    try {
      const context: InteractionContext = await createInteractionContext(
        (err) => {
          throw err;
        },
        () => {
          closeChainSyncClient();
          logger.error("Ogmios Client connection closed.");
          // Shut down the whole process, agent shouldn't create transactions
          // when chainsync is not running, agent should automatically restart
          process.exit(1);
        },
        {
          connection: {
            host: config.OGMIOS_HOST,
            // docker containers must communicate through 1337
            // if connecting another way, you can specify remoteOgmiosPort
            port: config.OGMIOS_PORT || 1337,
          },
        }
      );
      await initializeChainSyncClient(context);
      break;
    } catch (e) {
      if (retryCount === maxRetries - 1) {
        logger.error(e, "Failed to initialize Ogmios, shutting down");
        process.exit(1);
      }
      logger.error(e, "Failed to initialize Ogmios, retrying in 15 seconds");
      await delay(15_000);
    }
  }
};
