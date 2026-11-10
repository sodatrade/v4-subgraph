# Uniswap V4 Subgraph

### Running Unit Tests

1. Install [Docker](https://docs.docker.com/get-docker/) if you don't have it already
2. Install postgres: `brew install postgresql`
3. `yarn run build:docker`
4. `yarn run test`

### Adding New Chains

1. Create a new subgraph config in `src/utils/chains.ts`. This will require adding a new `<NETWORK_NAME>_NETWORK_NAME` const for the corresponding network.
2. Add a new entry in `networks.json` for the new chain. The network name should be derived from the CLI Name in The Graph's [supported networks documenation](https://thegraph.com/docs/en/developing/supported-networks/). The factory address can be derived from Uniswap's deployments documentation (not yet available).
3. To deploy to Alchemy, run the following command:

```
yarn run deploy:alchemy --
  <SUBGRAPH_NAME>
  --version-label <VERSION_LABEL>
  --deploy-key <DEPLOYMENT_KEY>
  --network <NETWORK_NAME>
```

## Generating subgraph.yaml

The `subgraph.yaml` file can be automatically generated from the `networks.json` configuration for a specific network. This ensures that all contract addresses and start blocks are correctly synchronized.

To generate the subgraph.yaml:

1. Make sure your `networks.json` is up to date with the correct contract addresses and start blocks
2. Run:
   ```bash
   yarn generate-subgraph <network>
   ```
   For example:
   ```bash
   yarn generate-subgraph mainnet
   # or
   yarn generate-subgraph arbitrum-one
   ```

This will create a new `subgraph.yaml` file based on the network-specific configuration. The script will:

- Use the contract templates defined for each contract type (PoolManager, PositionManager, etc.)
- Generate data sources for each contract in the specified network
- Preserve all the necessary event handlers and ABI configurations

Available networks can be found in `networks.json`.

### SodaDEX X Layer production

Generate the chain 196 manifest with `yarn generate-subgraph xlayer-mainnet` and run
`yarn build`. Deploy the manifest to the independent SodaDEX Graph Node as
`sodadex/v4`. The X Layer settings point to the production SodaFlow PoolManager
and PositionManager. The native OKB/USDT0 price reference is scoped to that
PoolManager and only exists in the index after the corresponding pool is initialized.

The SodaDEX deployment exposes NFT `Position.pool`, `tickLower`, `tickUpper`,
and `liquidity` from PoolManager events sent by the configured PositionManager.
`PositionSnapshot` stores the final NFT state at each block that changes
ownership or liquidity. Query both a position and `Pool.tick` at the same block.
A wallet's directly held position is active when its liquidity is positive and
the pool tick is in the half-open interval `[tickLower, tickUpper)`. For a time
window, replay the position snapshots and pool swaps to find each change in
activity.
