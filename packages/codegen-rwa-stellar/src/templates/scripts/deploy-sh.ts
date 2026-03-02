import type { RWAConfig } from '@openzeppelin/rwa-config';

import { CRATE_NAMES } from '../../constants';

function getAdminAddress(config: RWAConfig): string {
  const ownership = config.accessControl.ownership;
  if (ownership.type === 'single-owner') return ownership.ownerAddress;
  return ownership.address;
}

function getNetworkFlag(config: RWAConfig): string {
  const network = config.deployment.network;
  if (network === 'testnet' || network === 'mainnet') {
    return `--network ${network}`;
  }
  return `--rpc-url ${network}`;
}

function buildDeployCommand(
  crateName: string,
  constructorArgs: string,
  networkFlag: string
): string {
  return `stellar contract deploy \\
  --wasm target/wasm32-unknown-unknown/release/${crateName.replace(/-/g, '_')}.wasm \\
  ${networkFlag} \\
  -- \\
  ${constructorArgs}`;
}

function buildDeploySection(
  varName: string,
  crateName: string,
  constructorArgs: string,
  networkFlag: string
): string {
  const lines: string[] = [];

  lines.push(`echo "Deploying ${crateName}..."`);
  lines.push(`${varName}=$(${buildDeployCommand(crateName, constructorArgs, networkFlag)})`);
  lines.push(`if [ $? -ne 0 ] || [ -z "$${varName}" ]; then`);
  lines.push(`  echo "Failed to deploy ${crateName}"`);
  lines.push('  exit 1');
  lines.push('fi');
  lines.push(`echo "${crateName} deployed at: $${varName}"`);

  return lines.join('\n');
}

function buildPostDeployConfig(config: RWAConfig, networkFlag: string): string {
  const lines: string[] = [];
  const adminAddress = getAdminAddress(config);

  lines.push('# Post-deploy configuration (SR-013)');
  lines.push('echo "Starting post-deploy configuration..."');
  lines.push('');

  lines.push('# Bind token on Compliance and IRS');
  lines.push(
    buildInvokeCommand(
      '$COMPLIANCE_ADDRESS',
      'bind_token',
      `--token "$RWA_TOKEN_ADDRESS" --operator "${adminAddress}"`,
      networkFlag
    )
  );
  lines.push(
    buildInvokeCommand(
      '$IRS_ADDRESS',
      'bind_token',
      `--token "$RWA_TOKEN_ADDRESS" --operator "${adminAddress}"`,
      networkFlag
    )
  );

  if (config.compliance.modules.length > 0) {
    lines.push('');
    lines.push('# Register compliance modules');
    for (const mod of config.compliance.modules) {
      const modVarName = `MODULE_${mod.moduleId.toUpperCase().replace(/-/g, '_')}_ADDRESS`;
      lines.push(
        buildInvokeCommand(
          '$COMPLIANCE_ADDRESS',
          'add_module_to',
          `--hook "${mod.hook}" --module "$${modVarName}" --operator "${adminAddress}"`,
          networkFlag
        )
      );
    }
  }

  if (config.identityVerification.claimTopics.length > 0) {
    lines.push('');
    lines.push('# Add claim topics');
    for (const topic of config.identityVerification.claimTopics) {
      lines.push(
        buildInvokeCommand(
          '$CTI_ADDRESS',
          'add_claim_topic',
          `--topic ${topic.id} --operator "${adminAddress}"`,
          networkFlag
        )
      );
    }
  }

  if (config.identityVerification.trustedIssuers.length > 0) {
    lines.push('');
    lines.push('# Add trusted issuers');
    for (const issuer of config.identityVerification.trustedIssuers) {
      const topicsArg = issuer.claimTopics.map(String).join(',');
      lines.push(
        buildInvokeCommand(
          '$CTI_ADDRESS',
          'add_trusted_issuer',
          `--issuer "${issuer.address}" --claim-topics "[${topicsArg}]" --operator "${adminAddress}"`,
          networkFlag
        )
      );
    }
  }

  if (config.token.initialSupply !== undefined) {
    lines.push('');
    lines.push('# Mint initial supply');
    lines.push(
      buildInvokeCommand(
        '$RWA_TOKEN_ADDRESS',
        'mint',
        `--to "${adminAddress}" --amount ${config.token.initialSupply}`,
        networkFlag
      )
    );
  }

  return lines.join('\n');
}

