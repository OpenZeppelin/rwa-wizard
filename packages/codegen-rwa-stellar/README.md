# @openzeppelin/codegen-rwa-stellar

Stellar/Soroban RWA (Real World Asset) project generator. Produces a complete multi-contract Rust/Soroban workspace from a declarative `RWAConfig`, including the five core contracts, optional compliance modules, Cargo manifests, build and deploy scripts, `config.json`, and generated documentation.

## Install

```bash
npm install @openzeppelin/codegen-rwa-stellar
```

## Template Sourcing

This generator uses contract templates synced from a public Stellar contracts repository.

- By default it reads from a bundled snapshot so generation stays deterministic and browser-safe. The bundled snapshot records the exact source repo and commit that the generated `Cargo.toml` points to.
- In Node.js runtimes with `process.getBuiltinModule()` support, you can pass `contractsLibraryPath` to read templates and local Cargo path dependencies directly from a local `stellar-contracts` checkout.
- Compliance modules currently come from public upstream work that is still under review; generation requires `allowUnderReviewModules: true` when those modules are selected.

## Quickstart

### Generate a Project (File Tree)

```typescript
import { generate, validate } from '@openzeppelin/codegen-rwa-stellar';
import type { RWAConfig } from '@openzeppelin/codegen-rwa-stellar';

const config: RWAConfig = {
  token: {
    name: 'Acme Real Estate Token',
    symbol: 'ACME',
    decimals: 18,
    initialSupply: '1000000',
    administrativeControls: {
      burnable: true,
      mintable: true,
      pausable: true,
    },
    documentManager: { enabled: true },
  },
  identityVerification: {
    claimTopics: [
      { id: 1, name: 'KYC' },
      { id: 2, name: 'AML' },
    ],
    trustedIssuers: [{ address: 'GCEXAMPLEISSUER1...', claimTopics: [1, 2] }],
    controls: {
      addressFreezing: true,
      partialTokenFreezing: true,
      recovery: true,
      forcedTransfers: true,
    },
  },
  compliance: {
    modules: [],
  },
  accessControl: {
    ownership: { type: 'single-owner', ownerAddress: 'GCEXAMPLEOWNER...' },
    roles: [{ name: 'Manager', symbol: 'manager', addresses: ['GCMGR...'] }],
  },
  deployment: {
    target: { kind: 'preset', ecosystem: 'stellar', networkId: 'stellar-testnet' },
  },
};

const validation = validate(config);
if (!validation.valid) {
  console.error(validation.errors);
  process.exit(1);
}

const result = generate(config);
console.log(result.metadata.fileCount);
```

### Generate a ZIP Archive

```typescript
import { writeFileSync } from 'node:fs';

import { generateZip } from '@openzeppelin/codegen-rwa-stellar';

const zip = await generateZip(
  {
    ...config,
    compliance: {
      modules: [{ moduleId: 'supply-limit', config: { limit: 1000000 } }],
    },
  },
  {
    allowUnderReviewModules: true,
    contractsLibraryPath: '/absolute/path/to/stellar-contracts',
    onProgress: (event) => {
      console.log(`[${event.phase}] ${event.percentage}% ${event.message ?? ''}`);
    },
  }
);

writeFileSync(zip.fileName, Buffer.from(await zip.data.arrayBuffer()));
```

`contractsLibraryPath` is optional and only used in runtimes that can read from the local filesystem. Browser callers automatically fall back to the bundled snapshot. Node callers that request a local checkout now fail fast with a clear error when the runtime lacks `process.getBuiltinModule()` support, instead of silently ignoring the override.

For non-preset environments, switch `deployment.target` to `kind: 'custom'` and provide `rpcUrl`. You can also include `explorerUrl` and `label` so the generated deploy output keeps showing friendly names and explorer links on custom infrastructure.

The emitted `config.json` is an informational snapshot of the source `RWAConfig`. It is useful for regeneration or UI re-import, but the generated `deploy.sh` does not read it at runtime.

