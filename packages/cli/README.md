# @openzeppelin/rwa-wizard-cli

CLI tool for generating RWA (Real World Asset) token projects based on the T-REX / ERC-3643 standard. Supports both an interactive step-by-step wizard and headless JSON config mode, with output as a file tree or ZIP archive.

Currently targets **Stellar/Soroban**. The architecture supports adding new chain generators (e.g. EVM/Solidity) without changing the CLI itself.

## Installation

```bash
npm install -g @openzeppelin/rwa-wizard-cli
```

Or run directly with `npx`:

```bash
npx @openzeppelin/rwa-wizard-cli generate
```

**Requires Node.js >= 20.0.0.**

## Quick Start

### Interactive Wizard

Run without a config file to launch the step-by-step wizard:

```bash
rwa-wizard generate
```

The wizard walks through six steps matching the RWA Wizard web UI:

1. **Asset Configuration** — token name, symbol, decimals, initial supply, Document Manager toggle
2. **Identity Configuration** — claim topics and trusted issuers
3. **Compliance Modules** — select and assign modules to compliance hooks
4. **Roles & Access Control** — ownership model (single-owner / multi-sig / DAO) and operator roles
5. **Deployment Target** — preset network (e.g. testnet) or custom RPC / explorer URLs
6. **Review & Generate** — summary of all contracts to be generated, confirm, choose output format

After generation, you can optionally export the configuration as a JSON file for future headless runs.

### Headless Mode

Pass a JSON config file to skip the wizard entirely:

```bash
# Generate as a file tree
rwa-wizard generate -c config.json -o ./my-rwa-project

# Generate as a ZIP archive
rwa-wizard generate -c config.json -o my-rwa-project.zip --zip
```

## Commands

### `generate`

Generate an RWA token project.

```
rwa-wizard generate [options]
```

| Option                           | Description                                                                                         | Default   |
| -------------------------------- | --------------------------------------------------------------------------------------------------- | --------- |
| `-c, --config <path>`            | JSON config file (headless mode). Omit for interactive wizard.                                      | —         |
| `-o, --output <path>`            | Output directory (file tree) or file path (ZIP).                                                    | `.`       |
| `--zip`                          | Output as a ZIP archive instead of a file tree.                                                       | `false`   |
| `--allow-under-review-modules`   | Allow compliance modules marked under review upstream. **Not for production.**                      | `false`   |
| `--chain <name>`                 | Target chain.                                                                                       | `stellar` |

### `validate`

Validate a config file without generating any output.

```bash
rwa-wizard validate -c config.json
```

| Option                           | Description                                                                                       | Default   |
| -------------------------------- | ------------------------------------------------------------------------------------------------- | --------- |
| `-c, --config <path>`            | JSON config file to validate. **(required)**                                                      | —         |
| `--allow-under-review-modules`   | Allow compliance modules marked under review upstream. **Not for production.**                    | `false`   |
| `--chain <name>`                 | Target chain.                                                                                     | `stellar` |

### `modules`

List available compliance modules for a chain.

```bash
rwa-wizard modules
rwa-wizard modules --chain stellar
```

| Option           | Description   | Default   |
| ---------------- | ------------- | --------- |
| `--chain <name>` | Target chain. | `stellar` |

## Configuration Schema

The config file follows the `RWAConfig` type from `@openzeppelin/rwa-config`. Here is a full example:

```json
{
  "token": {
    "name": "My RWA Token",
    "symbol": "MRWA",
    "decimals": 8,
    "initialSupply": "1000000000",
    "administrativeControls": {
      "burnable": true,
      "mintable": true,
      "pausable": true
    },
    "documentManager": { "enabled": true }
  },
  "identityVerification": {
    "claimTopics": [{ "id": 1, "name": "KYC" }],
    "trustedIssuers": [{ "address": "GCEXAMPLEISSUER1", "claimTopics": [1] }],
    "controls": {
      "addressFreezing": true,
      "partialTokenFreezing": false,
      "recovery": false,
      "forcedTransfers": false
    }
  },
  "compliance": {
    "modules": []
  },
  "accessControl": {
    "ownership": {
      "type": "single-owner",
      "ownerAddress": "GCEXAMPLEOWNER"
    },
    "roles": [{ "name": "Manager", "symbol": "manager", "addresses": ["GCMGR1"] }]
  },
  "deployment": {
    "target": {
      "kind": "preset",
      "ecosystem": "stellar",
      "networkId": "stellar-testnet"
    }
  }
}
```

See `examples/stellar-basic.json` for a ready-to-use example.

### Config Sections

