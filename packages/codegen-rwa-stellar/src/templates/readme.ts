import type { ProvenanceScope } from '@openzeppelin/codegen-core';
import { createLineBuilder } from '@openzeppelin/codegen-core';
import {
  getSelectedModuleSummaries,
  getUnderReviewModules,
  getUniqueModuleSelections,
  selectedClaimTopicIndices,
} from '@openzeppelin/codegen-rwa-common';
import type { RWAConfig } from '@openzeppelin/rwa-config';

import { renderDetached } from './contracts/detached-scope';
import { getDeploymentCrateNames } from './scripts/deploy-sh-deployments';

import { CRATE_NAMES } from '../constants';
import { resolveStellarDeploymentTarget } from '../deployment/target';
import { getModuleById } from '../modules/registry';
import type { UpstreamTemplateSourceMetadata } from '../upstream/types';
import { formatDemoMintPreflightModuleList } from './demo-mint-compliance-preflight';
import { IDENTITY_SUPPORT_CONTRACTS } from './identity-support-contracts';
import { renderDeployReadmeSections, renderExtendedPrerequisites } from './readme-deploy-sections';

interface ContractTableRow {
  crate: string;
  name: string;
  purpose: string;
  traits: string[];
}

export interface ReadmeGenerationContext {
  templateSourceMetadata: UpstreamTemplateSourceMetadata;
  includeIdentitySupport?: boolean;
  includeDemoAutoMint?: boolean;
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

function getExampleContractTable(): ContractTableRow[] {
  return [
    {
      crate: IDENTITY_SUPPORT_CONTRACTS[0].crateName,
      name: IDENTITY_SUPPORT_CONTRACTS[0].displayName,
      purpose: 'Example Ed25519 claim issuer for demo/testnet claim signing',
      traits: ['ClaimIssuer', 'Ownable'],
    },
    {
      crate: IDENTITY_SUPPORT_CONTRACTS[1].crateName,
      name: IDENTITY_SUPPORT_CONTRACTS[1].displayName,
      purpose: 'Example per-holder identity contract for onboarding demos',
      traits: ['IdentityClaims', 'Ownable'],
    },
  ];
}

function renderBuildArtifactNote(config: RWAConfig, context: ReadmeGenerationContext): string {
  const deployableCount = getDeploymentCrateNames(config).length;

  if (context.includeIdentitySupport) {
    const exampleCount = IDENTITY_SUPPORT_CONTRACTS.length;
    const builtCount = deployableCount + exampleCount;
    return `\n\`build.sh\` compiles **${builtCount}** WASM artifacts: **${deployableCount}** deployed by \`deploy.sh\`, plus **${exampleCount}** example/dev-only crates (\`rwa_claim_issuer_example.wasm\`, \`rwa_identity_example.wasm\`). Preflight validates only the ${deployableCount} deployable artifacts.\n`;
  }

  return `\n\`build.sh\` produces **${deployableCount}** WASM artifacts — the same set \`deploy.sh\` validates and deploys.\n`;
}

function renderIdentityOnboardingArchitecture(context: ReadmeGenerationContext): string {
  if (context.includeIdentitySupport) {
    const demoMintNote = context.includeDemoAutoMint
      ? ' When `token.initialSupply` is set on testnet, this export also includes `scripts/bootstrap-demo-mint.sh` — a **demo-only** script that deploys the example contracts, onboards Admin with hardcoded demo claims, and mints the configured initial supply after `./scripts/deploy.sh`. It is educational scaffolding, not production KYC.'
      : '';
    return `This export includes upstream **example** Claim Issuer and per-holder Identity contracts under \`contracts/claim-issuer\` and \`contracts/identity\`, plus a \`tools/sign-claim\` helper. \`build.sh\` compiles them alongside the core contracts, but \`deploy.sh\` does **not** deploy or wire them automatically — use them for local/testnet onboarding demos after the core system is deployed.${demoMintNote}`;
  }

  return `This generated project does not include the upstream **Claim Issuer** or per-holder **Identity** example contracts used to onboard verified investors. Those contracts must exist before a recipient can pass Stellar identity verification and receive minted tokens. Enable testnet identity scaffolding in the wizard (or \`--include-identity-support\` in the CLI) to add the example crates.`;
}

function renderExampleContractsSection(context: ReadmeGenerationContext): string {
  if (!context.includeIdentitySupport) {
    return '';
  }

  const lines: string[] = [];
  lines.push('### Example / dev-only contracts');
  lines.push('');
  lines.push(
    'Built for onboarding demos; not deployed or wired by `deploy.sh`. See `tools/sign-claim` for signing demo claims.'
  );
  lines.push('');
  lines.push(renderContractTable(getExampleContractTable()));
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
function renderE2eScriptFlowMermaid(config: RWAConfig, context: ReadmeGenerationContext): string {
  const networkDesc = getNetworkDescription(config);
  const modules = getUniqueModuleSelections(config.compliance.modules);
  // SELECTED topics, not defined ones: the flowchart describes what deploy.sh
  // does, and deploy.sh registers only the selected set. This call is made bare
  // into a `builder.block`, so its reads attribute to the whole README block —
  // the pre-existing pattern here. The block gains a
  // `claimTopics[i].selected` path and no significance mark, because a mark is
  // written by the display emitters over a whole emission and this is not one.
  const topicCount = selectedClaimTopicIndices(config).length;
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
    const supplyLabel = context.includeDemoAutoMint
      ? 'Initial supply: bootstrap-demo-mint.sh (testnet demo)'
      : 'Initial supply: manual mint guidance (stdout)';
    lines.push(`  ${prev} --> ${nSup}["${escapeMermaidNodeLabel(supplyLabel)}"]`);
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
function renderInitialSupplyNote(config: RWAConfig, context: ReadmeGenerationContext): string {
  if (config.token.initialSupply === undefined) {
    return '';
  }

  const identityNote = context.includeIdentitySupport
    ? context.includeDemoAutoMint
      ? 'This export includes `scripts/bootstrap-demo-mint.sh` (testnet demo only) which deploys the example Claim Issuer and Identity contracts, onboards Admin with demo claims, and mints the configured amount after `./scripts/deploy.sh`.'
      : 'This export includes example Claim Issuer and Identity crates (see Contracts), but `deploy.sh` does not deploy or wire them automatically — deploy them separately for testnet onboarding before minting.'
    : 'This generated project scaffolds CTI, IRS, and the Identity Verifier, but it does not include those investor-specific identity contracts, so perform the mint manually after identity onboarding.';

  return `If \`token.initialSupply\` is set, note that \`deploy.sh\` does **not** auto-mint it. The upstream claim-based identity flow requires a trusted claim issuer contract, a per-holder identity contract with claims, and IRS registration for the mint recipient before \`mint\` can pass identity verification. ${identityNote} The configured initial supply is expressed in on-chain base units (smallest token units), not display units; with \`token.decimals = ${config.token.decimals}\`, one whole token equals \`10^${config.token.decimals}\` base units.\n`;
}

function renderDemoAutoMintWorkflow(config: RWAConfig, context: ReadmeGenerationContext): string {
  if (!context.includeDemoAutoMint) {
    return '';
  }

  const preflightModules = formatDemoMintPreflightModuleList(config);

  return `### Testnet demo auto-mint workflow

This export targets **educational Scope A** on testnet: onboard Admin with example identity contracts and mint \`token.initialSupply\` after deploy. **Not production KYC.**

Run scripts in this order (copy-paste friendly):

\`\`\`bash
# 1) Build + deploy the core system (same as every export)
chmod +x scripts/build.sh scripts/deploy.sh
./scripts/build.sh
cargo fmt
export STELLAR_ACCOUNT=<your-testnet-identity>
./scripts/deploy.sh --preflight   # optional
./scripts/deploy.sh

# 2) Demo onboarding + mint (separate script — reads deployment-manifest.json)
chmod +x scripts/bootstrap-demo-mint.sh
./scripts/bootstrap-demo-mint.sh --preflight   # optional: \`created\` hook + on-chain limit check
./scripts/bootstrap-demo-mint.sh               # deploy example issuer/identity, register Admin, mint

# If preflight prints Manager invokes (${preflightModules}),
# run those commands yourself, then re-run bootstrap-demo-mint.sh.
\`\`\`

**What the bootstrap script does:** deploy example Claim Issuer → register in CTI → sign demo claims → deploy Identity for Admin → register in IRS (country CH / 756) → compliance preflight on the \`created\` hook → \`mint\` to Admin.

**Fix conflicts in the wizard first when possible** (raise supply/max limits, allow CH, do not restrict CH). The wizard validates these before export when demo auto-mint is enabled.

`;
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
export const README_PATH = 'README.md';

/**
 * `true` when `block` holds at least one character the trimming rule attributes
 * — anything other than `'\n'` and `'\r'`.
 *
 * A local one-liner rather than a new `codegen-core` export: core implements the
 * same predicate as the unexported `hasAttributableContent`, and growing a
 * generic package's API for one consumer is exactly what INV-31 forbids.
 */
function hasAttributableContent(block: string): boolean {
  for (const character of block) {
    if (character !== '\n' && character !== '\r') return true;
  }
  return false;
}

/**
 * Emit `README.md` as a block-split shape-C literal.
 *
 * Every cut below is a newline written literally in the original template
 * source, outside every interpolation, so `blocks.join('\n')` reproduces the
 * original character for character for EVERY input, not merely for the sixteen
 * fixtures (INV-6). Two cuts were considered and rejected:
 *
 * - after `${selectedModulesSection ? … : ''}`, because `### Upstream Provenance`
 *   sits on the same line with no newline between them — a cut there would
 *   INVENT a newline (INV-6). That span is emitted as one block, which is
 *   honest: the block exists because of those selections.
 * - inside any interpolation's returned string, for the same reason.
 *
 * Blocks are constructed at their emit site, never up front: building them all
 * first would run every renderer's config reads before the first emission, and
 * the whole file's dependencies would land on the title line (INV-24).
 */
export function generateReadmeInScope(
  scope: ProvenanceScope<RWAConfig>,
  context: ReadmeGenerationContext
): string {
  // INV-17: first toucher of the scope.
  const builder = createLineBuilder(scope, { separator: '\n' });

  // INV-24: the three hoisted values, observed so their paths reach the blocks
  // they shape instead of draining onto the title.
  const contractTable = builder.observe((config) => getCoreContractTable(config));
  const networkDesc = builder.observe((config) => getNetworkDescription(config));
  const selectedModulesSection = builder.observe((config) => renderSelectedModules(config));

  builder.block(`# ${builder.config.token.name} (${builder.config.token.symbol})`);

  builder.block(`
> Generated by [@openzeppelin/codegen-rwa-stellar](https://www.npmjs.com/package/@openzeppelin/codegen-rwa-stellar)

## Prerequisites

${renderExtendedPrerequisites(builder.config)}

## Build

Compile all contracts in the workspace (required before deploy):

\`\`\`bash
chmod +x scripts/build.sh
./scripts/build.sh
\`\`\`
${renderBuildArtifactNote(builder.config, context)}
After building, run \`cargo fmt\` to apply canonical Rust formatting to the generated source files.

## Deploy
`);

  builder.block(
    renderDeployReadmeSections(builder.config, networkDesc.value, {
      includeDemoAutoMint: context.includeDemoAutoMint,
    }),
    networkDesc.paths
  );

  builder.block(`
${renderDemoAutoMintWorkflow(builder.config, context)}

${renderE2eScriptFlowMermaid(builder.config, context)}

${renderInitialSupplyNote(builder.config, context)}
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

${renderIdentityOnboardingArchitecture(context)}

## Contracts
`);

  builder.block(renderContractTable(contractTable.value), contractTable.paths);

  builder.block(`
${renderExampleContractsSection(context)}`);

  // The selected-modules span shares its line with `### Upstream Provenance`, so
  // it cannot be isolated (INV-6). The merged block carries its paths, which is
  // honest — the block exists because of those selections (INV-37 Open Q2).
  // Observed immediately before the block it shapes: it reads
  // `compliance.modules` to decide whether to warn, and that read must not drain
  // onto the block when it renders nothing.
  const underReviewWarning = builder.observe((config) => renderUnderReviewWarning(config));

  builder.block(
    `${selectedModulesSection.value ? `${selectedModulesSection.value}\n` : ''}### Upstream Provenance

${renderUpstreamProvenance(context.templateSourceMetadata)}
${underReviewWarning.value}
## Platform Note

Shell scripts (\`build.sh\`, \`deploy.sh\`) target **Unix-like environments** (Linux, macOS). Windows users should use WSL or a compatible shell.
`,
    // INV-37: the selected-modules span shares its line with the heading, so it
    // rides a merged block — but it may carry the module paths ONLY when it
    // actually rendered something. When no module is selected it contributes no
    // character, and attributing it here would tell the user that ticking a
    // module rewrites the Upstream Provenance stanza and the Platform Note,
    // which is INV-34's violation scenario word for word. Same predicate as the
    // empty member groups in `workspaceTomlBlocks`.
    // Both spans are possibly-empty interpolations sharing this block. Each
    // contributes its paths only when it actually rendered a character.
    [
      ...(hasAttributableContent(selectedModulesSection.value) ? selectedModulesSection.paths : []),
      ...(hasAttributableContent(underReviewWarning.value) ? underReviewWarning.paths : []),
    ]
  );

  return builder.text();
}

export function generateReadme(config: RWAConfig, context: ReadmeGenerationContext): string {
  return renderDetached(config, README_PATH, (scope) => generateReadmeInScope(scope, context));
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