If `token.initialSupply` is set, the generated `deploy.sh` does **not** auto-mint it. The upstream Stellar claim-based identity flow requires a trusted claim issuer contract, a per-holder identity contract with claims, and IRS registration for the mint recipient before `mint` can succeed. The current generator scaffolds CTI, IRS, and the identity verifier, but not those investor-specific identity contracts.

### Dev/testnet identity scaffolding

`generateWithIdentitySupport()` adds upstream **example** claim-issuer and identity contracts plus a `sign-claim` helper for exercising complete local and testnet identity flows. This is development and demo scaffolding only — **not for production**. Use real claim issuers and holder onboarding in live deployments.

The Stellar testnet e2e script (`pnpm e2e:testnet`) uses this path internally. The CLI exposes the same behavior via `--include-identity-support`.

### Manual E2E (golden path)

Use the checked-in full sample config to generate, build, and deploy a representative project. This mirrors how CI validates the generator end-to-end:

```bash
# 1. Generate a project (replace G... with your funded testnet admin address)
pnpm --filter @openzeppelin/codegen-rwa-stellar test:manual:e2e -- \
  --config packages/cli/examples/stellar-full-e2e.json \
  --address G... \
  --source-account my-admin

# The script writes a temp project, runs build.sh, then deploy.sh.
# Your --source-account identity MUST resolve to the configured Admin/Manager
# address (see generated deploy.sh). Use:
#   stellar keys generate my-admin --fund
#   stellar keys address my-admin
```

Notes:

- The default sample uses the placeholder `__STELLAR_E2E_ADDRESS__`, so you must pass `--address` (or `STELLAR_E2E_ADDRESS`) unless your custom config already contains real addresses.
- Pass `--source-account <identity>` or export `SOURCE_ACCOUNT` / `STELLAR_ACCOUNT`. The identity must control the configured Admin and Manager addresses — generated `deploy.sh` now verifies this **before** deploying.
- Run `./scripts/deploy.sh --preflight` first to validate signers and WASM artifacts without spending XLM.
- When the configured owner and Manager role use different addresses, also set `ADMIN_SOURCE_ACCOUNT` and `MANAGER_SOURCE_ACCOUNT` to the Stellar CLI identities that control those addresses.
- If owner and Manager share the same address, `SOURCE_ACCOUNT` is enough for deploy and post-deploy configuration when it matches that shared address.
- If your config sets `token.initialSupply`, expect a validation warning and a successful deploy without auto-minting; mint only after onboarding a verified recipient identity and claim stack.
- If you need an explicit signer override, you can also pass `--sign-with-key <identity>` or use `STELLAR_SIGN_WITH_KEY`.
- Pass `--contracts-library-path /absolute/path/to/stellar-contracts` if you want the manual flow to use local path dependencies instead of the bundled git-pinned source.

### Testnet Behavior E2E

Run the full behavior e2e against Stellar testnet with the local Stellar CLI `default` identity:

```bash
pnpm e2e:testnet
```

Use `--source-account <identity>` or `SOURCE_ACCOUNT` only when you want a non-default funded identity. When owner and Manager share one address, `SOURCE_ACCOUNT` alone is enough for deploy and post-deploy configuration.

For split owner/manager configs, set `ADMIN_SOURCE_ACCOUNT` and `MANAGER_SOURCE_ACCOUNT` (or pass `--admin-source-account` / `--manager-source-account`). To exercise split roles with a freshly funded manager identity:

```bash
pnpm e2e:testnet -- --split-roles
```

The split-role path provisions separate admin and manager signers, then drives identity registration and module configuration through the manager operator while admin-only actions (such as `set_compliance_address`) stay on the owner signer.

Use `--sign-with-key <identity>` only when the admin signer differs from the admin source account.

The final summary prints each generated account/contract address with a Stellar Expert explorer link.

### Query Available Compliance Modules

```typescript
import { getAvailableModules } from '@openzeppelin/codegen-rwa-stellar';

for (const mod of getAvailableModules()) {
  console.log(`${mod.id}: hooks=${mod.requiredHooks.join(', ')} review=${mod.review.state}`);
}
```

## API Reference

### Functions

