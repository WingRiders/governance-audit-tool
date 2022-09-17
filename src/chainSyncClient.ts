import {
  createChainSyncClient,
  InteractionContext,
  isAlonzoBlock,
  isBabbageBlock,
} from "@cardano-ogmios/client";
import { PointOrOrigin } from "@cardano-ogmios/schema";
import {
  ChainSyncClient,
  ChainSyncMessageHandlers,
} from "@cardano-ogmios/client/dist/ChainSync";
import { insertAlonzoOrBabbageBlock, rollBackToPoint } from "./sync/blocks";
import { logger } from "./logger";
import { match } from "ts-pattern";

let chainSyncClient: ChainSyncClient | null = null;

const rollForward: ChainSyncMessageHandlers["rollForward"] = async (
  { block },
  requestNext
) => {
  const alonzoOrBabbageBlock = match(block)
    .when(isAlonzoBlock, ({ alonzo }) => alonzo)
    .when(isBabbageBlock, ({ babbage }) => babbage)
    .otherwise((_) => null);

  if (!alonzoOrBabbageBlock) {
    requestNext();
    return;
  }

  try {
    logger.debug(
      {
        slot: alonzoOrBabbageBlock.header?.slot,
        blockHeight: alonzoOrBabbageBlock.header?.blockHeight,
      },
      "[ChainSync] Roll forward"
    );
    await insertAlonzoOrBabbageBlock(alonzoOrBabbageBlock);
  } catch (err) {
    logger.error(err, "[ChainSync] Error while processing block");

    // TODO define proper failover logic
    process.exit(1);
  }

  requestNext();
};

const rollBackward: ChainSyncMessageHandlers["rollBackward"] = async (
  { point },
  requestNext
) => {
  logger.debug({ point }, "[ChainSync] Roll backward");

  try {
    await rollBackToPoint(point);
  } catch (err) {
    logger.error(err, "[ChainSync] Error while rolling back");

    // TODO define proper failover logic
    process.exit(1);
  }

  requestNext();
};

export const initializeChainSyncClient = async (
  context: InteractionContext
) => {
  if (chainSyncClient !== null) {
    return;
  }

  chainSyncClient = await createChainSyncClient(context, {
    rollBackward,
    rollForward,
  });
  logger.info("Ogmios ChainSync client initialized");
};

export const startSync = async (point: PointOrOrigin) => {
  if (chainSyncClient === null) {
    throw Error("ChainSync client not initalized");
  }
  const intersection = await chainSyncClient.startSync([point]);
  logger.info({ intersection }, "[ChainSync] ChainSync started");
};

export const closeChainSyncClient = async () => {
  if (chainSyncClient === null) {
    return;
  }
  await chainSyncClient.shutdown();
  chainSyncClient = null;
};
