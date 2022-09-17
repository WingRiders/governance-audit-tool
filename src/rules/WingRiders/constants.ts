import { config } from "../../config";
import { NetworkName, NETWORKS } from "../../sync/networks";

export const GOVERNANCE_TOKEN = {
  [NetworkName.MAINNET]:
    "c0ee29a85b13209423b10447d3c2e6a50641a15c57770e27cb9d5073.57696e67526964657273",
  [NetworkName.PREPROD]:
    "35b3c3572ee71ec7d0ba8c006eab0fa70fc76d09b15488650106730a.74575254",
}[config.NETWORK];

export const GOVERNANCE_ADDRESS = {
  [NetworkName.MAINNET]:
    "addr1qx8rhe77m9jdj6ghrf0cnkx2l7x8rq7xw08v4qesd72xsmpeju49prd7tpf3q3m34mehnuzakuhv57sqxjpy83vhdgrqlu92zd",
  [NetworkName.PREPROD]:
    "addr_test1qz8rhe77m9jdj6ghrf0cnkx2l7x8rq7xw08v4qesd72xsmpeju49prd7tpf3q3m34mehnuzakuhv57sqxjpy83vhdgrqu2c2wj",
}[config.NETWORK];

export const PROPOSAL_COLLATERAL = 7_000_000_000n;
export const MAX_INT64 = 9_223_372_036_854_775_807n;

export const LP_POLICY_ID = {
  [NetworkName.MAINNET]:
    "026a18d04a0c642759bb3d83b12e3344894e5c1c7b2aeb1a2113a570",
  [NetworkName.PREPROD]:
    "a0748ce7f2e9a1848d75adf2be0c09c6b5a0e6c08d39a10f91adb430",
}[config.NETWORK];

export const WRT_ADA_LP_TOKEN = {
  [NetworkName.MAINNET]: `${LP_POLICY_ID}.dec347c549f618e80d97682b5b4c6985256503bbb3f3955831f5679cdb8de72f`,
  [NetworkName.PREPROD]: `${LP_POLICY_ID}.2ad8dbb404bebddbd59bfea53a974ddd7b59470c94c7d45461983a6ac4bdf0d2`,
}[config.NETWORK];

export const LP_SCRIPT_HASH = {
  [NetworkName.MAINNET]:
    "e6c90a5923713af5786963dee0fdffd830ca7e0c86a041d9e5833e91",
  [NetworkName.PREPROD]:
    "f67b42117e6e0defe0c80fe90b15ec49c6d8c03db416c83dc008786e",
}[config.NETWORK];

export const FARM_SCRIPT_HASH = {
  [NetworkName.MAINNET]:
    "0237cc313756ebb5bcfc2728f7bdc6a8047b471220a305aa373b278a",
  [NetworkName.PREPROD]:
    "b8cfa1f0820aba0c0a24dea17638ab646dc03b5d980d5334c1f53643",
}[config.NETWORK];

export const VESTING_SCRIPT_HASH = {
  [NetworkName.MAINNET]:
    "0a27b0fb1daeb27ff58a79adcefc784fe5cfb5399750d3552e8c54f9",
  [NetworkName.PREPROD]:
    "265bd03f4a9424cef9e81a6eb85c26bd9267280d0176f3748dd464c5",
}[config.NETWORK];

export const NETWORK_ID = NETWORKS[config.NETWORK].networkId;
