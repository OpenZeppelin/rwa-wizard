# @openzeppelin/codegen-rwa-stellar

Stellar/Soroban RWA (Real World Asset) token project generator. Produces a complete multi-contract Rust/Soroban project from a declarative `RWAConfig` object — including 5 core contracts, optional compliance modules, workspace Cargo.toml, build/deploy scripts, and README.

## Install

```bash
npm install @openzeppelin/codegen-rwa-stellar
```

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
    initialSupply: '1000000000000000000000000',
    documentManager: { enabled: true },
  },
  identityVerification: {
    claimTopics: [
      { id: 1, name: 'KYC' },
      { id: 2, name: 'AML' },
    ],
    trustedIssuers: [{ address: 'GCEXAMPLEISSUER1...', claimTopics: [1, 2] }],
  },
  compliance: {
    modules: [{ moduleId: 'supply-cap', hook: 'creation' }],
  },
  accessControl: {
    ownership: { type: 'single-owner', ownerAddress: 'GCEXAMPLEOWNER...' },
    roles: [
      { name: 'Manager', symbol: 'manager', addresses: ['GCMGR...'] },
      { name: 'Agent', symbol: 'agent', addresses: ['GCAGENT...'] },
    ],
  },
  deployment: { network: 'testnet' },
};

// Step 1: Validate (optional but recommended)
const validation = validate(config);
if (!validation.valid) {
  console.error('Config errors:', validation.errors);
  process.exit(1);
}

// Step 2: Generate the file tree
const result = generate(config);

console.log(`Generated ${result.metadata.fileCount} files:`);
for (const path of Object.keys(result.files)) {
  console.log(`  ${path}`);
}
```

### Generate a ZIP Archive

```typescript
import { writeFileSync } from 'fs';

import { generateZip } from '@openzeppelin/codegen-rwa-stellar';

const zip = await generateZip(config, {
  onProgress: (event) => {
    console.log(`[${event.phase}] ${event.percentage}% ${event.message ?? ''}`);
  },
});

// Node.js: write to disk
writeFileSync(zip.fileName, Buffer.from(await zip.data.arrayBuffer()));

// Browser: trigger download
// const url = URL.createObjectURL(zip.data);
// const a = document.createElement('a');
// a.href = url; a.download = zip.fileName; a.click();
```

### Query Available Compliance Modules

```typescript
import { getAvailableModules } from '@openzeppelin/codegen-rwa-stellar';

const modules = getAvailableModules();
for (const mod of modules) {
  console.log(`${mod.id}: ${mod.name} — hooks: ${mod.supportedHooks.join(', ')}`);
}
```

## API Reference

### Functions

| Function                        | Returns                           | Description                                            |
| ------------------------------- | --------------------------------- | ------------------------------------------------------ |
| `generate(config, options?)`    | `GenerationResult`                | Generate the full file tree (throws on invalid config) |
| `generateZip(config, options?)` | `Promise<ZipResult>`              | Generate and package as ZIP                            |
| `validate(config)`              | `ValidationResult`                | Validate config without generating (never throws)      |
| `getAvailableModules()`         | `ComplianceModuleRegistryEntry[]` | List available compliance modules                      |
| `generateRoleSymbol(name)`      | `string`                          | Auto-generate a Soroban-compatible role symbol         |

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

| Module ID          | Name                | Supported Hooks        | Description                         |
| ------------------ | ------------------- | ---------------------- | ----------------------------------- |
| `supply-cap`       | Supply Cap          | `creation`             | Enforces a maximum total supply     |
| `max-balance`      | Max Balance         | `transfer`, `creation` | Limits maximum balance per wallet   |
| `country-restrict` | Country Restriction | `transfer`             | Restricts transfers by jurisdiction |

## Generated Project Structure

For a config with token symbol `"ACME"` and one compliance module:

```
acme-rwa/
├── Cargo.toml                        # Workspace manifest
├── README.md                         # Setup instructions + architecture
├── config.json                       # Serialized wizard config
├── rustfmt.toml                      # Rust formatter config
├── scripts/
│   ├── build.sh                      # Compile all contracts
│   └── deploy.sh                     # Deploy + configure in correct order
├── contracts/
│   ├── rwa-token/
│   │   ├── Cargo.toml
│   │   └── src/ { lib.rs, contract.rs }
│   ├── compliance/
│   │   ├── Cargo.toml
│   │   └── src/ { lib.rs, contract.rs }
│   ├── identity-verifier/
│   │   ├── Cargo.toml
│   │   └── src/ { lib.rs, contract.rs }
│   ├── claim-topics-issuers/
│   │   ├── Cargo.toml
│   │   └── src/ { lib.rs, contract.rs }
│   ├── identity-registry-storage/
│   │   ├── Cargo.toml
│   │   └── src/ { lib.rs, contract.rs }
│   └── modules/
│       └── supply-cap/
│           ├── Cargo.toml
│           └── src/ { lib.rs, contract.rs }
```

## License

AGPL-3.0 — OpenZeppelin