| Function                        | Returns                                      | Description                                            |
| ------------------------------- | -------------------------------------------- | ------------------------------------------------------ |
| `generate(config, options?)`    | `GenerationResult`                           | Generate the full file tree (throws on invalid config) |
| `generateZip(config, options?)` | `Promise<ZipResult>`                         | Generate and package as a ZIP archive                  |
| `validate(config, options?)`    | `ValidationResult`                           | Validate config without generating                     |
| `getAvailableModules()`         | `ComplianceModuleRegistryEntry[]`            | List available compliance modules                      |
| `getModuleById(id)`             | `ComplianceModuleRegistryEntry or undefined` | Look up a single module by ID                          |
| `getEcosystemMetadata()`        | `StellarEcosystemMetadata`                   | Return Stellar-specific UI and validation metadata     |
| `generateRoleSymbol(name)`      | `string`                                     | Auto-generate a Soroban-compatible role symbol         |

### Important Options

`GenerateOptions` is re-exported from `@openzeppelin/codegen-core`. The most relevant options for this package are:

- `onProgress`: receive generation progress updates
- `contractsLibraryPath`: use a local `stellar-contracts` checkout in supported Node.js runtimes
- `allowUnderReviewModules`: explicitly allow generation with under-review compliance modules

### Constants

| Constant                       | Description                                                              |
| ------------------------------ | ------------------------------------------------------------------------ |
| `STELLAR_VALIDATION_CONSTANTS` | Soroban-specific validation limits (symbol lengths, decimal range, etc.) |

### Classes

| Class                 | Description                                                         |
| --------------------- | ------------------------------------------------------------------- |
| `StellarRwaGenerator` | `Generator<RWAConfig>` implementation (prefer standalone functions) |

### Re-exported Types

| Type                            | Source                       |
| ------------------------------- | ---------------------------- |
| `RWAConfig`                     | `@openzeppelin/rwa-config`   |
| `GenerationResult`              | `@openzeppelin/codegen-core` |
| `ValidationResult`              | `@openzeppelin/codegen-core` |
| `GenerateOptions`               | `@openzeppelin/codegen-core` |
| `ZipResult`                     | `@openzeppelin/codegen-core` |
| `ComplianceModuleRegistryEntry` | local                        |

## Available Compliance Modules

All currently exposed compliance modules are stable snapshots from merged
`stellar-contracts` example crates under `examples/rwa`.

| Module ID               | Required Hooks                        | Config Keys                          | Upstream Example Crate                          |
| ----------------------- | ------------------------------------- | ------------------------------------ | ----------------------------------------------- |
| `supply-limit`          | `created`, `destroyed`                | `limit`                              | `examples/rwa/compliance-supply-limit`          |
| `max-balance`           | `transferred`, `created`, `destroyed` | `maxBalance`                         | `examples/rwa/compliance-max-balance`           |
| `country-restrict`      | `transferred`, `created`              | `restrictedCountries`                | `examples/rwa/compliance-country-restrict`      |
| `country-allow`         | `transferred`, `created`              | `allowedCountries`                   | `examples/rwa/compliance-country-allow`         |
| `transfer-allow`        | `transferred`                         | `allowedUsers`                       | `examples/rwa/compliance-transfer-allow`        |
| `initial-lockup-period` | `transferred`, `created`, `destroyed` | `lockupPeriodLedgers`                | `examples/rwa/compliance-initial-lockup-period` |
| `time-transfers-limits` | `transferred`                         | `limitDurationLedgers`, `limitValue` | `examples/rwa/compliance-time-transfers-limits` |

## Generated Project Structure

For a config with token symbol `ACME` and one compliance module:

```text
acme-rwa/
├── Cargo.toml
├── README.md
├── UNDER_REVIEW_MODULES.md      # Present when under-review modules are selected
├── config.json                 # Informational source-config snapshot for regeneration/import
├── rustfmt.toml
├── scripts/
│   ├── build.sh
│   └── deploy.sh
├── contracts/
│   ├── rwa-token/
│   ├── compliance/
│   ├── identity-verifier/
│   ├── claim-topics-issuers/
│   ├── identity-registry-storage/
│   └── modules/
│       └── supply-limit/
└── ...
```

## License

AGPL-3.0 — OpenZeppelin
