export enum NetworkId {
  MAINNET = 1,
  PREPROD = 0,
}

export enum NetworkName {
  MAINNET = "mainnet",
  PREPROD = "preprod",
}

export type Network = {
  name: NetworkName;
  networkId: NetworkId;
  protocolMagic: ProtocolMagic;
  eraStartSlot: number;
  eraStartDateTime: number;
  epochsToRewardDistribution: number;
  minimalOutput: number;
  slotLength: number;
  // for slot to date calculation
  epoch0: number;
  byronSlotSeconds: number;
  shelleySlotSeconds: number;
  epochSlots: number;
  shelleyInitialSlot: number;
  shelleyInitialEpoch: number;
};

export enum ProtocolMagic {
  MAINNET = 764824073,
  PREPROD = 1,
}

export const NETWORKS: Record<NetworkName, Network> = {
  ["mainnet"]: {
    name: NetworkName.MAINNET,
    networkId: NetworkId.MAINNET,
    protocolMagic: ProtocolMagic.MAINNET,
    eraStartSlot: 4492800, // 21600 slot x 208 epochs
    eraStartDateTime: Date.parse("29 Jul 2020 21:44:51 UTC"),
    epochsToRewardDistribution: 4,
    minimalOutput: 1000000,
    slotLength: 1,
    epoch0: 1506203091,
    byronSlotSeconds: 20,
    shelleySlotSeconds: 1,
    epochSlots: 432000,
    shelleyInitialSlot: 4492800,
    shelleyInitialEpoch: 208,
  },
  ["preprod"]: {
    name: NetworkName.PREPROD,
    networkId: NetworkId.PREPROD,
    protocolMagic: ProtocolMagic.PREPROD,
    eraStartSlot: 86400,
    eraStartDateTime: Date.parse("2021-06-21T00:00:00Z"),
    epochsToRewardDistribution: 4,
    minimalOutput: 1000000,
    slotLength: 1,
    epoch0: 1654041600,
    byronSlotSeconds: 20,
    shelleySlotSeconds: 1,
    epochSlots: 432000,
    shelleyInitialSlot: 86400,
    shelleyInitialEpoch: 4,
  },
};
