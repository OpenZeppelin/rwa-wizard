import {
  getAdditionalRoleAssignments,
  getAdminAddress,
  getManagerAddress,
  getUniqueModuleSelections,
} from '@openzeppelin/codegen-rwa-common';
import type { RWAConfig } from '@openzeppelin/rwa-config';

import { roleSymbolToRustIdentifier } from '../../access-control';
import { CRATE_NAMES, generateRoleSymbol } from '../../constants';
import { resolveStellarDeploymentTarget } from '../../deployment/target';
import { serializeStellarComplianceHookForCli } from '../../ecosystem-metadata';
import { getModuleDescriptorById } from '../../modules/registry';

const roleResolutionOptions = { generateRoleSymbol };

// ---------------------------------------------------------------------------
// Shell output helpers — visual structure for deploy.sh terminal output
// ---------------------------------------------------------------------------

const SEPARATOR = '═══════════════════════════════════════════════════════════════';
const THIN_SEPARATOR = '───────────────────────────────────────────────────────────────';

function shellEcho(msg: string): string {
  return `echo "${msg}"`;
}

function shellEchoRaw(msg: string): string {
  return `echo '${msg}'`;
}

function shellSection(title: string): string[] {
  return [
    `echo ""`,
    shellEcho(SEPARATOR),
    shellEcho(`  ${title}`),
    shellEcho(SEPARATOR),
    `echo ""`,
  ];
}

function shellSubsection(title: string): string[] {
  return [`echo ""`, shellEcho(THIN_SEPARATOR), shellEcho(`  ${title}`), shellEcho(THIN_SEPARATOR)];
}

function buildExplorerLine(explorerUrlTemplate: string | undefined, varName: string): string {
  if (!explorerUrlTemplate) return '';
  return shellEcho(
    `  Explorer: ${explorerUrlTemplate.replace('__CONTRACT_ADDRESS__', `\${${varName}}`)}`
  );
}

// ---------------------------------------------------------------------------
// Shell command builders
// ---------------------------------------------------------------------------

/**
 * Build the raw `stellar contract deploy` command for a contract crate.
 */
