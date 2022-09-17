import { config } from "../config";
import { NETWORKS } from "./networks";

export const slotToEpoch = (slot: number): number => {
  const { shelleyInitialSlot, shelleyInitialEpoch, epochSlots } =
    NETWORKS[config.NETWORK];

  return (
    shelleyInitialEpoch + Math.floor((slot - shelleyInitialSlot) / epochSlots)
  );
};

export const slotToDate = (slot: number): Date => {
  const { shelleyInitialSlot, shelleySlotSeconds, byronSlotSeconds, epoch0 } =
    NETWORKS[config.NETWORK];

  const byronSlots = Math.min(slot, shelleyInitialSlot);
  const byronMiliseconds = byronSlots * byronSlotSeconds * 1000;
  const shelleySlots = Math.max(slot - byronSlots, 0);
  const shelleyMiliseconds = shelleySlots * shelleySlotSeconds * 1000;

  return new Date(epoch0 * 1000 + byronMiliseconds + shelleyMiliseconds);
};

/**
 * Converts a date to slot. It only works with dates newer than the shelley era.
 */
export const dateToSlot = (date: Date): number => {
  const { shelleyInitialSlot, shelleySlotSeconds, byronSlotSeconds, epoch0 } =
    NETWORKS[config.NETWORK];

  const byronSlots = shelleyInitialSlot;
  const byronMiliseconds = byronSlots * byronSlotSeconds * 1000;

  const shelleyMilliseconds = date.valueOf() - epoch0 * 1000 - byronMiliseconds;
  const shelleySlots = Math.floor(
    shelleyMilliseconds / (1000 * shelleySlotSeconds)
  );

  return shelleySlots + byronSlots;
};