| Section                  | Key Fields                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| **token**                | `name`, `symbol`, `decimals`, `initialSupply?`, `administrativeControls` (burnable/mintable/pausable), `documentManager.enabled` |
| **identityVerification** | `claimTopics[]` (id + name), `trustedIssuers[]` (address + claimTopics), `controls` (addressFreezing/partialTokenFreezing/recovery/forcedTransfers) |
| **compliance**           | `modules[]` — each with `moduleId` and optional module-specific `config`; hooks are auto-derived from the registry |
| **accessControl**        | `ownership` (type + address), `roles[]` (name, symbol?, addresses)                                           |
| **deployment**           | `target` — either `{ kind: 'preset', ecosystem, networkId }` or `{ kind: 'custom', ecosystem, rpcUrl, explorerUrl?, label? }`, plus optional `sourceAccount` |

### Ownership Models

| Type           | Address Field  |
| -------------- | -------------- |
| `single-owner` | `ownerAddress` |
| `multi-sig`    | `address`      |
| `dao`          | `address`      |

## Generated Output

The generated project contains a complete, ready-to-build Stellar/Soroban RWA token system:

```
my-rwa-project/
├── contracts/
│   ├── rwa-token/              # RWA Token (FungibleToken + AccessControl + optional DocumentManager)
│   ├── compliance/             # Compliance (hook dispatch + token binding)
│   ├── identity-verifier/      # Identity Verifier (claim-based verification)
│   ├── claim-topics-issuers/   # Claim Topics & Issuers (trusted issuer registry)
│   ├── identity-registry-storage/  # Identity Registry Storage (identity data)
│   └── modules/                # Compliance modules (if any selected)
├── scripts/
│   ├── build.sh                # Compile all contracts
│   └── deploy.sh               # Deploy + configure (correct dependency order)
├── config.json                 # Serialized wizard config (consumed by scripts)
├── Cargo.toml                  # Workspace manifest
└── README.md                   # Setup instructions + architecture overview
```

All 5 core contracts are always generated. Compliance module contracts are added based on your selection.

## Architecture

The CLI is built on a **generator adapter** pattern that decouples the interactive flow from chain-specific code generation:

```
┌─────────────────┐     ┌───────────────────┐     ┌─────────────────────────┐
│  CLI Commands   │────▶│ Generator Adapter │────▶│ @openzeppelin/codegen-* │
│  (commander)    │     │ (registry)        │     │ (chain-specific)        │
└─────────────────┘     └───────────────────┘     └─────────────────────────┘
        │
        ▼
┌──────────────────┐
│ Interactive      │
│ Wizard           │
│ (@clack/prompts) │
└──────────────────┘
```

- **`GeneratorAdapter`** — interface that each chain generator implements (`generate`, `validate`, `generateZip`, `getAvailableModules`, `hints`)
- **`ChainHints`** — chain-specific metadata (address placeholders, validation limits, network options) that the wizard uses to stay chain-agnostic
- **`RWAConfig`** — shared configuration type from `@openzeppelin/rwa-config`, describing _what_ the user wants without prescribing _how_

Adding a new chain requires implementing `GeneratorAdapter` and calling `registerGenerator()` — no wizard or command code changes needed.

## Development

### Setup

```bash
# From the monorepo root
pnpm install
pnpm --filter @openzeppelin/rwa-wizard-cli build
```

### Run Locally

```bash
# Run the built binary
node packages/cli/dist/index.mjs generate

# Watch mode (rebuilds on save)
pnpm --filter @openzeppelin/rwa-wizard-cli dev
# Then in another terminal:
node packages/cli/dist/index.mjs generate -c packages/cli/examples/stellar-basic.json -o /tmp/test
```

### Tests

```bash
# Run all tests (130+ tests across 16 files)
pnpm --filter @openzeppelin/rwa-wizard-cli test

# Watch mode
pnpm --filter @openzeppelin/rwa-wizard-cli test:watch

# With coverage
pnpm --filter @openzeppelin/rwa-wizard-cli test:coverage
```

### Lint & Format

```bash
pnpm --filter @openzeppelin/rwa-wizard-cli lint
pnpm --filter @openzeppelin/rwa-wizard-cli format:check
```

## Dependencies

| Package                             | Purpose                                                 |
| ----------------------------------- | ------------------------------------------------------- |
| `commander`                         | Command parsing and option handling                     |
| `@clack/prompts`                    | Interactive step-by-step prompts                        |
| `picocolors`                        | Terminal color output                                   |
| `@openzeppelin/codegen-core`        | File tree assembly, ZIP packaging, validation framework |
| `@openzeppelin/codegen-rwa-stellar` | Stellar/Soroban RWA contract generator                  |
| `@openzeppelin/rwa-config`          | Shared `RWAConfig` type and validation schema           |

## License

AGPL-3.0