function buildDeployCommand(
  crateName: string,
  constructorArgs: string,
  networkFlag: string
): string {
  return `stellar contract deploy \\
  --source-account "$SOURCE_ACCOUNT" \\
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
  displayName: string,
  crateName: string,
  constructorArgs: string,
  networkFlag: string,
  explorerUrlTemplate: string | undefined
): string {
  const lines: string[] = [];

  lines.push(shellEcho(`  Deploying ${displayName}...`));
  lines.push(`${varName}=$(${buildDeployCommand(crateName, constructorArgs, networkFlag)})`);
  lines.push(`if [ $? -ne 0 ] || [ -z "$${varName}" ]; then`);
  lines.push(`  echo "  ✗ Failed to deploy ${displayName} (${crateName})"`);
  lines.push('  exit 1');
  lines.push('fi');
  lines.push(shellEcho(`  ✓ ${displayName}: \${${varName}}`));
  const explorerLine = buildExplorerLine(explorerUrlTemplate, varName);
  if (explorerLine) {
    lines.push(explorerLine);
  }

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
    '  --source-account "$SOURCE_ACCOUNT" \\',
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

// ---------------------------------------------------------------------------
// Module / config helpers
// ---------------------------------------------------------------------------

/**
 * Convert a module id into the shell variable name used in `deploy.sh`.
 */
function moduleVarName(moduleId: string): string {
  return `MODULE_${moduleId.toUpperCase().replace(/-/g, '_')}_ADDRESS`;
}

// ---------------------------------------------------------------------------
// Post-deploy configuration
// ---------------------------------------------------------------------------

/**
 * Build the post-deploy configuration section for wiring and bootstrap data.
 */
function buildPostDeployConfig(config: RWAConfig, networkFlag: string): string {
  const lines: string[] = [];

  lines.push(...shellSubsection('Token Binding'));
  lines.push(shellEcho('  Binding token on Compliance and IRS...'));
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
  lines.push(shellEcho('  ✓ Token bound to Compliance and IRS'));

  const selectedModules = getUniqueModuleSelections(config.compliance.modules);
  if (selectedModules.length > 0) {
    lines.push(
      ...shellSubsection(
        `Compliance Module Wiring (${selectedModules.length} module${selectedModules.length > 1 ? 's' : ''})`
      )
    );
    for (const selection of selectedModules) {
      const descriptor = getModuleDescriptorById(selection.moduleId);
      if (!descriptor) continue;

      const modVar = `$${moduleVarName(selection.moduleId)}`;
      lines.push('');
      lines.push(shellEcho(`  Configuring ${descriptor.name}...`));

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
            `--hook "${serializeStellarComplianceHookForCli(hook)}" --module "${modVar}" --operator "$MANAGER"`,
            networkFlag
          )
        );
      }

      for (const invocation of descriptor.deployment.getPostRegistrationInvocations?.(selection) ??
        []) {
        lines.push(
          buildInvokeCommand(modVar, invocation.functionName, invocation.args, networkFlag)
        );
      }

      lines.push(
        shellEcho(
          `  ✓ ${descriptor.name} registered on hooks: ${descriptor.requiredHooks.map(serializeStellarComplianceHookForCli).join(', ')}`
        )
      );
    }
  }

  if (config.identityVerification.claimTopics.length > 0) {
    lines.push(
      ...shellSubsection(`Claim Topics (${config.identityVerification.claimTopics.length})`)
    );
    for (const topic of config.identityVerification.claimTopics) {
      lines.push(
        buildInvokeCommand(
          '$CTI_ADDRESS',
          'add_claim_topic',
          `--claim_topic ${topic.id} --operator "$MANAGER"`,
          networkFlag
        )
      );
      lines.push(shellEcho(`  ✓ Claim topic ${topic.id} (${topic.name})`));
    }
  }

  if (config.identityVerification.trustedIssuers.length > 0) {
    lines.push(
      ...shellSubsection(`Trusted Issuers (${config.identityVerification.trustedIssuers.length})`)
    );
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
      lines.push(
        shellEcho(
          `  ✓ Issuer ${issuer.address.slice(0, 8)}... → topics [${issuer.claimTopics.join(', ')}]`
        )
      );
    }
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Initial supply guidance
// ---------------------------------------------------------------------------

function buildInitialSupplyGuidance(config: RWAConfig): string[] {
  if (config.token.initialSupply === undefined) return [];

  return [
    ...shellSection('Initial Supply — Manual Mint Required'),
    shellEcho('  Status:    Skipping automatic initial supply mint.'),
    shellEcho(`  Requested: ${config.token.initialSupply} (from config)`),
    shellEcho(''),
    shellEcho('  Why: Stellar identity verification requires each mint recipient to have'),
    shellEcho('  a verified identity contract with valid claims registered in IRS/CTI.'),
    shellEcho('  The current generator does not scaffold claim-issuer or per-holder'),
    shellEcho('  identity contracts.'),
    shellEcho(''),
    shellEcho('  Next steps:'),
    shellEcho('    1. Deploy a Claim Issuer contract for your trusted issuer(s)'),
    shellEcho('    2. Deploy a per-holder Identity contract for each mint recipient'),
    shellEcho('    3. Register holder identities and country data in IRS'),
    shellEcho('    4. Issue required claims from the trusted issuer'),
    shellEcho('    5. Mint using:'),
    shellEcho(`       stellar contract invoke --id \\$RWA_TOKEN_ADDRESS -- mint \\\\`),
    shellEcho(`         --to <RECIPIENT> --amount ${config.token.initialSupply}`),
  ];
}

// ---------------------------------------------------------------------------
// Deployment summary
// ---------------------------------------------------------------------------

interface DeployedContract {
  name: string;
  varName: string;
}

function buildDeploymentSummary(
  contracts: DeployedContract[],
  config: RWAConfig,
  explorerUrlTemplate: string | undefined
): string[] {
  const lines: string[] = [];
  const deployment = resolveStellarDeploymentTarget(config.deployment.target);

  lines.push(
    ...shellSection(`Deployment Complete — ${config.token.name} (${config.token.symbol})`)
  );

  lines.push(shellEcho('  Network:  ' + deployment.displayName));
  lines.push(shellEcho('  Admin:    $ADMIN'));
  lines.push(shellEcho('  Signer:   $SOURCE_ACCOUNT'));
  lines.push(`echo ""`);

  lines.push(shellEcho(THIN_SEPARATOR));
  lines.push(shellEchoRaw('  Contract                       Address'));
  lines.push(shellEcho(THIN_SEPARATOR));

  for (const c of contracts) {
    const paddedName = c.name.padEnd(30);
    lines.push(shellEcho(`  ${paddedName} \${${c.varName}}`));
  }

  lines.push(shellEcho(THIN_SEPARATOR));

  if (explorerUrlTemplate) {
    lines.push(`echo ""`);
    lines.push(shellEcho('  Contract Explorer Links:'));
    for (const c of contracts) {
      lines.push(shellEcho(`    ${c.name}:`));
      lines.push(
        shellEcho(
          `      ${explorerUrlTemplate.replace('__CONTRACT_ADDRESS__', `\${${c.varName}}`)}`
        )
      );
    }
  }

  return lines;
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

/**
 * Generates `deploy.sh` — a shell script that deploys and configures all
 * contracts in the correct dependency order.
 *
 * Deployment order: CTI -> IRS -> Identity Verifier -> Compliance -> Modules -> RWA Token
 * Post-deploy: bind token -> configure modules -> register hooks -> add claim topics -> add trusted issuers -> initial-supply guidance
 */
export function generateDeploySh(config: RWAConfig): string {
  const deployment = resolveStellarDeploymentTarget(config.deployment.target);
  const networkFlag = deployment.networkFlag;
  const adminAddress = getAdminAddress(config);
  const managerAddress = getManagerAddress(config, roleResolutionOptions);
  const explorerUrlTemplate = deployment.explorerUrlTemplate;
  const sections: string[] = [];

  sections.push('#!/bin/bash');
  sections.push('set -e');
  sections.push('');
  sections.push(`ADMIN="${adminAddress}"`);
  sections.push(`MANAGER="${managerAddress}"`);
  sections.push('SOURCE_ACCOUNT="${SOURCE_ACCOUNT:-${STELLAR_ACCOUNT:-}}"');
  sections.push('');
  sections.push('if [ -z "$SOURCE_ACCOUNT" ]; then');
  sections.push('  echo "Missing Stellar source account."');
  sections.push(
    '  echo "Set SOURCE_ACCOUNT or STELLAR_ACCOUNT to a signable Stellar CLI identity before running deploy.sh."'
  );
  sections.push('  echo "Example: export STELLAR_ACCOUNT=alice"');
  sections.push('  exit 1');
  sections.push('fi');
  sections.push('');

  sections.push(
    ...shellSection(`Deploying ${config.token.name} (${config.token.symbol}) — RWA Token System`)
  );
  sections.push(shellEcho(`  Network:        ${deployment.displayName}`));
  sections.push(shellEcho('  Source Account: $SOURCE_ACCOUNT'));
  sections.push(shellEcho('  Admin:          $ADMIN'));
  sections.push('');

  const deployedContracts: DeployedContract[] = [];

  sections.push(...shellSubsection('Core Contracts'));
  sections.push('');

  sections.push(`# 1. Deploy ${CRATE_NAMES.claimTopicsIssuers}`);
  sections.push(
    buildDeploySection(
      'CTI_ADDRESS',
      'Claim Topics & Issuers',
      CRATE_NAMES.claimTopicsIssuers,
      '--admin "$ADMIN" --manager "$MANAGER"',
      networkFlag,
      explorerUrlTemplate
    )
  );
  deployedContracts.push({ name: 'Claim Topics & Issuers', varName: 'CTI_ADDRESS' });
  sections.push('');

  sections.push(`# 2. Deploy ${CRATE_NAMES.identityRegistryStorage}`);
  sections.push(
    buildDeploySection(
      'IRS_ADDRESS',
      'Identity Registry Storage',
      CRATE_NAMES.identityRegistryStorage,
      '--admin "$ADMIN" --manager "$MANAGER"',
      networkFlag,
      explorerUrlTemplate
    )
  );
  deployedContracts.push({ name: 'Identity Registry Storage', varName: 'IRS_ADDRESS' });
  sections.push('');

  sections.push(`# 3. Deploy ${CRATE_NAMES.identityVerifier}`);
  sections.push(
    buildDeploySection(
      'IDENTITY_VERIFIER_ADDRESS',
      'Identity Verifier',
      CRATE_NAMES.identityVerifier,
      '--admin "$ADMIN" --manager "$MANAGER" --identity_registry_storage "$IRS_ADDRESS" --claim_topics_and_issuers "$CTI_ADDRESS"',
      networkFlag,
      explorerUrlTemplate
    )
  );
  deployedContracts.push({ name: 'Identity Verifier', varName: 'IDENTITY_VERIFIER_ADDRESS' });
  sections.push('');

  sections.push(`# 4. Deploy ${CRATE_NAMES.compliance}`);
  sections.push(
    buildDeploySection(
      'COMPLIANCE_ADDRESS',
      'Compliance',
      CRATE_NAMES.compliance,
      '--admin "$ADMIN" --manager "$MANAGER"',
      networkFlag,
      explorerUrlTemplate
    )
  );
  deployedContracts.push({ name: 'Compliance', varName: 'COMPLIANCE_ADDRESS' });
  sections.push('');

  const selectedModules = getUniqueModuleSelections(config.compliance.modules);
  if (selectedModules.length > 0) {
    sections.push(...shellSubsection(`Compliance Modules (${selectedModules.length})`));
    sections.push('');
    for (const selection of selectedModules) {
      const descriptor = getModuleDescriptorById(selection.moduleId);
      if (!descriptor) continue;
      const varName = moduleVarName(selection.moduleId);
      sections.push(
        buildDeploySection(
          varName,
          descriptor.name,
          descriptor.crateName,
          '--admin "$ADMIN"',
          networkFlag,
          explorerUrlTemplate
        )
      );
      deployedContracts.push({ name: descriptor.name, varName });
    }
    sections.push('');
  }

  sections.push(...shellSubsection('RWA Token'));
  sections.push('');
  const tokenArgs = buildTokenConstructorArgs(config);
  sections.push(
    buildDeploySection(
      'RWA_TOKEN_ADDRESS',
      `${config.token.symbol} Token`,
      CRATE_NAMES.rwaTtoken,
      tokenArgs,
      networkFlag,
      explorerUrlTemplate
    )
  );
  deployedContracts.push({ name: `${config.token.symbol} Token`, varName: 'RWA_TOKEN_ADDRESS' });
  sections.push('');

  sections.push(...shellSection('Post-Deploy Configuration'));
  sections.push(buildPostDeployConfig(config, networkFlag));
  sections.push('');

  const supplyGuidance = buildInitialSupplyGuidance(config);
  if (supplyGuidance.length > 0) {
    sections.push(...supplyGuidance);
    sections.push('');
  }

  sections.push(...buildDeploymentSummary(deployedContracts, config, explorerUrlTemplate));
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
