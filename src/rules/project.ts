import { ManageMetadatum, UTxOId } from "../sync/schema";
import { SupportedEraTx } from "../sync/types";

export interface Project {
  isValidProposal(
    metadata: ManageMetadatum /* parsed metadata */,
    tx: SupportedEraTx
  ): Promise<boolean>;
  verifyVotingPower(
    snapshotSlot: number,
    ownerStakeKeyHash: string,
    utxos: UTxOId[]
  ): Promise<bigint>;
}
