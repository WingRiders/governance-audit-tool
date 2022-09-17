import { prisma, VerificationState } from "../prismaClient";
import { pick } from "lodash";
import { GovernanceMetadatumLabel } from "./constants";
import { SupportedEraTx } from "./types";
import { address_spending_hash, parseOgmiosMetadatum } from "./utils";
import { Address } from "@dcspark/cardano-multiplatform-lib-nodejs";
import { dateToSlot, slotToDate } from "./slotToDate";
import { DbBlock } from "./dbTypes";
import { logger } from "../logger";
import { voteMetadatum } from "./schema";
import { activeProject } from "../rules/registry";

export async function scrapeVotes(tx: SupportedEraTx, dbBlock: DbBlock) {
  // check if there is some metadatum with the correct label
  const potentialVoteMetadatum =
    tx.metadata?.body.blob?.[GovernanceMetadatumLabel.COMMUNITY_VOTING_VOTE];

  if (!potentialVoteMetadatum) {
    return;
  }

  const result = voteMetadatum.safeParse(
    parseOgmiosMetadatum(potentialVoteMetadatum)
  );

  if (!result.success) {
    // unsupported metadata
    logger.info(
      { err: result.error.message, metadata: potentialVoteMetadatum },
      "Vote: Malfromed vote metadata"
    );
    return;
  }

  const metadata = result.data;

  const txTime = slotToDate(Number(dbBlock.slot)).valueOf();

  return Promise.all(
    Object.entries(metadata).map(async ([pollTxHash, poll]) => {
      try {
        const pollTxHashBuffer = Buffer.from(pollTxHash, "hex");

        const dbPoll = await prisma.poll.findFirst({
          where: {
            txHash: pollTxHashBuffer,
          },
        });

        if (!dbPoll /*not found */) {
          logger.info(
            { txHash: pollTxHash },
            "Vote: Poll does not exist or is not active for this project"
          );
          return;
        }

        if (
          dbPoll.start.valueOf() > txTime /* before start */ ||
          dbPoll.end.valueOf() /* after end */ < txTime
        ) {
          logger.info(
            { poll: pick(dbPoll, ["start", "end", "snapshot"]) },
            "Vote: is not active"
          );
          return;
        }

        const ownerAddr = Address.from_bytes(Buffer.from(poll.owner, "hex"));
        const ownerStakeKeyHash = ownerAddr
          .staking_cred()
          ?.to_keyhash()
          ?.to_hex();

        if (!ownerStakeKeyHash) {
          logger.info(
            { addr: poll.owner, txHash: tx.id },
            "Invalid owner address"
          );
          return;
        }

        if (!tx.body.requiredExtraSignatures.includes(ownerStakeKeyHash)) {
          logger.warn(
            { ownerStakeKeyHash, txHash: tx.id },
            "Invalid vote with no signature"
          );
          return;
        }

        const checkedVotingPower = await activeProject.verifyVotingPower(
          dateToSlot(dbPoll.snapshot || dbPoll.start),
          ownerStakeKeyHash,
          poll.utxos
        );

        let verificationState: VerificationState = VerificationState.UNVERIFIED;
        if (poll.power <= checkedVotingPower) {
          verificationState = VerificationState.VERIFIED;
          logger.info(
            { txHash: tx.id, claimedPower: poll.power, checkedVotingPower },
            "Verified vote"
          );
        } else {
          logger.info(
            { txHash: tx.id, claimedPower: poll.power, checkedVotingPower },
            "Failed to verify vote"
          );
          verificationState = VerificationState.INVALID;
        }

        const proposals = await prisma.proposal.findMany({
          include: {
            proposalChoices: {
              orderBy: {
                index: "asc",
              },
            },
            proposalStates: true,
            poll: true,
          },
          where: {
            txHash: {
              in: Object.keys(poll.choices).map((hash) =>
                Buffer.from(hash, "hex")
              ),
            },
          },
        });

        const validProposals = proposals.filter(
          (proposal) => proposal.poll.txHash.compare(pollTxHashBuffer) === 0
        );

        await prisma.vote.createMany({
          data: validProposals.map((proposal) => {
            const choiceIndex = Number(
              poll.choices[proposal.txHash.toString("hex")]
            );
            const choiceId =
              choiceIndex >= 0
                ? proposal.proposalChoices[choiceIndex]?.id
                : null;

            return {
              ownerAddress: ownerAddr.to_bech32(),
              ownerPubKeyHash: Buffer.from(
                address_spending_hash(ownerAddr)!,
                "hex"
              ),
              ownerStakeKeyHash: Buffer.from(ownerStakeKeyHash, "hex"),
              proposalId: proposal.id,
              // -1 is abstain, so if it's order in a growing order, it should be correct with the index
              choiceId,
              pollId: proposal.poll.id,
              votingPower: poll.power,
              votingUTxOs: poll.utxos.map(
                ([txhash, index]) => `${txhash}#${index}`
              ),
              verificationState,
              blockId: dbBlock.id,
              txHash: Buffer.from(tx.id, "hex"),
            };
          }),
        });

        logger.info(
          {
            txHash: tx.id,
            proposals: validProposals.map((proposal) =>
              proposal.txHash.toString("hex")
            ),
            owner: ownerStakeKeyHash,
            ownerAddr: poll.owner,
          },
          "Vote: registered vote"
        );
      } catch (err) {
        logger.error({ err, txHash: tx.id }, "Vote: Unable to register vote");
      }
    })
  );
}
