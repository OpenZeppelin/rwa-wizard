# Quickstart: Stellar RWA Codegen

## Install

```bash
# Install the Stellar RWA generator (pulls codegen-core and rwa-config as deps)
npm install @openzeppelin/codegen-rwa-stellar
```

## Generate a Project (Raw File Tree)

```typescript
import { generate, validate } from '@openzeppelin/codegen-rwa-stellar';
import type { RWAConfig } from '@openzeppelin/codegen-rwa-stellar';

const config: RWAConfig = {
  token: {
    name: 'Acme Real Estate Token',
    symbol: 'ACME',
    decimals: 18,
    initialSupply: '1000000000000000000000000', // 1M requested units; surfaced as post-deploy mint guidance on Stellar
    documentManager: { enabled: true },
  },
  identityVerification: {
    claimTopics: [
      { id: 1, name: 'KYC' },
      { id: 2, name: 'AML' },
    ],
    trustedIssuers: [
      {
        address: 'GCEXAMPLEISSUER1...',
        claimTopics: [1, 2],
      },
    ],
  },
  compliance: {
    modules: [{ moduleId: 'supply-limit', config: { limit: 1000000 } }],
  },
  accessControl: {
    ownership: { type: 'single-owner', ownerAddress: 'GCEXAMPLEOWNER...' },
    roles: [
      { name: 'Manager', symbol: 'manager', addresses: ['GCEXAMPLEMGR...'] },
      { name: 'Agent', symbol: 'agent', addresses: ['GCEXAMPLEAGNT...'] },
    ],
  },
  deployment: {
    target: {
      kind: 'preset',
      ecosystem: 'stellar',
      networkId: 'stellar-testnet',
    },
  },
};

// Step 1: Validate (optional but recommended)
const validation = validate(config);
if (!validation.valid) {
  console.error('Config errors:', validation.errors);
  process.exit(1);
}
if (validation.warnings.length > 0) {
  console.warn('Config warnings:', validation.warnings);
}

// Step 2: Generate the file tree
const result = generate(config);

console.log(`Generated ${result.metadata.fileCount} files:`);
for (const path of Object.keys(result.files)) {
  console.log(`  ${path}`);
}

// Access individual file contents
const tokenContract = result.files['contracts/rwa-token/src/contract.rs'];
console.log(tokenContract);
```

On Stellar, setting `token.initialSupply` does not make `deploy.sh` mint automatically. The generator emits validation and README/deploy guidance so the mint can be performed later, after the recipient has been onboarded into the upstream identity system.

If you are targeting custom infrastructure instead of an adapter preset, switch `deployment.target` to:

```typescript
deployment: {
  target: {
    kind: 'custom',
    ecosystem: 'stellar',
    rpcUrl: 'https://custom-rpc.example.com',
    explorerUrl: 'https://explorer.example.com', // optional
    label: 'Partner Sandbox', // optional
  },
}
```

## Generate a ZIP Archive

```typescript
// In Node.js: write to disk
import { writeFileSync } from 'fs';

import { generateZip } from '@openzeppelin/codegen-rwa-stellar';

const zip = await generateZip(config, {
  onProgress: (event) => {
    console.log(`[${event.phase}] ${event.percentage}% ${event.message ?? ''}`);
  },
});

writeFileSync(zip.fileName, Buffer.from(await zip.data.arrayBuffer()));

// In browser: trigger download
const url = URL.createObjectURL(zip.data);
const a = document.createElement('a');
a.href = url;
a.download = zip.fileName;
a.click();
```

## Query Available Compliance Modules

```typescript
import { getAvailableModules } from '@openzeppelin/codegen-rwa-stellar';

const modules = getAvailableModules();
for (const mod of modules) {
  console.log(`${mod.id}: ${mod.name} — hooks: ${mod.requiredHooks.join(', ')}`);
}
```

## Expected Output Structure

For a config with token symbol "ACME" and one compliance module:

```
acme-rwa/
├── Cargo.toml                        # Workspace manifest
├── README.md                         # Setup instructions + architecture
├── config.json                       # Serialized config snapshot for provenance/re-import
├── scripts/
│   ├── build.sh                      # Compile all contracts
│   └── deploy.sh                     # Deploy + configure in correct order
├── contracts/
│   ├── rwa-token/
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       └── contract.rs
│   ├── compliance/
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       └── contract.rs
│   ├── identity-verifier/
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       └── contract.rs
│   ├── claim-topics-issuers/
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       └── contract.rs
│   ├── identity-registry-storage/
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       └── contract.rs
│   └── modules/
│       └── supply-limit/
│           ├── Cargo.toml
│           └── src/
│               ├── lib.rs
│               └── contract.rs
```

## Development (Contributing)

```bash
# Clone the monorepo
git clone https://github.com/OpenZeppelin/rwa-wizard.git
cd rwa-wizard

# Install dependencies
pnpm install

# Build all packages (order matters: config → core → stellar)
pnpm --filter @openzeppelin/rwa-config build
pnpm --filter @openzeppelin/codegen-core build
pnpm --filter @openzeppelin/codegen-rwa-stellar build

# Run tests
pnpm --filter @openzeppelin/codegen-core test
pnpm --filter @openzeppelin/codegen-rwa-stellar test

# Run all package tests
pnpm -r --filter './packages/**' test
```
