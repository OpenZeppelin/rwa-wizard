import {
  getSelectedModuleSummaries,
  getUnderReviewModules,
  getUniqueModuleSelections,
} from '@openzeppelin/codegen-rwa-common';
import type { RWAConfig } from '@openzeppelin/rwa-config';

import { CRATE_NAMES, SOROBAN_SDK_VERSION } from '../constants';
import { resolveStellarDeploymentTarget } from '../deployment/target';
import { getModuleById } from '../modules/registry';
import type { UpstreamTemplateSourceMetadata } from '../upstream/types';

interface ContractTableRow {
  crate: string;
  name: string;
  purpose: string;
  traits: string[];
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
      crate: CRATE_NAMES.rwaToken,
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
 * Render the selected compliance modules section when modules are configured.
 */
function renderSelectedModules(config: RWAConfig): string {
  const rows = getSelectedModuleSummaries(config.compliance.modules, getModuleById);
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
  const deployment = resolveStellarDeploymentTarget(config.deployment.target);
  return deployment.displayName;
}

/**
 * Escape text for use inside Mermaid double-quoted node labels.
 */
function escapeMermaidNodeLabel(text: string): string {
  return text.replace(/"/g, '#quot;');
}

/**
 * Minimalist flowchart of the generated `build.sh` + `deploy.sh` pipeline, driven by config.
 */
function renderE2eScriptFlowMermaid(config: RWAConfig): string {
  const networkDesc = getNetworkDescription(config);
  const modules = getUniqueModuleSelections(config.compliance.modules);
  const topicCount = config.identityVerification.claimTopics.length;
  const issuerCount = config.identityVerification.trustedIssuers.length;
  const hasInitialSupply = config.token.initialSupply !== undefined;

  const lines: string[] = [];
  lines.push('flowchart TD');
  lines.push(`  %% Network: ${escapeMermaidNodeLabel(networkDesc)}`);

  let step = 0;
  const id = () => `s${step++}`;

  const nBuild = id();
  const nDeploy = id();
  lines.push(
    `  ${nBuild}["${escapeMermaidNodeLabel('build.sh → stellar contract build')}"] --> ${nDeploy}["${escapeMermaidNodeLabel(`deploy.sh (${networkDesc})`)}"]`
  );

  const nCore = id();
  lines.push(
    `  ${nDeploy} --> ${nCore}["${escapeMermaidNodeLabel('Deploy: CTI → IRS → Identity Verifier → Compliance')}"]`
  );

  let prev = nCore;
  if (modules.length > 0) {
    const nMods = id();
    const modLabel =
      modules.length === 1
        ? 'Deploy compliance module'
        : `Deploy ${modules.length} compliance modules`;
    lines.push(`  ${prev} --> ${nMods}["${escapeMermaidNodeLabel(modLabel)}"]`);
    prev = nMods;
  }

  const nToken = id();
  lines.push(`  ${prev} --> ${nToken}["${escapeMermaidNodeLabel('Deploy RWA token')}"]`);

  const nBind = id();
  lines.push(
    `  ${nToken} --> ${nBind}["${escapeMermaidNodeLabel('Post-deploy: bind token on Compliance and IRS')}"]`
  );
  prev = nBind;

  if (modules.length > 0) {
    const nWire = id();
    lines.push(
      `  ${prev} --> ${nWire}["${escapeMermaidNodeLabel('Post-deploy: configure modules and register hooks on Compliance')}"]`
    );
    prev = nWire;
  }

  if (topicCount > 0) {
    const nTopics = id();
    const label =
      topicCount === 1
        ? 'Post-deploy: add claim topic on CTI'
        : `Post-deploy: add ${topicCount} claim topics on CTI`;
    lines.push(`  ${prev} --> ${nTopics}["${escapeMermaidNodeLabel(label)}"]`);
    prev = nTopics;
  }

  if (issuerCount > 0) {
    const nIss = id();
    const label =
      issuerCount === 1
        ? 'Post-deploy: add trusted issuer on CTI'
        : `Post-deploy: add ${issuerCount} trusted issuers on CTI`;
    lines.push(`  ${prev} --> ${nIss}["${escapeMermaidNodeLabel(label)}"]`);
    prev = nIss;
  }

  if (hasInitialSupply) {
    const nSup = id();
    lines.push(
      `  ${prev} --> ${nSup}["${escapeMermaidNodeLabel('Initial supply: manual mint guidance (stdout)')}"]`
    );
    prev = nSup;
  }

  const nSummary = id();
  lines.push(`  ${prev} --> ${nSummary}["${escapeMermaidNodeLabel('Deployment summary')}"]`);

  return ['```mermaid', ...lines, '```'].join('\n');
}

/**
 * Convert a git-style source URL into a browser-friendly repository URL.
 */
function toRepositoryBrowserUrl(sourceRepoUrl: string): string {
  return sourceRepoUrl.replace(/\.git$/, '');
}

/**
 * Render human-readable provenance for the upstream template source used.
 */
function renderUpstreamProvenance(metadata: UpstreamTemplateSourceMetadata): string {
  const shortCommit = metadata.sourceCommitHash.slice(0, 7);
  const repoUrl = toRepositoryBrowserUrl(metadata.sourceRepoUrl);

  if (metadata.strategy === 'local-checkout') {
    return `Contract source was generated from a local checkout of the [Stellar contracts source repository](${repoUrl}) at commit \`${shortCommit}\`. The workspace \`Cargo.toml\` resolves upstream crates via local path dependencies for this generation.`;
  }

  return `Contract source was generated from a bundled snapshot of the [Stellar contracts source repository](${repoUrl}) examples synced from commit \`${shortCommit}\`. See \`Cargo.toml\` for the exact dependency source used by this project.`;
}

/**
 * Explain why the requested initial supply is not auto-minted on Stellar.
 */
function renderInitialSupplyNote(config: RWAConfig): string {
  if (config.token.initialSupply === undefined) {
    return '';
  }

  return `If \`token.initialSupply\` is set, note that \`deploy.sh\` does **not** auto-mint it. The upstream claim-based identity flow requires a trusted claim issuer contract, a per-holder identity contract with claims, and IRS registration for the mint recipient before \`mint\` can pass identity verification. This generated project scaffolds CTI, IRS, and the Identity Verifier, but it does not scaffold those investor-specific identity contracts, so perform the mint manually after identity onboarding. The configured initial supply is expressed in on-chain base units (smallest token units), not display units; with \`token.decimals = ${config.token.decimals}\`, one whole token equals \`10^${config.token.decimals}\` base units.\n`;
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
- \`wasm32v1-none\` target: \`rustup target add wasm32v1-none\`

## Build

Compile all contracts in the workspace:

\`\`\`bash
chmod +x scripts/build.sh
./scripts/build.sh
\`\`\`

After building, run \`cargo fmt\` to apply canonical Rust formatting to the generated source files.

## Deploy

Deploy all contracts to ${networkDesc}:

### End-to-end script flow

\`build.sh\` compiles the workspace; \`deploy.sh\` deploys contracts and runs post-deploy configuration. The following diagram is generated from this project's config and matches the script order:

${renderE2eScriptFlowMermaid(config)}

\`\`\`bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
\`\`\`

Before running \`deploy.sh\`, set a signable Stellar CLI source account. The script resolves
\`SOURCE_ACCOUNT\` first and falls back to \`STELLAR_ACCOUNT\`:

\`\`\`bash
export STELLAR_ACCOUNT=alice
./scripts/deploy.sh
\`\`\`

The chosen source account must be able to authorize the configured admin/operator actions during deployment.

The deploy script handles the complete lifecycle:
1. Deploys contracts in dependency order
2. Captures deployed contract addresses
3. Performs post-deployment configuration (token binding, module registration, claim topics, trusted issuers)
${renderInitialSupplyNote(config)}
\`config.json\` is an informational snapshot of the exact source config used to generate this project. You can reuse it to regenerate or re-import the project later, but \`deploy.sh\` does not read it at runtime.

## Architecture

This is a multi-contract Stellar/Soroban system implementing a Real World Asset (RWA) token with identity verification and compliance enforcement.

The system follows a modular architecture where each concern is handled by a dedicated contract:

- **RWA Token** — The primary asset token with built-in transfer restrictions
- **Compliance** — Pluggable compliance engine that validates transfers against registered modules
- **Identity Verifier** — Verifies that token holders have valid identity claims
- **Claim Topics & Issuers (CTI)** — Registry of trusted claim issuers and the topics they can attest to
- **Identity Registry Storage (IRS)** — Persistent storage for identity data and country information

Contracts communicate through address references established during deployment. The deploy script handles all cross-contract wiring automatically.

This generated project does not currently scaffold the upstream **Claim Issuer** or per-holder **Identity** example contracts used to onboard verified investors. Those contracts must exist before a recipient can pass Stellar identity verification and receive minted tokens.

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
  const underReview = getUnderReviewModules(config.compliance.modules, getModuleById);

  if (underReview.length === 0) return '';

  const items: string[] = [];
  for (const entry of underReview) {
    const link = entry.prUrl ? ` — [Review PR](${entry.prUrl})` : '';
    items.push(`- **${entry.name}** (\`${entry.id}\`)${link}`);
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
