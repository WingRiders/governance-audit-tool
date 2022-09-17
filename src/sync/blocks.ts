import {
  BlockAlonzo,
  BlockBabbage,
  PointOrOrigin,
} from "@cardano-ogmios/schema";
import { logger } from "../logger";
import { Prisma, prisma } from "../prismaClient";
import { markTxOutputsAsSpent } from "./txOutput";
import { DbBlock } from "./dbTypes";
import { SupportedEraTx } from "./types";
import { scrapeVotes } from "./votes";
import { scrapeCreateProposal } from "./governance";

/**
 * Inserts an alonzo or babbage block into the DB along with all the transactions.
 * Throws an error if the block already exists.
 */
export const insertAlonzoOrBabbageBlock = async (
  block: BlockAlonzo | BlockBabbage
) => {
  if (!block.headerHash || !block.header || !block.body) {
    logger.debug(
      { blockHash: block.header?.blockHash },
      "[ChainSync] Block: headerHash, header or body not defined"
    );
    return;
  }
  const debugInfo = {
    hash: block.header.blockHash,
    height: block.header.blockHeight,
  };
  logger.trace(debugInfo, "[ChainSync] Inserting Alonzo block");

  // More effective than using `prisma.block.create(...)` as it does INSERT and then SELECTs the data,
  // which can be done in one INSERT statement
  const [dbBlock] = await prisma.$queryRaw<DbBlock[]>`
  INSERT INTO "Block" (hash, height, slot) VALUES (
    DECODE(${block.headerHash}, 'hex'),
    ${block.header.blockHeight},
    ${block.header.slot}
  ) RETURNING id, ENCODE(hash, 'hex') as hash, height, slot`;

  await Promise.all(
    block.body.flatMap((tx: SupportedEraTx, blockIndex: number) => [
      scrapeVotes(tx, dbBlock!),
      scrapeCreateProposal(tx, dbBlock!, blockIndex),
    ])
  );

  // Mark spent TxOutputs, do this after all previous requests, pools
  // and their associated TxOutputs were inserted. As a TxOutput can
  // be spent by another TxOutput in the same block.
  await Promise.all(
    block.body.flatMap((tx: SupportedEraTx) =>
      markTxOutputsAsSpent(dbBlock!, tx)
    )
  );

  logger.trace(debugInfo, "[ChainSync] Block inserted");
};

export const rollBackToPoint = async (point: PointOrOrigin) => {
  logger.trace({ point }, "[ChainSync] Rolling back");
  let rolledBackCount = 0;
  if (point === "origin") {
    const { count } = await prisma.block.deleteMany();
    rolledBackCount = count;
  } else {
    const { count } = await prisma.block.deleteMany({
      where: {
        slot: {
          gt: point.slot,
        },
      },
    });
    rolledBackCount = count;
  }
  logger.trace({ point, rolledBackCount }, "[ChainSync] Rollback finished");
};

export const getLastStableBlock = async (): Promise<PointOrOrigin> => {
  const block = await prisma.block.findFirst({
    orderBy: {
      id: Prisma.SortOrder.desc,
    },
    // TODO the last block might have been reverted,
    // so we should revert with an offset
    // of a few blocks potentially, for now using hardcoded constant
    skip: 50,
  });
  if (!block) {
    return "origin";
  }
  return {
    hash: block.hash.toString("hex"),
    slot: Number(block.slot),
  };
};
