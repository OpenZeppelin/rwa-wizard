import {
  getAdditionalRoleAssignments,
  getAdminAddress,
  getManagerAddress,
} from '@openzeppelin/codegen-rwa-common';
import type { RWAConfig } from '@openzeppelin/rwa-config';

import { roleSymbolToRustIdentifier } from '../../access-control';
import { CRATE_NAMES, generateRoleSymbol } from '../../constants';
import { getModuleDescriptorById } from '../../modules/registry';

const roleResolutionOptions = { generateRoleSymbol };

/**
 * Build the correct Stellar CLI network flag for the configured deployment target.
 */
function getNetworkFlag(config: RWAConfig): string {
  const network = config.deployment.network;
  if (network === 'testnet' || network === 'mainnet') {
    return `--network ${network}`;
  }
  return `--rpc-url ${network}`;
}

/**
 * Build the raw `stellar contract deploy` command for a contract crate.
 */
function buildDeployCommand(
  crateName: string,
  constructorArgs: string,
  networkFlag: string
): string {
  return `stellar contract deploy \\
  --wasm target/wasm32v1-none/release/${crateName.replace(/-/g, '_')}.wasm \\
  ${networkFlag} \\
  -- \\
  ${constructorArgs}`;
}

/**
 * Build a shell section that deploys one contract and captures its address.
 */
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

/**
 * Build a shell-safe `stellar contract invoke` command.
 */
function buildInvokeCommand(
  contractAddr: string,
  fnName: string,
  args: string,
  networkFlag: string
): string {
  const commandLines = [
    'stellar contract invoke \\',
    `  --id ${contractAddr} \\`,
    `  ${networkFlag} \\`,
    '  -- \\',
    `  ${fnName}`,
  ];

  if (args.trim().length > 0) {
    commandLines[commandLines.length - 1] += ' \\';
    commandLines.push(`  ${args}`);
  }

  return commandLines.join('\n');
}

/**
 * Convert a module id into the shell variable name used in `deploy.sh`.
 */
function moduleVarName(moduleId: string): string {
  return `MODULE_${moduleId.toUpperCase().replace(/-/g, '_')}_ADDRESS`;
}

/**
 * Deduplicate module selections while preserving the first-seen order.
 */
function getUniqueModuleSelections(config: RWAConfig): RWAConfig['compliance']['modules'] {
  const byId = new Map<string, RWAConfig['compliance']['modules'][number]>();
  for (const selection of config.compliance.modules) {
    if (!byId.has(selection.moduleId)) {
      byId.set(selection.moduleId, selection);
    }
  }
  return [...byId.values()];
}

/**
 * Build the post-deploy configuration section for wiring and bootstrap data.
 */
function buildPostDeployConfig(config: RWAConfig, networkFlag: string): string {
  const lines: string[] = [];

  lines.push('# Post-deploy configuration');
  lines.push('echo "Starting post-deploy configuration..."');
  lines.push('');

  lines.push('# Bind token on Compliance and IRS');
  lines.push(
    buildInvokeCommand(
      '$COMPLIANCE_ADDRESS',
      'bind_token',
      '--token "$RWA_TOKEN_ADDRESS" --operator "$MANAGER"',
      networkFlag
    )
  );
  lines.push(
    buildInvokeCommand(
      '$IRS_ADDRESS',
      'bind_token',
      '--token "$RWA_TOKEN_ADDRESS" --operator "$MANAGER"',
      networkFlag
    )
  );

  const selectedModules = getUniqueModuleSelections(config);
  if (selectedModules.length > 0) {
    lines.push('');
    lines.push('# Configure and register compliance modules');
    for (const selection of selectedModules) {
      const descriptor = getModuleDescriptorById(selection.moduleId);
      if (!descriptor) continue;

      // Keep module lifecycle details on the descriptor so adding a new module
      // does not require reviving cross-file switch logic in deploy generation.
      const modVar = `$${moduleVarName(selection.moduleId)}`;
      lines.push('');
      lines.push(`# -- ${descriptor.name} setup --`);

      if (descriptor.deployment.requiresIdentityRegistryStorage) {
        lines.push(
          buildInvokeCommand(
            modVar,
            'set_identity_registry_storage',
            '--token "$RWA_TOKEN_ADDRESS" --irs "$IRS_ADDRESS"',
            networkFlag
          )
        );
      }

      for (const invocation of descriptor.deployment.getConfigurationInvocations(selection)) {
        lines.push(
          buildInvokeCommand(modVar, invocation.functionName, invocation.args, networkFlag)
        );
      }

      lines.push(
        buildInvokeCommand(
          modVar,
          'set_compliance_address',
          '--compliance "$COMPLIANCE_ADDRESS"',
          networkFlag
        )
      );

      for (const hook of descriptor.requiredHooks) {
        lines.push(
          buildInvokeCommand(
            '$COMPLIANCE_ADDRESS',
            'add_module_to',
            `--hook "${hook}" --module "${modVar}" --operator "$MANAGER"`,
            networkFlag
          )
        );
      }

      lines.push(buildInvokeCommand(modVar, 'verify_hook_wiring', '', networkFlag));
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
          `--claim_topic ${topic.id} --operator "$MANAGER"`,
          networkFlag
        )
      );
    }
  }

  if (config.identityVerification.trustedIssuers.length > 0) {
    lines.push('');
    lines.push('# Add trusted issuers');
    for (const issuer of config.identityVerification.trustedIssuers) {
      const topicsArg = `'[${issuer.claimTopics.map(String).join(', ')}]'`;
      lines.push(
        buildInvokeCommand(
          '$CTI_ADDRESS',
          'add_trusted_issuer',
          `--trusted_issuer "${issuer.address}" --claim_topics ${topicsArg} --operator "$MANAGER"`,
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
        `--to "$ADMIN" --amount ${config.token.initialSupply} --operator "$MANAGER"`,
        networkFlag
      )
    );
  }

  return lines.join('\n');
}

