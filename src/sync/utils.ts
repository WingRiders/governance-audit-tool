import { Metadatum } from "@cardano-ogmios/schema";
import {
  Address,
  AddressHeaderKind,
} from "@dcspark/cardano-multiplatform-lib-nodejs";
import { isArray, isString } from "lodash";
import { match, P } from "ts-pattern";

/**
 * Creates an json-like object from the metadatum.
 * This won't work for generic metadata, where the map keys
 * could be generic objects as well. But for most metadata it should
 * be sufficient.
 *
 * Note: buffers are converted into strings
 */
export function parseOgmiosMetadatum(metadatum: Metadatum): any {
  return match(metadatum)
    .with({ int: P.select("val") }, ({ val }) => BigInt(val))
    .with({ string: P.select("val") }, ({ val }) => val)
    .with(
      { bytes: P.select("val") },
      ({ val }) => val /* use the hex encoded bytes */
    )
    .with({ list: P.select("val") }, ({ val }) => val.map(parseOgmiosMetadatum))
    .with({ map: P.select("val") }, ({ val }) => {
      const record: Record<string, any> = {};
      val.forEach(({ k, v }) => {
        const objKey = parseOgmiosMetadatum(k);
        // in case it was a split string key, join it
        // as default the obj could be stringified.
        // this is less strict and won't work with non-string keys
        const key = joinStringIfNeeded(objKey) || String(objKey);
        record[key] = parseOgmiosMetadatum(v);
      });
      return record;
    })
    .exhaustive();
}

/**
 * Expects either a string or an array of strings that was split because of
 * the metadatum constraints
 */
export function joinStringIfNeeded(value: any): string | null {
  if (isArray(value) && (value.length === 0 || isString(value[0]))) {
    return value.join("");
  } else if (isString(value)) {
    return value;
  } else {
    return null;
  }
}

// @TODO move to serialization lib
export function address_spending_hash(addr: Address): string | undefined {
  if (
    [
      AddressHeaderKind.RewardKey,
      AddressHeaderKind.RewardScript,
      AddressHeaderKind.PointerKey,
      AddressHeaderKind.PointerScript,
    ].some((kind) => Address.header_matches_kind(addr.header(), kind))
  ) {
    return;
  }
  const addrHex = Buffer.from(addr.to_bytes()).toString("hex");
  return addrHex.substring(2, 58);
}

export function address_staking_hash(addr: Address): string | undefined {
  const addrHex = Buffer.from(addr.to_bytes()).toString("hex");
  if (
    [
      AddressHeaderKind.RewardKey,
      AddressHeaderKind.RewardScript,
      AddressHeaderKind.PointerKey,
      AddressHeaderKind.PointerScript,
    ].some((kind) => Address.header_matches_kind(addr.header(), kind))
  ) {
    return addrHex.substring(2, 58);
  }
  return addrHex.substring(58) || undefined;
}
