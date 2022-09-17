import { Point } from "@cardano-ogmios/schema";
import { config } from "./config";
import { logger } from "./logger";
import { initializeOgmios } from "./initOgmios";
import { startSync } from "./chainSyncClient";
import { getLastStableBlock, rollBackToPoint } from "./sync/blocks";
import { startServer } from "./server";
import { waitForChainIndex } from "./chainIndex";

const startApp = async () => {
  try {
    logger.info("Waiting for chain index");
    // wait for healthy chain index
    await waitForChainIndex();
    logger.info("ChainIndex ready");

    // Initalize ogmios
    logger.info("Initializing Ogmios");
    await initializeOgmios();

    // Start chain sync
    // There is no point syncing blocks before dapp deployment.
    const originPoint: Point = {
      slot: config.SYNC_EARLIEST_SLOT,
      hash: config.SYNC_EARLIEST_HASH,
    };
    const lastSyncedBlock = await getLastStableBlock();

    // Perform initial rollback manually so later when we wait for DB to be synced
    // we don't treat it as synced when rollback is in progress
    logger.info("Performing initial sanity rollback");
    await rollBackToPoint(lastSyncedBlock);

    logger.info("Starting ChainSync");
    // No await because we want it to run on the background
    startSync(lastSyncedBlock === "origin" ? originPoint : lastSyncedBlock);
  } catch (e) {
    // If we encounter error in this thread shut down and let the agent restart
    logger.error(e, "Error in main agent thread, shutting down");
    process.exit(1);
  }
};

logger.info("Audit service starting");
// Start the main service
startApp();
startServer();
