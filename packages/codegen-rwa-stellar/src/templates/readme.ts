import type { RWAConfig } from '@openzeppelin/rwa-config';

import {
  CRATE_NAMES,
  SOROBAN_SDK_VERSION,
  STELLAR_CONTRACTS_REPOSITORY_URL,
} from '../constants';
import { getModuleById } from '../modules/registry';
import type { UpstreamTemplateSourceMetadata } from '../upstream/types';

interface ContractTableRow {
  crate: string;
  name: string;
  purpose: string;
  traits: string[];
}

interface SelectedModuleRow {
  id: string;
  name: string;
  hooks: string[];
  configSummary: string;
  reviewSummary: string;
}

export interface ReadmeGenerationContext {
  templateSourceMetadata: UpstreamTemplateSourceMetadata;
}

/**
 * Build the contract summary table rows shown in the generated README.
 */
function getCoreContractTable(config: RWAConfig): ContractTableRow[] {
  const tokenTraits = ['FungibleToken', 'AccessControl', 'Pausable'];
  if (config.token.documentManager.enabled) {
    tokenTraits.push('DocumentManager');
  }

  return [
    {
      crate: CRATE_NAMES.rwaTtoken,
      name: 'RWA Token',
      purpose: 'Primary tokenized asset with transfer restrictions',
      traits: tokenTraits,
    },
    {
      crate: CRATE_NAMES.compliance,
      name: 'Compliance',
      purpose: 'Enforces transfer compliance via pluggable modules',
      traits: ['Compliance', 'TokenBinder', 'AccessControl'],
    },
    {
      crate: CRATE_NAMES.identityVerifier,
      name: 'Identity Verifier',
      purpose: 'Verifies holder identity via claim topics',
      traits: ['IdentityVerifier', 'AccessControl'],
    },
    {
      crate: CRATE_NAMES.claimTopicsIssuers,
      name: 'Claim Topics & Issuers',
      purpose: 'Manages trusted claim issuers and topic definitions',
      traits: ['ClaimTopicsAndIssuers', 'AccessControl'],
    },
    {
      crate: CRATE_NAMES.identityRegistryStorage,
      name: 'Identity Registry Storage',
      purpose: 'Stores identity data and country information',
      traits: ['IdentityRegistryStorage', 'CountryDataManager', 'TokenBinder', 'AccessControl'],
    },
  ];
}

/**
 * Render the contract summary table as Markdown.
 */
function renderContractTable(rows: ContractTableRow[]): string {
  const lines: string[] = [];
  lines.push('| Crate | Contract | Purpose | Traits |');
  lines.push('|-------|----------|---------|--------|');

  for (const row of rows) {
    lines.push(`| \`${row.crate}\` | ${row.name} | ${row.purpose} | ${row.traits.join(', ')} |`);
  }

  return lines.join('\n');
}

/**
 * Return module rows for the selected compliance modules.
 */
function getSelectedModuleRows(config: RWAConfig): SelectedModuleRow[] {
  const seen = new Set<string>();
  const rows: SelectedModuleRow[] = [];

  for (const selection of config.compliance.modules) {
    if (seen.has(selection.moduleId)) {
      continue;
    }
    seen.add(selection.moduleId);

    const entry = getModuleById(selection.moduleId);
    if (!entry) {
      continue;
    }

    rows.push({
      id: entry.id,
      name: entry.name,
      hooks: [...entry.requiredHooks],
      configSummary: formatModuleConfigSummary(selection.config ?? {}, entry.configFields.map((f) => f.key)),
      reviewSummary:
        entry.review.state === 'under-review'
          ? entry.review.prUrl
            ? `Under review ([PR](${entry.review.prUrl}))`
            : 'Under review'
          : 'Stable',
    });
  }

  return rows;
}

/**
 * Format module config values into a concise human-readable summary.
 */
function formatModuleConfigSummary(config: Record<string, unknown>, preferredKeys: readonly string[]): string {
  const configKeys = Object.keys(config);
  if (configKeys.length === 0) {
    return 'None';
  }

  const remainingKeys = configKeys.filter((key) => !preferredKeys.includes(key)).sort();
  const orderedKeys = [...preferredKeys.filter((key) => key in config), ...remainingKeys];
  const parts = orderedKeys.flatMap((key) => {
    const value = config[key];
    if (value === undefined || value === null) {
      return [];
    }
    if (typeof value === 'string' && value.trim().length === 0) {
      return [];
    }
    if (Array.isArray(value) && value.length === 0) {
      return [];
    }

    return [`\`${key}=${formatModuleConfigValue(value)}\``];
  });

  return parts.length > 0 ? parts.join(', ') : 'None';
}

/**
 * Render one module config value for Markdown output.
 */
function formatModuleConfigValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry)).join(', ');
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Render the selected compliance modules section when modules are configured.
 */
function renderSelectedModules(config: RWAConfig): string {
  const rows = getSelectedModuleRows(config);
  if (rows.length === 0) {
    return '';
  }

  const lines: string[] = [];
  lines.push('## Selected Compliance Modules');
  lines.push('');
  lines.push('| Module | Hooks | Config | Review |');
  lines.push('|--------|-------|--------|--------|');

  for (const row of rows) {
    lines.push(
      `| ${row.name} (\`${row.id}\`) | ${row.hooks.map((hook) => `\`${hook}\``).join(', ')} | ${row.configSummary} | ${row.reviewSummary} |`
    );
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Format the configured deployment network for human-readable documentation.
 */
function getNetworkDescription(config: RWAConfig): string {
  const network = config.deployment.network;
  if (network === 'testnet') return 'Stellar Testnet';
  if (network === 'mainnet') return 'Stellar Mainnet';
  return `Custom RPC: \`${network}\``;
}

