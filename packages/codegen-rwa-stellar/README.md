# @openzeppelin/codegen-rwa-stellar

Stellar/Soroban RWA (Real World Asset) project generator. Produces a complete multi-contract Rust/Soroban workspace from a declarative `RWAConfig`, including the five core contracts, optional compliance modules, Cargo manifests, build and deploy scripts, `config.json`, and generated documentation.

## Install

```bash
npm install @openzeppelin/codegen-rwa-stellar
```

## Template Sourcing

This generator uses real upstream contract templates from `OpenZeppelin/stellar-contracts`.

- By default it reads from a bundled snapshot so generation stays deterministic and browser-safe.
- In Node.js, you can pass `contractsLibraryPath` to read templates and local Cargo path dependencies directly from a local `stellar-contracts` checkout.
- Compliance modules currently come from locally integrated upstream work that is still under review; generation requires `allowUnderReviewModules: true` when those modules are selected.

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
  deployment: { network: 'testnet' },
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

`contractsLibraryPath` is optional and only used in runtimes that can read from the local filesystem. Browser callers automatically fall back to the bundled snapshot.

### Query Available Compliance Modules

```typescript
import { getAvailableModules } from '@openzeppelin/codegen-rwa-stellar';

for (const mod of getAvailableModules()) {
  console.log(
    `${mod.id}: hooks=${mod.requiredHooks.join(', ')} review=${mod.review.state}`
  );
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
- `contractsLibraryPath`: use a local `stellar-contracts` checkout in Node.js
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

All currently exposed compliance modules are marked `under-review` and include review metadata in the registry and generated output.


| Module ID               | Required Hooks                                                    | Config Keys               | Review                                                               |
| ----------------------- | ----------------------------------------------------------------- | ------------------------- | -------------------------------------------------------------------- |
| `supply-limit`          | `canCreate`, `created`, `destroyed`                               | `limit`                   | [PR 650](https://github.com/OpenZeppelin/stellar-contracts/pull/650) |
| `max-balance`           | `canTransfer`, `canCreate`, `transferred`, `created`, `destroyed` | `maxBalance`              | [PR 650](https://github.com/OpenZeppelin/stellar-contracts/pull/650) |
| `country-restrict`      | `canTransfer`                                                     | `restrictedCountries`     | [PR 651](https://github.com/OpenZeppelin/stellar-contracts/pull/651) |
| `country-allow`         | `canTransfer`                                                     | `allowedCountries`        | [PR 651](https://github.com/OpenZeppelin/stellar-contracts/pull/651) |
| `transfer-restrict`     | `canTransfer`                                                     | none                      | [PR 651](https://github.com/OpenZeppelin/stellar-contracts/pull/651) |
| `initial-lockup-period` | `canTransfer`, `created`, `transferred`, `destroyed`              | `lockupSeconds`           | [PR 652](https://github.com/OpenZeppelin/stellar-contracts/pull/652) |
| `time-transfers-limits` | `canTransfer`, `transferred`                                      | `limitTime`, `limitValue` | [PR 652](https://github.com/OpenZeppelin/stellar-contracts/pull/652) |


When under-review modules are generated, the output includes clear warning banners in module source files and an `UNDER_REVIEW_MODULES.md` summary file.

## Generated Project Structure

For a config with token symbol `ACME` and one compliance module:

```text
acme-rwa/
├── Cargo.toml
├── README.md
├── UNDER_REVIEW_MODULES.md      # Present when under-review modules are selected
├── config.json
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