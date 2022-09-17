import {
  LiquidityPoolDatum,
  value_get_assetclass,
  AssetClass,
  VestingDatum,
  FarmDatum,
} from "@wingriders/dex-serializer";
import { Address } from "@dcspark/cardano-multiplatform-lib-nodejs";
import {
  ChainIndexUTxO,
  findDatum,
  findScriptTxos,
  findUTxO,
} from "../../chainIndex";
import { logger } from "../../logger";
import { GovernanceManagementOp, GovernancePollOp } from "../../sync/constants";
import { ManageMetadatum, UTxOId } from "../../sync/schema";
import { slotToDate } from "../../sync/slotToDate";
import { SupportedEraTx } from "../../sync/types";
import { isPubKeyAddress, isScriptAddress } from "../helpers";
import { Project } from "../project";
import {
  FARM_SCRIPT_HASH,
  GOVERNANCE_ADDRESS,
  GOVERNANCE_TOKEN,
  LP_POLICY_ID,
  LP_SCRIPT_HASH,
  MAX_INT64,
  NETWORK_ID,
  PROPOSAL_COLLATERAL,
  VESTING_SCRIPT_HASH,
  WRT_ADA_LP_TOKEN,
} from "./constants";

export class WingRiders implements Project {
  private poolSnapshotCache: {
    [poolWithSlot: string]: { wrtCount: bigint; issuedLps: bigint };
  } = {};

  async isValidProposal(
    metadata: ManageMetadatum,
    tx: SupportedEraTx
  ): Promise<boolean> {
    const firstOutput = tx.body.outputs[0]!;

    if (firstOutput.address !== GOVERNANCE_ADDRESS) {
      // invalid WRT receive address
      logger.info(
        { txHash: tx.id, targetAddress: firstOutput.address },
        "The proposal address does not belong to this project."
      );
      return false;
    }

    const collateralAmount = firstOutput.value.assets?.[GOVERNANCE_TOKEN];
    if (!collateralAmount || collateralAmount < PROPOSAL_COLLATERAL) {
      // not enough collateral
      logger.warn(
        { txHash: tx.id, value: firstOutput.value },
        "The proposal does not have enough collateral"
      );
      return false;
    }

    if (
      metadata.op === GovernanceManagementOp.ADD_PROPOSAL &&
      metadata.poll.op === GovernancePollOp.CREATE_NEW
    ) {
      // require that the poll cannot be created in the past
      // and the snapshot date should be before the start date

      const startDate = new Date(Number(metadata.poll.start));
      const snapshotDate = metadata.poll.snapshot
        ? new Date(Number(metadata.poll.snapshot))
        : startDate;

      const txValidityEnd = tx.body.validityInterval.invalidBefore;
      if (
        !txValidityEnd ||
        slotToDate(txValidityEnd) > startDate ||
        snapshotDate > startDate
      ) {
        logger.warn(
          { poll: metadata.poll, validityInterval: tx.body.validityInterval },
          "Proposal has invalid dates"
        );
        return false;
      }
    }

    return true;
  }

  private async getPoolState(
    slot: number,
    poolId: string
  ): Promise<{ wrtCount: bigint; issuedLps: bigint }> {
    const utxos =
      (await findScriptTxos({
        scriptHash: LP_SCRIPT_HASH,
        policyId: LP_POLICY_ID,
        assetName: poolId,
      })) || [];

    // utxos are in the order of newest to oldest
    let snapshotTxo: ChainIndexUTxO | null = null;
    for (const utxo of utxos) {
      if (utxo.value.assets?.[`${LP_POLICY_ID}.4c`] !== 1 || !utxo.datum_hash) {
        // not a valid pool
        continue;
      }

      if (
        utxo.created_at.slot_no <= slot &&
        (!utxo.spent_at || utxo.spent_at.slot_no >= slot)
      ) {
        snapshotTxo = utxo;
        break;
      }
    }

    if (!snapshotTxo || !snapshotTxo.datum_hash) {
      return {
        wrtCount: 0n,
        issuedLps: 1n,
      };
    }

    const datum = await findDatum({ datumHash: snapshotTxo.datum_hash });
    if (!datum) {
      throw new Error("Datum not found in chain index");
    }

    const lpDatum = LiquidityPoolDatum.from_hex(datum);
    const issuedLps =
      MAX_INT64 -
      BigInt(
        snapshotTxo.value.assets?.[`${LP_POLICY_ID}.${poolId}`] ??
          MAX_INT64 - 1n
      );

    const [govPolicyId, govAssetName] = GOVERNANCE_TOKEN.split(".");
    const treasuryWrts = value_get_assetclass(
      lpDatum.treasury,
      AssetClass.from_hex(govPolicyId!, govAssetName!)
    ).to_str();
    const wrtCount =
      BigInt(snapshotTxo.value.assets?.[GOVERNANCE_TOKEN] ?? 0n) -
      BigInt(treasuryWrts);

    return {
      issuedLps,
      wrtCount,
    };
  }

