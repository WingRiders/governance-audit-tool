import { TxAlonzo, TxBabbage, TxIn, TxOut } from "@cardano-ogmios/schema";
import { indexOf } from "lodash";
import { DbBlock } from "./dbTypes";
import { prisma, Prisma } from "../prismaClient";
import { AssetMap } from "./assets";
import { slotToDate } from "./slotToDate";
import { Address } from "@dcspark/cardano-multiplatform-lib-nodejs";

export const mapTxOutputToPrismaCreateInput = (
  dbBlock: DbBlock,
  txBody: TxAlonzo | TxBabbage,
  blockIndex: number,
  assetMap: AssetMap,
  output: TxOut,
  rawDatum?: string | null,
  datumHash?: string | null
) => {
  const addr = Address.from_bech32(output.address);
  return {
    txHash: Buffer.from(txBody.id, "hex"),
    outputIndex: indexOf(txBody.body.outputs, output),
    address: addr.to_bech32(),
    pubKeyHash: Buffer.from(addr.payment_cred()?.to_bytes() || ""),
    stakeKeyHash: Buffer.from(addr.staking_cred()?.to_bytes() || ""),
    coins: output.value.coins,
    tokenBundle: {
      createMany: {
        data: Object.entries(output.value.assets || {}).map(
          ([tokenName, quantity]) => ({
            assetId: assetMap[tokenName]!,
            quantity,
          })
        ),
      },
    },
    creationTime: slotToDate(Number(dbBlock.slot)),
    blockId: dbBlock.id,
    blockIndex,
    rawDatum: rawDatum ? Buffer.from(rawDatum, "hex") : undefined,
    datumHash: datumHash ? Buffer.from(datumHash, "hex") : undefined,
  };
};

const txHashOutputIndex = ({ txId, index }: TxIn) =>
  Prisma.sql`("txHash"=DECODE(${txId}, 'hex') AND "outputIndex"=${index})`;

export const markTxOutputsAsSpent = async (
  dbBlock: DbBlock,
  txBody: TxAlonzo | TxBabbage
) => {
  if (!Object.values(txBody.witness.redeemers).length) {
    // TODO performance - actually decode redeemers to check there are any of ours redeemers
    // so we don't unnecessarily try to update TxOutputs that don't exist in our DB,
    // and we can't filter by request/pool outputs, because e.g. Reclaims don't have Pool Output
    return;
  }

  // More effective than doing `prisma.txOutput.updateMany(...)`
  await prisma.$queryRaw`UPDATE "TxOutput" SET "spendBlockId"=${
    dbBlock.id
  } WHERE ${Prisma.join(txBody.body.inputs.map(txHashOutputIndex), " OR ")}`;
};