function buildInvokeCommand(
  contractAddr: string,
  fnName: string,
  args: string,
  networkFlag: string
): string {
  return `stellar contract invoke \\
  --id ${contractAddr} \\
  ${networkFlag} \\
  -- \\
  ${fnName} \\
  ${args}`;
}

/**
 * Generates `deploy.sh` — a shell script that deploys and configures all
 * contracts in the correct dependency order per SR-006 and SR-013.
 *
 * Deployment order: CTI → IRS → Identity Verifier → Compliance → Modules → RWA Token
 * Post-deploy: bind token → register modules → add claim topics → add trusted issuers → optional mint
 */
export function generateDeploySh(config: RWAConfig): string {
  const networkFlag = getNetworkFlag(config);
  const adminAddress = getAdminAddress(config);
  const sections: string[] = [];

  sections.push('#!/bin/bash');
  sections.push('set -e');
  sections.push('');
  sections.push(`ADMIN="${adminAddress}"`);
  sections.push('');
  sections.push('echo "Deploying RWA token system..."');
  sections.push('');

  sections.push(`# 1. Deploy ${CRATE_NAMES.claimTopicsIssuers}`);
  sections.push(
    buildDeploySection(
      'CTI_ADDRESS',
      CRATE_NAMES.claimTopicsIssuers,
      `--admin "$ADMIN"`,
      networkFlag
    )
  );
  sections.push('');

  sections.push(`# 2. Deploy ${CRATE_NAMES.identityRegistryStorage}`);
  sections.push(
    buildDeploySection(
      'IRS_ADDRESS',
      CRATE_NAMES.identityRegistryStorage,
      `--admin "$ADMIN"`,
      networkFlag
    )
  );
  sections.push('');

  sections.push(`# 3. Deploy ${CRATE_NAMES.identityVerifier}`);
  sections.push(
    buildDeploySection(
      'IDENTITY_VERIFIER_ADDRESS',
      CRATE_NAMES.identityVerifier,
      `--admin "$ADMIN" --cti_address "$CTI_ADDRESS"`,
      networkFlag
    )
  );
  sections.push('');

  sections.push(`# 4. Deploy ${CRATE_NAMES.compliance}`);
  sections.push(
    buildDeploySection(
      'COMPLIANCE_ADDRESS',
      CRATE_NAMES.compliance,
      `--admin "$ADMIN"`,
      networkFlag
    )
  );
  sections.push('');

  if (config.compliance.modules.length > 0) {
    sections.push('# 5. Deploy compliance modules');
    for (const mod of config.compliance.modules) {
      const modVarName = `MODULE_${mod.moduleId.toUpperCase().replace(/-/g, '_')}_ADDRESS`;
      sections.push(buildDeploySection(modVarName, mod.moduleId, `--admin "$ADMIN"`, networkFlag));
    }
    sections.push('');
  }

  sections.push(
    `# ${config.compliance.modules.length > 0 ? '6' : '5'}. Deploy ${CRATE_NAMES.rwaTtoken}`
  );
  const tokenArgs = buildTokenConstructorArgs(config, adminAddress);
  sections.push(
    buildDeploySection('RWA_TOKEN_ADDRESS', CRATE_NAMES.rwaTtoken, tokenArgs, networkFlag)
  );
  sections.push('');

  sections.push(buildPostDeployConfig(config, networkFlag));
  sections.push('');
  sections.push('echo "Deployment complete!"');
  sections.push(`echo "RWA Token address: $RWA_TOKEN_ADDRESS"`);
  sections.push('');

  return sections.join('\n');
}

function buildTokenConstructorArgs(config: RWAConfig, adminAddress: string): string {
  const args: string[] = [];
  args.push(`--name "${config.token.name}"`);
  args.push(`--symbol "${config.token.symbol}"`);
  args.push(`--admin "${adminAddress}"`);
  args.push(`--initial_supply ${config.token.initialSupply ?? '0'}`);

  for (const role of config.accessControl.roles) {
    const symbol = role.symbol ?? role.name.toLowerCase();
    args.push(`--${symbol} "${role.addresses[0]}"`);
  }

  return args.join(' \\\n  ');
}
