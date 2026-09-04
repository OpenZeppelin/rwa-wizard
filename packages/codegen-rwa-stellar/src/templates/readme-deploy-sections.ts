import type { RWAConfig } from '@openzeppelin/rwa-config';

import { SOROBAN_SDK_VERSION } from '../constants';
import { resolveStellarDeploymentTarget } from '../deployment/target';
import { getConfiguredAccessControlRows, getDeploySignerGuidance } from './deploy-guidance';

function renderConfiguredAccessControlTable(config: RWAConfig): string {
  const rows = getConfiguredAccessControlRows(config);
  const lines: string[] = [];
  lines.push('| Role | Address | Deploy signer env var | Notes |');
  lines.push('|------|---------|-------------------------|-------|');

  for (const row of rows) {
    lines.push(
      `| ${row.role} | \`${row.address}\` | ${row.deploySignerEnvVar} | ${row.note ?? ''} |`
    );
  }

  return lines.join('\n');
}

function renderQuickStart(config: RWAConfig, includeDemoAutoMint: boolean): string {
  const guidance = getDeploySignerGuidance(config);
  const managerEnv = guidance.adminEqualsManager
    ? ''
    : `\nexport ADMIN_SOURCE_ACCOUNT=<admin-identity>\nexport MANAGER_SOURCE_ACCOUNT=<manager-identity>`;
  const demoMintStep = includeDemoAutoMint
    ? `\nchmod +x scripts/bootstrap-demo-mint.sh\n./scripts/bootstrap-demo-mint.sh   # testnet demo auto-mint (NOT production KYC)`
    : '';

  return `\`\`\`bash
# Prerequisites: Rust, Stellar CLI, wasm32v1-none target
rustup target add wasm32v1-none

# Admin for this project: ${guidance.adminAddress}
# Use a CLI identity you already control whose G-address matches Admin.
# stellar keys generate always creates a new random address — it will not match the
# preconfigured Admin unless you regenerated this project with that address in the wizard.
stellar keys address <your-identity>   # must output ${guidance.adminAddress}

# Build, then deploy
chmod +x scripts/build.sh scripts/deploy.sh
./scripts/build.sh
cargo fmt

export STELLAR_ACCOUNT=<your-identity>${managerEnv}
./scripts/deploy.sh --preflight   # optional: validate signers + WASM without deploying
./scripts/deploy.sh${demoMintStep}
\`\`\``;
}

function renderDeploySignerSection(
  config: RWAConfig,
  includeDemoAutoMint: boolean = false
): string {
  const guidance = getDeploySignerGuidance(config);
  const splitRoleBlock = guidance.adminEqualsManager
    ? ''
    : `
When Admin and Manager differ, set role-specific signers:

\`\`\`bash
export SOURCE_ACCOUNT=deployer
export ADMIN_SOURCE_ACCOUNT=admin-identity
export MANAGER_SOURCE_ACCOUNT=manager-identity
./scripts/deploy.sh
\`\`\`
`;

  return `Before running \`deploy.sh\`, set a signable Stellar CLI source account. The script resolves
\`SOURCE_ACCOUNT\` first and falls back to \`STELLAR_ACCOUNT\`.

**Configured addresses for this project**

- **Admin:** \`${guidance.adminAddress}\`
- **Manager:** \`${guidance.managerAddress}\`

The chosen identity must control these addresses — post-deploy configuration signs with the Manager role (and Admin for admin-gated invokes). If you do not control the configured Admin address, regenerate the project in the wizard with an address from \`stellar keys address <your-identity>\`.

${renderQuickStart(config, includeDemoAutoMint)}
${splitRoleBlock}
Run \`./scripts/deploy.sh --preflight\` to validate signers and WASM artifacts without spending XLM on deployment.`;
}

function renderNetworkPrerequisite(config: RWAConfig): string {
  const deployment = resolveStellarDeploymentTarget(config.deployment.target);
  const networkHint = deployment.networkFlag.includes('testnet')
    ? 'Ensure Stellar CLI knows the testnet profile (`stellar network ls`). Fund the deploy signer on testnet (`stellar keys generate <name> --fund`).'
    : 'Ensure Stellar CLI is configured for the target network and the deploy signer account is funded.';

  return `- ${networkHint}`;
}

function renderTroubleshooting(config: RWAConfig): string {
  const guidance = getDeploySignerGuidance(config);

  return `| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| \`Missing signing key for ${guidance.adminAddress}\` (or Manager) during post-deploy | \`STELLAR_ACCOUNT\` identity does not control Admin/Manager | \`stellar keys address <identity>\` must match the configured role address, or regenerate with your own address |
| \`Admin signer mismatch\` / \`Manager signer mismatch\` at start | CLI identity resolves to a different G-address | Export the identity that controls the configured address, or update Admin/Manager in the wizard and regenerate |
| \`Missing target/wasm32v1-none/release/*.wasm\` | Build step skipped | Run \`./scripts/build.sh\` before \`./scripts/deploy.sh\` |
| \`Missing Stellar source account\` | Neither \`SOURCE_ACCOUNT\` nor \`STELLAR_ACCOUNT\` is set | \`export STELLAR_ACCOUNT=<your-cli-identity>\` |
| Contracts deployed but script failed mid post-deploy | No resume support yet | Note addresses from the terminal output or \`deployment-manifest.json\` if written; redeploy to a fresh workspace or complete remaining invokes manually |
| Insufficient balance errors | Deploy signer unfunded | ${guidance.networkIsTestnet ? 'Fund on testnet: `stellar keys generate <name> --fund`' : 'Fund the deploy signer on the target network'} |`;
}

export function renderDeployReadmeSections(
  config: RWAConfig,
  networkDesc: string,
  options?: { includeDemoAutoMint?: boolean }
): string {
  const includeDemoAutoMint = options?.includeDemoAutoMint ?? false;

  return `Deploy all contracts to ${networkDesc}:

### Quick start

${renderDeploySignerSection(config, includeDemoAutoMint)}

### Configured access control

These addresses are embedded in \`scripts/deploy.sh\` at generation time:

${renderConfiguredAccessControlTable(config)}

### End-to-end script flow

\`build.sh\` compiles the workspace; \`deploy.sh\` deploys contracts and runs post-deploy configuration. The following diagram is generated from this project's config and matches the script order:

### Troubleshooting

${renderTroubleshooting(config)}

The deploy script handles the complete lifecycle:
1. Validates deploy signers and WASM artifacts (use \`--preflight\` to stop after validation)
2. Deploys contracts in dependency order
3. Captures deployed contract addresses
4. Performs post-deployment configuration (token binding, module registration, claim topics, trusted issuers)
5. Writes \`deployment-manifest.json\` with deployed addresses`;
}

export function renderExtendedPrerequisites(config: RWAConfig): string {
  return `- [Rust](https://www.rust-lang.org/tools/install) toolchain (edition 2021)
- [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/cli/install-cli) (\`stellar\` command)
- \`soroban-sdk\` version: \`${SOROBAN_SDK_VERSION}\`
- \`wasm32v1-none\` target: \`rustup target add wasm32v1-none\`
- Funded Stellar account on the target network for the deploy signer
${renderNetworkPrerequisite(config)}`;
}
