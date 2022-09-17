import axios from "axios";
import delay from "delay";
import JSONbig from "json-bigint";
import { config } from "./config";
import { logger } from "./logger";

const JSONBigInt = JSONbig({ useNativeBigInt: true });

export async function waitForChainIndex(retryCount = 60 /* 30 minutes */) {
  const tryNo = 0;
  while (tryNo < retryCount) {
    try {
      const health = await axios.get(`${config.KUPO_URL}/health`, {
        headers: {
          Accept: "application/json",
        },
      });
      logger.debug(
        { health: health.data, expectedSlot: config.SYNC_EARLIEST_SLOT },
        "Kupo health check"
      );
      if (
        health.data?.connection_status === "connected" &&
        health.data?.most_recent_node_tip > config.SYNC_EARLIEST_SLOT
      ) {
        return;
      }
    } catch (err) {
      logger.error(err, "Unable to get chain index health");
    }
    await delay(30_000); // 30 seconds
  }
}

export type ChainIndexUTxO = {
  transaction_id: string; // base16
  output_index: number;
  address: string; // bech32
  value: {
    coins: bigint | number;
    assets: Record<string, bigint | number> | null; // base16 encoded concatenated policyid.tokenname
  };
  datum_hash: string | null; // base16
  script_hash: string | null; // base 16
  created_at: {
    slot_no: number;
    header_hash: string; // base16
  };
  spent_at: null | {
    slot_no: number;
    header_hash: string; // base16
  };
};

export async function findUTxO({
  txHash,
  outputIndex,
}: {
  txHash: string;
  outputIndex: number | bigint;
}) {
  try {
    const result = await axios.get<ChainIndexUTxO[]>(
      `${config.KUPO_URL}/matches/${outputIndex}@${txHash}`,
      {
        transformResponse(data) {
          return JSONBigInt.parse(data);
        },
      }
    );

    if (result.status !== 200) {
      return;
    }

    return result.data[0];
  } catch (err) {
    logger.warn({ err, txHash, outputIndex }, "Error fetching utxo");
  }
}

export async function findScriptTxos({
  scriptHash,
  policyId,
  assetName,
}: {
  scriptHash: string;
  policyId?: string;
  assetName?: string;
}) {
  try {
    const result = await axios.get<ChainIndexUTxO[]>(
      `${config.KUPO_URL}/matches/${scriptHash}/*`,
      {
        params: {
          policy_id: policyId,
          asset_name: assetName,
        },
        transformResponse(data) {
          return JSONBigInt.parse(data);
        },
      }
    );

    if (result.status !== 200) {
      return;
    }

    return result.data;
  } catch (err) {
    logger.warn({ err, scriptHash }, "Error fetching txos");
  }
}

export async function findDatum({ datumHash }: { datumHash: string }) {
  try {
    const result = await axios.get<{ datum?: string }>(
      `${config.KUPO_URL}/datums/${datumHash}`
    );

    if (result.status !== 200) {
      return;
    }

    return result.data.datum;
  } catch (err) {
    logger.warn({ err, datumHash }, "Error fetching datum hash");
  }
}
