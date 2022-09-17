import dotenvExpand from "dotenv-expand";
import { NetworkName } from "./sync/networks";
import dotenv from "dotenv";

const env = dotenv.config(
  process.env.DOTENV_CONFIG_PATH ? { path: process.env.DOTENV_CONFIG_PATH } : {}
);
dotenvExpand.expand(env);

const {
  DATABASE_URL,
  NETWORK,
  SYNC_EARLIEST_HASH,
  SYNC_EARLIEST_SLOT,
  OGMIOS_HOST,
  OGMIOS_PORT,
  AUDIT_LOG_LEVEL,
  PROJECT,
  AUDIT_SERVER_PORT,
  KUPO_URL,
} = process.env;

export const config = {
  DATABASE_URL,
  NETWORK: NETWORK as NetworkName,
  SYNC_EARLIEST_SLOT: parseInt(SYNC_EARLIEST_SLOT!),
  SYNC_EARLIEST_HASH: SYNC_EARLIEST_HASH!,
  OGMIOS_HOST,
  OGMIOS_PORT: parseInt(OGMIOS_PORT!),
  AUDIT_SERVER_PORT: parseInt(AUDIT_SERVER_PORT!),
  AUDIT_LOG_LEVEL,
  PROJECT: PROJECT!,
  KUPO_URL: KUPO_URL!,
};
