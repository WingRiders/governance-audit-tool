import { Address } from "@dcspark/cardano-multiplatform-lib-nodejs";
import { logger } from "../logger";
import { activeProject } from "../rules/registry";
import { insertAssets } from "./assets";
import {
  GovernanceManagementOp,
  GovernanceMetadatumLabel,
  GovernancePollOp,
} from "./constants";
import { DbBlock } from "./dbTypes";
import { prisma, ProposalStatus, ProposalChoiceType } from "../prismaClient";
import { manageMetadatum } from "./schema";
import { mapTxOutputToPrismaCreateInput } from "./txOutput";
import { SupportedEraTx } from "./types";
import {
  address_spending_hash,
  address_staking_hash,
  parseOgmiosMetadatum,
} from "./utils";

export async function scrapeCreateProposal(
  tx: SupportedEraTx,
  dbBlock: DbBlock,
  blockIndex: number
) {
  try {
    // check if there is some metadatum with the correct label
    const potentialManageMetadatum =
      tx.metadata?.body.blob?.[
        GovernanceMetadatumLabel.COMMUNITY_VOTING_MANAGE
      ];

    if (!potentialManageMetadatum) {
      return;
    }

    const txHash = tx.id;
    const txHashBuffer = Buffer.from(tx.id, "hex");
    const result = manageMetadatum.safeParse(
      parseOgmiosMetadatum(potentialManageMetadatum)
    );

    if (!result.success) {
      logger.info(
        { err: result.error.message, metadata: potentialManageMetadatum },
        "Proposal: Malformed governance metadata"
      );
      return;
    }

    const metadata = result.data;

    // verify the metadata
    if (metadata.op !== GovernanceManagementOp.ADD_PROPOSAL) {
      logger.warn(
        { metadata, txHash: tx.id },
        "Proposal: Unsupported governance operation"
      );
      return;
    }

    if (!(await activeProject.isValidProposal(metadata, tx))) {
      logger.info(
        { metadata, txHash },
        "Proposal: Not a valid proposal for the active project"
      );
      return;
    }

    // check poll
    let poll;
    if (metadata.poll.op === GovernancePollOp.ASSIGN_EXISTING) {
      poll = await prisma.poll.findFirst({
        where: {
          txHash: Buffer.from(metadata.poll.id, "hex"),
        },
      });

      if (!poll) {
        logger.warn(
          { poll: metadata.poll, txHash },
          "Proposal: Poll does not exist for this project"
        );
        return;
      }
    } else if (metadata.poll.op === GovernancePollOp.CREATE_NEW) {
      const startTime = Number(metadata.poll.start);
      const endTime = Number(metadata.poll.end);
      const snapshotTime = metadata.poll.snapshot
        ? Number(metadata.poll.snapshot)
        : startTime;

      poll = await prisma.poll.create({
        data: {
          blockId: dbBlock.id,
          txHash: Buffer.from(tx.id, "hex"),
          start: new Date(startTime),
          end: new Date(endTime),
          snapshot: new Date(snapshotTime),
          description: metadata.poll.description || "",
        },
      });
    } else {
      logger.error({ metadata }, "Proposal: Unknown governance poll operation");
      return;
    }

    const ownerAddress = Address.from_bytes(
      Buffer.from(metadata.proposal.owner, "hex")
    );
    const pubKeyHash = address_spending_hash(ownerAddress);
    const stakeKeyHash = address_staking_hash(ownerAddress);

    if (!pubKeyHash) {
      logger.error(
        { address: metadata.proposal.owner, txHash: tx.id },
        "Proposal: Invalid owner address"
      );
      return;
    }

    // NOTE assuming the first output to include the proposal collateral
    const proposalTxOutput = tx.body.outputs[0]!;
    const assetMap = await insertAssets(
      Object.keys(proposalTxOutput.value.assets || {})
    );

    const dbTxOutput = await prisma.txOutput.create({
      data: mapTxOutputToPrismaCreateInput(
        dbBlock,
        tx,
        blockIndex,
        assetMap,
        proposalTxOutput,
        proposalTxOutput.datumHash
          ? tx.witness.datums[proposalTxOutput.datumHash]!
          : undefined,
        proposalTxOutput.datumHash
      ),
    });

    const dbProposal = await prisma.proposal.create({
      data: {
        ownerAddress: ownerAddress.to_bech32(),
        ownerPubKeyHash: Buffer.from(pubKeyHash, "hex"),
        ownerStakeKeyHash: stakeKeyHash
          ? Buffer.from(stakeKeyHash, "hex")
          : undefined,
        txHash: txHashBuffer,
        txOutputId: dbTxOutput.id,
        blockId: dbBlock.id,
        pollId: poll.id,
        uri: metadata.proposal.uri,
        communityUri: metadata.proposal.communityUri,
        name: metadata.proposal.name,
        description: metadata.proposal.description,
      },
    });

    const acceptChoices = metadata.proposal.acceptChoices.map((name) => ({
      name,
      type: "accept",
    }));
    const rejectChoices = metadata.proposal.rejectChoices.map((name) => ({
      name,
      type: "reject",
    }));

    await prisma.proposalChoice.createMany({
      data: acceptChoices.concat(rejectChoices).map((choice, index) => ({
        index,
        proposalId: dbProposal.id,
        type:
          choice.type === "accept"
            ? ProposalChoiceType.ACCEPT
            : ProposalChoiceType.REJECT,
        value: choice.name,
      })),
    });

    await prisma.proposalState.create({
      data: {
        txHash: txHashBuffer,
        blockId: dbBlock.id,
        proposalId: dbProposal.id,
        status: ProposalStatus.AVAILABLE,
      },
    });

    logger.info(
      { name: dbProposal.name, txHash: dbProposal.txHash.toString("hex") },
      "New proposal incoming"
    );
  } catch (err) {
    logger.error(err, "Proposal: Unable to scrape proposal creation");
  }
}