  private async getCachedPoolState(slot: number, poolId: string) {
    const poolCacheKey = `${poolId}@${slot}`;
    let cacheValue = this.poolSnapshotCache[poolCacheKey];
    if (!cacheValue) {
      logger.info({ poolId, slot }, "Pool not found in cache, fetching");
      cacheValue = await this.getPoolState(slot, poolId);
      this.poolSnapshotCache[poolCacheKey] = cacheValue;
    }
    return cacheValue;
  }

  private async getLpPower(slot: number, utxoValue: ChainIndexUTxO["value"]) {
    const lpAssets = Object.entries(utxoValue.assets || {}).filter(([token]) =>
      token.startsWith(LP_POLICY_ID)
    );

    let lpPower = 0n;
    for (const [token, lpCount] of lpAssets) {
      const lpTokenName = token.split(".", 2)[1];
      // @TODO handle other lp assets
      // for now hardcoded check for WRT <> ADA pool
      if (token !== WRT_ADA_LP_TOKEN || !lpTokenName) {
        continue;
      }
      const poolState = await this.getCachedPoolState(slot, lpTokenName);

      lpPower += (poolState.wrtCount * BigInt(lpCount)) / poolState.issuedLps;
    }
    return lpPower;
  }

  async verifyVotingPower(
    snapshotSlot: number,
    ownerStakeKeyHash: string, // stakeKeyHash
    utxos: UTxOId[]
  ): Promise<bigint> {
    const checkedUtxos = await Promise.all(
      utxos.map(async (utxoId) => {
        try {
          const utxo = await findUTxO({
            txHash: utxoId[0],
            outputIndex: utxoId[1],
          });

          if (!utxo) {
            throw new Error("UTxO not found");
          }

          // check utxo lifetime
          if (
            utxo.created_at.slot_no > snapshotSlot ||
            (utxo.spent_at?.slot_no ?? snapshotSlot) < snapshotSlot
          ) {
            throw new Error("Invalid UTxO at snapshot");
          }

          const address = Address.from_bech32(utxo.address);

          if (isScriptAddress(address)) {
            // vesting
            // farm
            const scriptHash = address
              .payment_cred()
              ?.to_scripthash()
              ?.to_hex();
            if (!scriptHash || !utxo.datum_hash) {
              throw new Error("Unable to extract script hash ");
            }
            switch (scriptHash) {
              case FARM_SCRIPT_HASH: {
                const farmDatumHex = await findDatum({
                  datumHash: utxo.datum_hash,
                });
                if (!farmDatumHex) {
                  throw new Error("Unable to find farm script datum");
                }
                const farmDatum = FarmDatum.from_hex(farmDatumHex, {
                  networkId: NETWORK_ID,
                });

                if (!farmDatum) {
                  throw new Error("Farm script has invalid datum");
                }

                const farmOwner = farmDatum.owner
                  .staking_cred()
                  ?.to_keyhash()
                  ?.to_hex();

                if (ownerStakeKeyHash !== farmOwner) {
                  throw new Error("Farm script is not owned by the voter");
                }

                // boost or rewards
                const wrtCount = BigInt(
                  utxo.value.assets?.[GOVERNANCE_TOKEN] ?? 0n
                );

                const lpWrtCount = await this.getLpPower(
                  snapshotSlot,
                  utxo.value
                );

                return { id: utxoId, power: wrtCount + lpWrtCount };
              }
              case VESTING_SCRIPT_HASH: {
                const vestingDatumHex = await findDatum({
                  datumHash: utxo.datum_hash,
                });
                if (!vestingDatumHex) {
                  throw new Error("Unable to find vesting script datum");
                }
                const vestingDatum = VestingDatum.from_hex(vestingDatumHex, {
                  networkId: NETWORK_ID,
                });

                if (!vestingDatum) {
                  throw new Error("Vesting script has invalid datum");
                }

                const vestingOwner = vestingDatum.beneficiary
                  .staking_cred()
                  ?.to_keyhash()
                  ?.to_hex();

                if (ownerStakeKeyHash !== vestingOwner) {
                  throw new Error("Vesting script is not owned by the voter");
                }

                const wrtCount = BigInt(
                  utxo.value.assets?.[GOVERNANCE_TOKEN] ?? 0n
                );

                return { id: utxoId, power: wrtCount / 2n };
              }
            }
          } else if (isPubKeyAddress(address)) {
            // User's wallet
            const stakeKeyHash = address.staking_cred()?.to_keyhash()?.to_hex();
            if (stakeKeyHash !== ownerStakeKeyHash) {
              throw new Error("UTxO does not belong to the owner");
            }

            const wrtCount = BigInt(
              utxo.value.assets?.[GOVERNANCE_TOKEN] ?? 0n
            );

            const lpPower = await this.getLpPower(snapshotSlot, utxo.value);

            return {
              id: utxoId,
              power: wrtCount + lpPower,
            };
          }

          // for the LPs check the lp state
        } catch (err) {
          logger.warn({ err, utxoId }, "WingRiders: Unable to process utxo");
        }

        return {
          id: utxoId,
          power: 0n,
        };
      })
    );

    const power = checkedUtxos.reduce((acc, { power }) => acc + power, 0n);
    return power;
  }
}
