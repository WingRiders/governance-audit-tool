import {
  Address,
  AddressHeaderKind,
} from "@dcspark/cardano-multiplatform-lib-nodejs";

export function isScriptAddress(addr: Address) {
  const header = addr.header();

  return (
    Address.header_matches_kind(
      header,
      AddressHeaderKind.BasePaymentScriptStakeKey
    ) ||
    Address.header_matches_kind(
      header,
      AddressHeaderKind.BasePaymentScriptStakeScript
    ) ||
    Address.header_matches_kind(header, AddressHeaderKind.EnterpriseScript)
  );
}

export function isPubKeyAddress(addr: Address) {
  const header = addr.header();

  return (
    Address.header_matches_kind(
      header,
      AddressHeaderKind.BasePaymentKeyStakeKey
    ) ||
    Address.header_matches_kind(
      header,
      AddressHeaderKind.BasePaymentKeyStakeScript
    ) ||
    Address.header_matches_kind(header, AddressHeaderKind.EnterpriseKey)
  );
}
