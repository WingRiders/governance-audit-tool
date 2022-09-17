-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('AVAILABLE', 'CANCELLED', 'PASSED', 'FAILED');

-- CreateEnum
CREATE TYPE "ProposalChoiceType" AS ENUM ('ACCEPT', 'REJECT');

-- CreateEnum
CREATE TYPE "VerificationState" AS ENUM ('UNVERIFIED', 'VERIFIED', 'INVALID');

-- CreateTable
CREATE TABLE "Block" (
    "id" BIGSERIAL NOT NULL,
    "hash" BYTEA NOT NULL,
    "height" BIGINT NOT NULL,
    "slot" BIGINT NOT NULL,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" BIGSERIAL NOT NULL,
    "policyId" BYTEA NOT NULL,
    "assetName" BYTEA NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Token" (
    "id" BIGSERIAL NOT NULL,
    "quantity" BIGINT NOT NULL,
    "assetId" BIGINT NOT NULL,
    "txOutputId" BIGINT NOT NULL,

    CONSTRAINT "Token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TxOutput" (
    "id" BIGSERIAL NOT NULL,
    "txHash" BYTEA NOT NULL,
    "outputIndex" INTEGER NOT NULL,
    "address" TEXT NOT NULL,
    "pubKeyHash" BYTEA NOT NULL,
    "stakeKeyHash" BYTEA,
    "coins" BIGINT NOT NULL,
    "creationTime" TIMESTAMP(3) NOT NULL,
    "blockId" BIGINT NOT NULL,
    "blockIndex" INTEGER NOT NULL,
    "spendBlockId" BIGINT,
    "rawDatum" BYTEA,
    "datumHash" BYTEA,

    CONSTRAINT "TxOutput_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Poll" (
    "id" BIGSERIAL NOT NULL,
    "blockId" BIGINT NOT NULL,
    "txHash" BYTEA NOT NULL,
    "start" TIMESTAMPTZ(6) NOT NULL,
    "end" TIMESTAMPTZ(6) NOT NULL,
    "snapshot" TIMESTAMPTZ(6) NOT NULL,
    "description" TEXT,

    CONSTRAINT "Poll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proposal" (
    "id" BIGSERIAL NOT NULL,
    "ownerAddress" TEXT NOT NULL,
    "ownerPubKeyHash" BYTEA NOT NULL,
    "ownerStakeKeyHash" BYTEA,
    "txHash" BYTEA NOT NULL,
    "txOutputId" BIGINT NOT NULL,
    "blockId" BIGINT NOT NULL,
    "pollId" BIGINT NOT NULL,
    "uri" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "communityUri" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalState" (
    "id" BIGSERIAL NOT NULL,
    "proposalId" BIGINT NOT NULL,
    "blockId" BIGINT NOT NULL,
    "txHash" BYTEA NOT NULL,
    "cancelReason" TEXT,
    "status" "ProposalStatus" NOT NULL DEFAULT 'AVAILABLE',

    CONSTRAINT "ProposalState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalChoice" (
    "id" BIGSERIAL NOT NULL,
    "proposalId" BIGINT NOT NULL,
    "index" INTEGER NOT NULL,
    "type" "ProposalChoiceType" NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "ProposalChoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" BIGSERIAL NOT NULL,
    "ownerAddress" TEXT NOT NULL,
    "ownerPubKeyHash" BYTEA NOT NULL,
    "ownerStakeKeyHash" BYTEA NOT NULL,
    "proposalId" BIGINT NOT NULL,
    "choiceId" BIGINT,
    "pollId" BIGINT NOT NULL,
    "votingPower" BIGINT NOT NULL,
    "votingUTxOs" TEXT[],
    "verificationState" "VerificationState" NOT NULL DEFAULT 'UNVERIFIED',
    "blockId" BIGINT NOT NULL,
    "txHash" BYTEA NOT NULL,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Block_hash_key" ON "Block"("hash");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_policyId_assetName_key" ON "Asset"("policyId", "assetName");

-- CreateIndex
CREATE INDEX "Token_txOutputId_idx" ON "Token"("txOutputId");

-- CreateIndex
CREATE INDEX "TxOutput_spendBlockId_idx" ON "TxOutput"("spendBlockId");

-- CreateIndex
CREATE UNIQUE INDEX "TxOutput_txHash_outputIndex_key" ON "TxOutput"("txHash", "outputIndex");

-- CreateIndex
CREATE UNIQUE INDEX "Poll_txHash_key" ON "Poll"("txHash");

-- CreateIndex
CREATE UNIQUE INDEX "Proposal_txHash_key" ON "Proposal"("txHash");

-- CreateIndex
CREATE UNIQUE INDEX "Proposal_txOutputId_key" ON "Proposal"("txOutputId");

-- CreateIndex
CREATE INDEX "ProposalState_proposalId_idx" ON "ProposalState"("proposalId");

-- CreateIndex
CREATE INDEX "ProposalChoice_proposalId_idx" ON "ProposalChoice"("proposalId");

-- CreateIndex
CREATE UNIQUE INDEX "ProposalChoice_proposalId_index_key" ON "ProposalChoice"("proposalId", "index");

-- CreateIndex
CREATE INDEX "Vote_ownerStakeKeyHash_proposalId_pollId_idx" ON "Vote"("ownerStakeKeyHash", "proposalId", "pollId");

-- CreateIndex
CREATE INDEX "Vote_proposalId_idx" ON "Vote"("proposalId");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_txHash_proposalId_key" ON "Vote"("txHash", "proposalId");

-- AddForeignKey
ALTER TABLE "Token" ADD CONSTRAINT "Token_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Token" ADD CONSTRAINT "Token_txOutputId_fkey" FOREIGN KEY ("txOutputId") REFERENCES "TxOutput"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TxOutput" ADD CONSTRAINT "TxOutput_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "Block"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TxOutput" ADD CONSTRAINT "TxOutput_spendBlockId_fkey" FOREIGN KEY ("spendBlockId") REFERENCES "Block"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Poll" ADD CONSTRAINT "Poll_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "Block"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_txOutputId_fkey" FOREIGN KEY ("txOutputId") REFERENCES "TxOutput"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "Block"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalState" ADD CONSTRAINT "ProposalState_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalState" ADD CONSTRAINT "ProposalState_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "Block"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalChoice" ADD CONSTRAINT "ProposalChoice_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_choiceId_fkey" FOREIGN KEY ("choiceId") REFERENCES "ProposalChoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "Block"("id") ON DELETE CASCADE ON UPDATE CASCADE;
