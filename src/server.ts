import fastify from "fastify";
import { groupBy, keyBy } from "lodash";
import { config } from "./config";
import {
  Prisma,
  prisma,
  VerificationState,
  ProposalChoice,
  ProposalChoiceType,
} from "./prismaClient";

const server = fastify();

server.get("/health", async (_request, _reply) => {
  return { uptime: process.uptime };
});

server.get("/proposals", async (_request, _reply) => {
  const proposals = await prisma.proposal.findMany({
    include: {
      poll: true,
      proposalChoices: {
        orderBy: {
          index: "asc",
        },
      },
      proposalStates: {
        orderBy: {
          id: "desc",
        },
      },
    },
  });
  return {
    project: config.PROJECT,
    proposals: proposals.map((proposal) => ({
      txHash: proposal.txHash.toString("hex"),
      startDate: proposal.poll.start.toISOString(),
      endDate: proposal.poll.end.toISOString(),
      snapshotDate: proposal.poll.snapshot.toISOString(),
      name: proposal.name,
      description: proposal.description,
      owner: proposal.ownerAddress,
      uri: proposal.uri,
      communityUri: proposal.communityUri,
      choices: proposal.proposalChoices.map((choice) => ({
        type: choice.type,
        value: choice.value,
      })),
      state: proposal.proposalStates[0]?.status,
    })),
  };
});

server.get<{
  Params: {
    proposalHash: string;
  };
}>(
  "/results/:proposalHash",
  {
    schema: {
      params: {
        type: "object",
        properties: {
          proposalHash: {
            type: "string",
            pattern: "^[0-9a-fA-F]{64}$",
          },
        },
      },
    },
  },
  async (request, reply) => {
    const txHash = request.params.proposalHash;

    const proposal = await prisma.proposal.findFirst({
      include: {
        poll: true,
        proposalStates: {
          orderBy: {
            id: "desc",
          },
        },
        proposalChoices: true,
      },
      where: {
        txHash: Buffer.from(txHash, "hex"),
      },
    });

    if (!proposal) {
      return reply.code(404);
    }

    const votes = await prisma.$queryRaw<
      {
        power: string;
        voters: string;
        choiceId: string;
        verificationState: VerificationState;
      }[]
    >(Prisma.sql`
    WITH lastVotes AS (
      SELECT DISTINCT ON ("ownerStakeKeyHash")
        "ownerStakeKeyHash",
        "votingPower",
        "choiceId",
        "verificationState"
      FROM "Vote"
      LEFT JOIN "Block" as b ON b.id = "Vote"."blockId"
      WHERE
        "proposalId" = ${proposal.id}
        AND "verificationState" <> 'INVALID'
      ORDER BY "ownerStakeKeyHash", b.height DESC
    )
    SELECT
      SUM("votingPower") as power,
      COUNT("ownerStakeKeyHash") as voters,
      COALESCE("choiceId", -1) as "choiceId",
      "verificationState"
    FROM lastVotes
    GROUP BY "choiceId", "verificationState"
  `);

    const votesByChoice = groupBy(votes, "choiceId");
    const votesByState = groupBy(votes, "verificationState");

    const totalUnverified = (
      votesByState[VerificationState.UNVERIFIED] ?? []
    ).reduce((totalPower, { power }) => totalPower + BigInt(power), 0n);
    const totalVerified = (
      votesByState[VerificationState.VERIFIED] ?? []
    ).reduce((totalPower, { power }) => totalPower + BigInt(power), 0n);

    const choices: (Omit<ProposalChoice, "type"> & {
      type: ProposalChoiceType | "ABSTAIN";
    })[] = [
      ...proposal.proposalChoices,
      {
        id: -1n,
        proposalId: proposal.id,
        index: -1,
        type: "ABSTAIN",
        value: "abstain",
      },
    ];

    return {
      proposal: {
        txHash: proposal.txHash.toString("hex"),
        name: proposal.name,
        description: proposal.description,
        uri: proposal.uri,
        communityUri: proposal.communityUri,
        choices: choices.map((choice) => {
          const votes = keyBy(
            votesByChoice[choice.id.toString()],
            "verificationState"
          );

          const verified = BigInt(
            votes[VerificationState.VERIFIED]?.power ?? 0n
          );
          const unverified = BigInt(
            votes[VerificationState.UNVERIFIED]?.power ?? 0n
          );
          const total = verified + unverified;

          return {
            type: choice.type,
            value: choice.value,
            voters: (
              BigInt(votes[VerificationState.VERIFIED]?.voters ?? 0n) +
              BigInt(votes[VerificationState.UNVERIFIED]?.voters ?? 0n)
            ).toString(),
            votes: {
              verified: verified.toString(),
              unverified: unverified.toString(),
              total: total.toString(),
            },
          };
        }),
        votes: {
          verified: totalVerified.toString(),
          unverified: totalUnverified.toString(),
          total: (totalVerified + totalUnverified).toString(),
        },
      },
    };
  }
);

export function startServer() {
  server.listen({ port: config.AUDIT_SERVER_PORT }, (err, address) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log(`Server listening at ${address}`);
  });
}
