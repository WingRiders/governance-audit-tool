export const enum GovernanceMetadatumLabel {
  COMMUNITY_VOTING_MANAGE = 5752,
  COMMUNITY_VOTING_VOTE = 5753,
}

export const enum GovernanceManagementOp {
  ADD_PROPOSAL = "addProposal",
  CONCLUDE_PROPOSAL = "concludeProposal",
  CANCEL_PROPOSAL = "cancelProposal",
}

export const enum GovernancePollOp {
  ASSIGN_EXISTING = "assign",
  CREATE_NEW = "create",
}

export const enum VoteField {
  VOTER_ADDRESS = "owner",
  VOTING_POWER = "power",
  VOTING_UTXOS = "utxos",
  CHOICES = "choices",
  // NOTE = 'note'
}

export const enum ProposalField {
  PROPOSAL_NAME = "name",
  PROPOSAL_DESCRIPTION = "description",
  PROPOSAL_OWNER = "owner",
  PROPOSAL_URI = "uri",
  PROPOSAL_COMMUNITY_URI = "communityUri",
  PROPOSAL_ACCEPT_CHOICES = "acceptChoices",
  PROPOSAL_REJECT_CHOICES = "rejectChoices",
}

export const enum PollField {
  POLL_ID = "id",
  POLL_OP = "op",
  POLL_START = "start",
  POLL_SNAPSHOT = "snapshot",
  POLL_END = "end",
  POLL_DESCRIPTION = "description",
}

export const enum ProposalConclusion {
  PASSED = "PASSED",
  FAILED = "FAILED",
}