/**
 * Render human-readable provenance for the upstream template source used.
 */
function renderUpstreamProvenance(metadata: UpstreamTemplateSourceMetadata): string {
  const shortCommit = metadata.sourceCommitHash.slice(0, 7);

  if (metadata.strategy === 'local-checkout') {
    return `Contract source was generated from a local checkout of [OpenZeppelin Stellar Contracts](${STELLAR_CONTRACTS_REPOSITORY_URL}) at commit \`${shortCommit}\`. The workspace \`Cargo.toml\` resolves upstream crates via local path dependencies for this generation.`;
  }

  return `Contract source was generated from a bundled snapshot of upstream [OpenZeppelin Stellar Contracts](${STELLAR_CONTRACTS_REPOSITORY_URL}) examples synced from commit \`${shortCommit}\`. See \`Cargo.toml\` for the exact dependency source used by this project.`;
}

/**
 * Generates the project README.md with the SR-009 required sections plus
 * module/provenance details when relevant:
 * 1. Project title and generated-by attribution
 * 2. Prerequisites
 * 3. Build instructions
 * 4. Deployment instructions
 * 5. Architecture overview
 * 6. Contract table
 * 7. Unix note
 */
export function generateReadme(config: RWAConfig, context: ReadmeGenerationContext): string {
  const contractTable = getCoreContractTable(config);
  const networkDesc = getNetworkDescription(config);
  const selectedModulesSection = renderSelectedModules(config);

  return `# ${config.token.name} (${config.token.symbol})

> Generated by [@openzeppelin/codegen-rwa-stellar](https://www.npmjs.com/package/@openzeppelin/codegen-rwa-stellar)

## Prerequisites

- [Rust](https://www.rust-lang.org/tools/install) toolchain (edition 2021)
- [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/cli/install-cli) (\`stellar\` command)
- \`soroban-sdk\` version: \`${SOROBAN_SDK_VERSION}\`
- \`wasm32-unknown-unknown\` target: \`rustup target add wasm32-unknown-unknown\`

## Build

Compile all contracts in the workspace:

\`\`\`bash
chmod +x scripts/build.sh
./scripts/build.sh
\`\`\`

After building, run \`cargo fmt\` to apply canonical Rust formatting to the generated source files.

## Deploy

Deploy all contracts to ${networkDesc}:

\`\`\`bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
\`\`\`

The deploy script handles the complete lifecycle:
1. Deploys contracts in dependency order
2. Captures deployed contract addresses
3. Performs post-deployment configuration (token binding, module registration, claim topics, trusted issuers)
${config.token.initialSupply !== undefined ? '4. Mints initial token supply\n' : ''}
Configuration values are read from \`config.json\`.

## Architecture

This is a multi-contract Stellar/Soroban system implementing a Real World Asset (RWA) token with identity verification and compliance enforcement.

The system follows a modular architecture where each concern is handled by a dedicated contract:

- **RWA Token** — The primary asset token with built-in transfer restrictions
- **Compliance** — Pluggable compliance engine that validates transfers against registered modules
- **Identity Verifier** — Verifies that token holders have valid identity claims
- **Claim Topics & Issuers (CTI)** — Registry of trusted claim issuers and the topics they can attest to
- **Identity Registry Storage (IRS)** — Persistent storage for identity data and country information

Contracts communicate through address references established during deployment. The deploy script handles all cross-contract wiring automatically.

## Contracts

${renderContractTable(contractTable)}

${selectedModulesSection ? `${selectedModulesSection}\n` : ''}### Upstream Provenance

${renderUpstreamProvenance(context.templateSourceMetadata)}
${renderUnderReviewWarning(config)}
## Platform Note

Shell scripts (\`build.sh\`, \`deploy.sh\`) target **Unix-like environments** (Linux, macOS). Windows users should use WSL or a compatible shell.
`;
}

/**
 * Render the under-review module warning section when relevant.
 */
function renderUnderReviewWarning(config: RWAConfig): string {
  const uniqueIds = [...new Set(config.compliance.modules.map((m) => m.moduleId))];
  const underReview = uniqueIds
    .map((id) => getModuleById(id))
    .filter((e) => e && e.review.state === 'under-review');

  if (underReview.length === 0) return '';

  const items: string[] = [];
  for (const entry of underReview) {
    const link = entry!.review.prUrl ? ` — [Review PR](${entry!.review.prUrl})` : '';
    items.push(`- **${entry!.name}** (\`${entry!.id}\`)${link}`);
  }

  const parts: string[] = [];
  parts.push('');
  parts.push('## Under-Review Modules');
  parts.push('');
  parts.push(
    '> **Warning:** This project uses compliance modules that are still under review in the upstream [stellar-contracts](https://github.com/OpenZeppelin/stellar-contracts) repository. Do NOT deploy to production until all reviews are complete and merged.'
  );
  parts.push('');
  parts.push(items.join('\n'));
  parts.push('');
  parts.push('See `UNDER_REVIEW_MODULES.md` for details.');
  parts.push('');

  return parts.join('\n');
}