/**
 * Generates `deploy.sh` — a shell script that deploys and configures all
 * contracts in the correct dependency order.
 *
 * Deployment order: CTI -> IRS -> Identity Verifier -> Compliance -> Modules -> RWA Token
 * Post-deploy: bind token -> configure modules -> register hooks -> add claim topics -> add trusted issuers -> optional mint
 */
export function generateDeploySh(config: RWAConfig): string {
  const networkFlag = getNetworkFlag(config);
  const adminAddress = getAdminAddress(config);
  const managerAddress = getManagerAddress(config, roleResolutionOptions);
  const sections: string[] = [];

  sections.push('#!/bin/bash');
  sections.push('set -e');
  sections.push('');
  sections.push(`ADMIN="${adminAddress}"`);
  sections.push(`MANAGER="${managerAddress}"`);
  sections.push('');
  sections.push('echo "Deploying RWA token system..."');
  sections.push('');

  sections.push(`# 1. Deploy ${CRATE_NAMES.claimTopicsIssuers}`);
  sections.push(
    buildDeploySection(
      'CTI_ADDRESS',
      CRATE_NAMES.claimTopicsIssuers,
      '--admin "$ADMIN" --manager "$MANAGER"',
      networkFlag
    )
  );
  sections.push('');

  sections.push(`# 2. Deploy ${CRATE_NAMES.identityRegistryStorage}`);
  sections.push(
    buildDeploySection(
      'IRS_ADDRESS',
      CRATE_NAMES.identityRegistryStorage,
      '--admin "$ADMIN" --manager "$MANAGER"',
      networkFlag
    )
  );
  sections.push('');

  sections.push(`# 3. Deploy ${CRATE_NAMES.identityVerifier}`);
  sections.push(
    buildDeploySection(
      'IDENTITY_VERIFIER_ADDRESS',
      CRATE_NAMES.identityVerifier,
      '--admin "$ADMIN" --manager "$MANAGER" --identity_registry_storage "$IRS_ADDRESS" --claim_topics_and_issuers "$CTI_ADDRESS"',
      networkFlag
    )
  );
  sections.push('');

  sections.push(`# 4. Deploy ${CRATE_NAMES.compliance}`);
  sections.push(
    buildDeploySection(
      'COMPLIANCE_ADDRESS',
      CRATE_NAMES.compliance,
      '--admin "$ADMIN" --manager "$MANAGER"',
      networkFlag
    )
  );
  sections.push('');

  const selectedModules = getUniqueModuleSelections(config);
  if (selectedModules.length > 0) {
    sections.push('# 5. Deploy compliance modules');
    for (const selection of selectedModules) {
      const descriptor = getModuleDescriptorById(selection.moduleId);
      if (!descriptor) continue;
      sections.push(
        buildDeploySection(
          moduleVarName(selection.moduleId),
          descriptor.crateName,
          '--admin "$ADMIN"',
          networkFlag
        )
      );
    }
    sections.push('');
  }

  sections.push(`# ${selectedModules.length > 0 ? '6' : '5'}. Deploy ${CRATE_NAMES.rwaTtoken}`);
  const tokenArgs = buildTokenConstructorArgs(config);
  sections.push(
    buildDeploySection('RWA_TOKEN_ADDRESS', CRATE_NAMES.rwaTtoken, tokenArgs, networkFlag)
  );
  sections.push('');

  sections.push(buildPostDeployConfig(config, networkFlag));
  sections.push('');
  sections.push('echo "Deployment complete!"');
  sections.push('echo "RWA Token address: $RWA_TOKEN_ADDRESS"');
  sections.push('');

  return sections.join('\n');
}

/**
 * Build the RWA token constructor argument list for `deploy.sh`.
 */
function buildTokenConstructorArgs(config: RWAConfig): string {
  const args: string[] = [];
  args.push(`--name "${config.token.name}"`);
  args.push(`--symbol "${config.token.symbol}"`);
  args.push('--admin "$ADMIN"');
  args.push('--manager "$MANAGER"');
  args.push('--compliance "$COMPLIANCE_ADDRESS"');
  args.push('--identity_verifier "$IDENTITY_VERIFIER_ADDRESS"');

  for (const role of getAdditionalRoleAssignments(config, roleResolutionOptions)) {
    args.push(`--${roleSymbolToRustIdentifier(role.symbol)} "${role.address}"`);
  }

  return args.join(' \\\n  ');
}
