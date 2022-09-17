import { z } from "zod";
import {
  GovernanceManagementOp,
  GovernancePollOp,
  PollField,
  ProposalConclusion,
  ProposalField,
  VoteField,
} from "./constants";

const txHash = z.string().regex(/^[0-9a-fA-F]{64}$/); // hex encoded
const baseAddr = z.string().regex(/^[0-9a-fA-F]{114}$/); // hex encoded

export const utxoId = z.tuple([txHash, z.bigint()]);
export type UTxOId = z.infer<typeof utxoId>;

export const voteMetadatum = z.record(
  txHash /* poll */,
  z.object({
    [VoteField.VOTER_ADDRESS]: baseAddr,
    [VoteField.VOTING_POWER]: z.bigint(),
    [VoteField.VOTING_UTXOS]: z.array(utxoId),
    [VoteField.CHOICES]: z.record(txHash /* proposal */, z.bigint()),
  })
);

export type VoteMetadatum = z.infer<typeof voteMetadatum>;

const splitString = z
  .string()
  .or(z.array(z.string()).transform((arr) => arr.join("")));

export const proposalProperties = z.object({
  [ProposalField.PROPOSAL_NAME]: splitString,
  [ProposalField.PROPOSAL_OWNER]: baseAddr,
  [ProposalField.PROPOSAL_DESCRIPTION]: splitString,
  [ProposalField.PROPOSAL_ACCEPT_CHOICES]: z.array(splitString),
  [ProposalField.PROPOSAL_REJECT_CHOICES]: z.array(splitString),
  [ProposalField.PROPOSAL_URI]: splitString,
  [ProposalField.PROPOSAL_COMMUNITY_URI]: splitString,
});

export type ProposalProperties = z.infer<typeof proposalProperties>;

const pollProperties = z.discriminatedUnion(PollField.POLL_OP, [
  z.object({
    [PollField.POLL_OP]: z.literal(GovernancePollOp.CREATE_NEW),
    [PollField.POLL_START]: z.bigint(),
    [PollField.POLL_END]: z.bigint(),
    [PollField.POLL_SNAPSHOT]: z.bigint().optional(),
    [PollField.POLL_DESCRIPTION]: splitString.optional(),
  }),
  z.object({
    [PollField.POLL_OP]: z.literal(GovernancePollOp.ASSIGN_EXISTING),
    [PollField.POLL_ID]: txHash,
  }),
]);

export type PollProperties = z.infer<typeof pollProperties>;

export const manageMetadatum = z.discriminatedUnion("op", [
  z.object({
    op: z.literal(GovernanceManagementOp.ADD_PROPOSAL),
    proposal: proposalProperties,
    poll: pollProperties,
  }),
  z.object({
    op: z.literal(GovernanceManagementOp.CANCEL_PROPOSAL),
    id: txHash,
    reason: splitString,
  }),
  z.object({
    op: z.literal(GovernanceManagementOp.CONCLUDE_PROPOSAL),
    id: txHash,
    result: z.enum([ProposalConclusion.PASSED, ProposalConclusion.FAILED]),
    choices: z.record(
      z.string() /* choice string */,
      z.bigint() /* number of votes */
    ),
    total: z.bigint(), // total choices
    abstained: z.bigint(),
    note: splitString,
  }),
]);

export type ManageMetadatum = z.infer<typeof manageMetadatum>;
