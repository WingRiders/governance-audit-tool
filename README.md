# EXPERIMENTAL governance-audit-tool

Audit governance voting. This is an implementation of the governance method proposed by WingRiders.

This project is in the experimental phase and additional tooling/interfaces will be added continuosly. It's enabled by great open-source work:

- [🐹 kupo](https://github.com/CardanoSolutions/kupo)
- [ogmios](https://github.com/CardanoSolutions/ogmios)

## Governance model

The two major principles guiding the governance model were

- **openness** and
- **transparency**.

Governance should be open for any community member to propose solutions and to vote. Proposals can be very different in nature: economic, technical, community oriented or even political. The aim was to reduce to a minimum any technological barrier and allow community members from any background to easily contribute. The same applies for members who decide to vote — making it simple to use and understand the flow. As a consequence only standard consumer-level tools were considered. On the contrary having the proposals and effects fully on-chain will create a technological barrier, where only community members with smart contract and development knowledge would be able post proposals. Some effects of the proposals could be a standard set of effects that proposal creators would able to compose, but this would limit the type of proposals and decisions that could be made.

The second most important factor was transparency of the voting process. How can you verify what proposals were created? How easy is it to verify what individual riders voted for? How can anybody verify the results of the proposal? With what guarantees can you answer these questions? This repository serves as a basis for transparency, whereas anybody could run and verify the votes and proposals. Although some solutions (like [agora](https://github.com/Liqwid-Labs/agora)) will provide a more trust-less DAO governance, for majority of the projects it might not be necessary.

Implementation-wise the aim was to allow for the most composeable, extendable and generic governance method. For some parts of the governance process there are already better tools out there. For example, for pre- and post-discussions platforms like [sleekplan](https://sleekplan.com/) or [discourse](https://github.com/discourse/discourse) already provide a great solution. Some processes could be extended or replaced. For example having proposals sent to an address could be a DAO delegate address, a multi-sig address or even a smart-contract address. To not clash with any smart-contract usage, transaction metadata is used in combination with a chain indexer. The minimum set of functionality covered by this governance solution is:

1. allow anyone to create a proposal,
1. allow voting on created proposals,
1. evaluate results of a vote.

During these processes there are some properties that are project-specific. These can be defined as part of the rules:

- verifying the validity of a proposal (e.g. enough collateral provided, the collateral arrived at a correct address)
- verifying the validity of the voting power.

This governance model does not include the actual realization of the governance decision, and relies on extensibility and project needs to define right approach for them. For example some projects might want to use an oracle solution to publish the results of the voting which in turn would unlock the collateral and rewards from a smart-contract. Other projects might decide to use a multi-sig address to a single delegate to execute the effects of proposals.

### Proposals

To create a proposal the governance model expects a transaction to appear on-chain with the following properties:

1. The metadata key is `5752`
1. The metadata format in TS definition would look as:

   ```ts
   /* all strings can be split into array of strings in a metadata representation,
      due to the 64 byte limit
   */

   type Proposal = {
     owner: Buffer /* address as buffer */;
     name: string;
     description: string;
     uri: string;
     communityUri: string;
     acceptChoices: string[] /* List of choices that would lead to accept the proposal, each max 64 bytes */;
     rejectChoices: string[] /* List of choices that would lead to reject the proposal, each max 64 bytes */;
   };

   type Poll =
     | {
         op: "assign";
         txHash: Buffer /* connect to an existing poll schedule defined by a different proposal, non-transitive */;
       }
     | {
         op: "create";
         start: POSIXTime /* time in milliseconds since UNIX epoch */;
         snapshot?: POSIXTime /* by default the start time */;
         end: POSIXTime;
         description?: string;
       };

   type ManageMetadata =
     | {
         op: "addProposal";
         proposal: Proposal;
         poll: Poll;
       }
     | {
         op: "concludeProposal";
         id: Buffer /* txhash of proposal */;
         result: "PASSED" | "FAILED";
         choices: Record<string /* choice */, bigint> /* votes per choice */;
         abstained: bigint /* how many abstained votes */;
         total: bigint /* total number of votes */;
         note: string /* reasoning */;
       }
     | {
         op: "cancelProposal";
         id: Buffer /* txhash of proposal */;
         reason: string;
       };
   ```

   this free format can be freely extended by additional properties.

1. The project rules are followed e.g.
1. the collateral was sent to the correct wallet
1. the correct collateral amount was provided

The proposals are identified by the transaction hash they were created in and on-chain the proposal contains only the minimum amount of information that should be readily availabe on-chain:

<dl>
<dt><b>Name</b></dt>
<dd>The name of the proposal - usually should be limited to a short text</dd>
<dt><b>Description</b></dt>
<dd>A longer description of the proposal that can serve as a summary to be shown off-chain</dd>
<dt><b>uri</b></dt>
<dd>A link to a frozen version of the proposal. For example IPFS can be used. This is up to the projects to implement pinning or let community members upload their proposals to the relevant immutable storage.</dd>
<dt><b>communityUri</b></dt>
<dd>A link to community discussions. As mentioned above this can be any forum that can be potentially embedded or even link to discord discussions. This is up to the community members and projects to decide.</dd>
<dt><b>acceptChoices</b></dt>
<dd>A list of choices that would lead to the proposal's acceptance and recommended to return of the collateral to the proposal creators. It's up to the projects to define the exact semantics of these choices.</dd>
<dt><b>rejectChoices</b></dt>
<dd>A list of choices that would lead to the proposal's rejection/failure of the proposal. It's up to the project's DAO to decide if the collateral should be returned or not in this case.</dd>
</dl>

Alongside the proposal a poll schedule can be created. This defines when and what would be the important dates in the proposal's lifecycle: snapshot date, start date and end date. The proposal creators can optionally attach their proposal to an already existing poll schedule. This can lead to better engagement of the community, when multiple proposals can be voted on at the same time with the same voting power.

There are 3 operations that in general can be used to manage the state of proposals:

<dl>
<dt><b>Create proposal</b></dt>
<dd>constitutes of sending the collateral for creating a proposal to the lock address with the correct transaction metadata defining the format of the proposal. The proposal is active as long as the UTxO where the collateral is held</dd>
<dt><b>Conclude proposal</b></dt>
<dd>Report the final state of the vote, that can be viewed directly from the blockchain without running an indexer. Projects could include in theory any kind of information in this metadata. E.g. they could choose to include also a Merkle root.</dd>
<dt>* Cancel proposal</dt>
<dd>DANGER!!! The purpose of this action is to allow removing duplicates or reconcile proposals even before the voting started (e.g. the author requested a change in the proposal, the proposal would no longer be valid, etc.). This is a very dangerous operation that can destroy trust when used inappropriately. The action still will be visible on-chain for anybody to see. There is no way to silently cancel a proposal.</dd>
</dl>

Note: the poll schedules cannot be cancelled and even the the proposal that created the poll schedule was cancelled/concluded, it still can be used.

### Vote

When a voting starts according to the proposal schedule, the users could create arbitrary transactions and include a metadata specific to the governance voting. The transaction inputs and outputs do not matter, so even a very simple and cheap transaction can be used as a vote. The only requirement is that the transaction needs to be signed by the stake key that owns the claimed voting power utxos. This is an important property of this model, that it's up to the members to "claim" their voting power. Even though they can rely on some frontend application to calculate it for them, there is no reliance on a 3rd party service determining their voting power. For example a member owns 100 GOV tokens in their wallet on 2 utxos. Additionally the member decided to provide 1000 GOV tokens as liquidity on an AMM DEX and uses the received LP tokens to farm. In this case the user can claim 1100 voting power by referencing 3 utxos:

- 2 utxos that are directly on the user's address with the correct stake key
- 1 utxo on a farm smart contract. The datum of the farm contract contains the address of the owner, which can be verified if it matches the stake key

> In technical terms the ownership can be ensured by adding the stake key hash to the `requiredSigner` header for the transaction. Otherwise the members could claim that they own utxos that belong to other members by manipulating their own utxos to use a different stake key.

The user can vote for any number of proposals at any time in theory as long. All proposals need to be in the voting windows. The validity of the voting power is left to the project rules to decide. The format of the metadata that needs to be included under **key `5753`**

```ts
type Vote = Record<
  string /* txhash of the poll schedule */,
  {
    owner: Buffer /* full address as bytes */;
    power: bigint /* claimed voting power */;
    utxos: [
      Buffer /* txHash*/,
      bigint /* output index */
    ][] /* array of utxo ids that the user claims to own */;
    choices: Record<
      string /* txhash of the proposal */,
      bigint /* index of the choice */
    >;
  }
>;
```

The vote is a map keyed by the transaction hash of the poll schedules, which share a common snapshot date and hence voting power.

<dl>
<dt><b>owner</b></dt>
<dd>Contains the whole address encoded as bytes, similar to how they would appear in transaction outputs. The most important part here is the staking part, but projects can choose to also validate votes based on the payment key. The transaction for the vote needs to be signed by staking hash that's part of this address.</dd>
<dt><b>power</b></dt>
<dd>The claimed voting power of the user for the proposals in this poll schedule.</dd>
<dt><b>utxos</b><dt>
<dd>The proof that backs up the claimed voting power. It's up to the project rules to verify if the voting power holds up and if the vote is considered valid. In general the claimed utxos should be owned by the same account (the same stake key).</dd>
<dt><b>choices</b></dt>
<dd>Any or all voted choices associated with a poll. The choices are indexed from 0 in the order: accept choices then reject choices. If the user decided to "abstain" from the vote, the choice will be set to `-1`.
</dl>

> The members are allowed to cast votes multiple times before the voting ends and the last choices will be applied. It's not necessary to include all proposals in subsequent votes.

## Development and running

For running the solution `docker-ce` is required with the following steps below.

### Set-up

1. First you need to fetch the latest config files for Cardano node we use from [cardano-configurations repo](https://github.com/input-output-hk/cardano-configurations). You should have these configurations in the folder `backend/cardano-configurations`.
   ```
   git clone git@github.com:input-output-hk/cardano-configurations.git
   ```
   This repo is kept up-to date, so feel free to pull new changes from time to time.
1. Add to your `.npmrc` [github_token](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry#authenticating-to-github-packages)

   ```
   //npm.pkg.github.com/:_authToken=<GITHUB_TOKEN>
   @wingriders:registry=https://npm.pkg.github.com
   ```

1. Copy env and change the values if needed:
   ```
   cp .env.example .env
   ```
1. Run & wait till it gets synced
   ```
   docker-compose up -d cardano-node
   ```
1. Start the chain indexer and wait till it gets synced
   ```
   docker-compose up -d kupo
   ```
1. Run the rest of the services (postgres, ogmios, audit tool)
   ```
   docker-compose up -d
   ```

### API

The server exposes a very simple API, so the auditors don't have to directly do queries in the db:

<dl>
<dt>`/proposals`</dt>
<dd>Will list the proposals that were created for the given project</dd>
<dt>`/results/:proposal_id`</dt>
<dd>Will list the results of the voting (also in-progress) for a given proposal</dd>
</dl>

### Chain-index

For querying a chain at a given snapshot [kupo](https://github.com/CardanoSolutions/kupo) is used. With the default configuration the whole blockchain is synced from a given point (e.g. minting of the governance token). This can take up to ~50GB on mainnet. To reduce the size of the index, additional match patterns can be set to limit the utxos to only those that contain the governance tokens and/or some LP tokens.
