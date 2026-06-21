import { getUniqueModuleSelections } from '@openzeppelin/codegen-rwa-common';
import type { RWAConfig } from '@openzeppelin/rwa-config';

import { serializeStellarComplianceHookForCli } from '../../ecosystem-metadata';
import { getModuleDescriptorById } from '../../modules/registry';
import {
  buildInvokeCommand,
  CLR,
  moduleVarName,
  shellEcho,
  shellEscape,
  shellSection,
  shellSubsection,
} from './deploy-sh-helpers';

/**
 * Build the post-deploy configuration section for wiring and bootstrap data.
 */
export function buildPostDeployConfig(config: RWAConfig, networkFlag: string): string {
  const lines: string[] = [];

  lines.push(...shellSubsection('Token Binding'));
  lines.push('echo ""');
  lines.push(shellEcho(`${CLR.bold}  Binding token on Compliance and IRS...${CLR.rst}`));
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
  lines.push(shellEcho(`${CLR.green}  ✓ Token bound to Compliance and IRS${CLR.rst}`));

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
      const shellSafeDescriptorName = shellEscape(descriptor.name);
      lines.push('echo ""');
      lines.push(shellEcho(`${CLR.bold}  Configuring ${shellSafeDescriptorName}...${CLR.rst}`));

      if (descriptor.deployment.requiresIdentityRegistryStorage) {
        lines.push(
          buildInvokeCommand(
            modVar,
            'set_identity_registry_storage',
            '--token "$RWA_TOKEN_ADDRESS" --irs "$IRS_ADDRESS" --operator "$MANAGER"',
            networkFlag
          )
        );
      }

      for (const invocation of descriptor.deployment.getConfigurationInvocations(selection)) {
        lines.push(
          buildInvokeCommand(
            modVar,
            invocation.functionName,
            invocation.args,
            networkFlag,
            'manager'
          )
        );
      }

      lines.push(
        buildInvokeCommand(
          modVar,
          'set_compliance_address',
          '--token "$RWA_TOKEN_ADDRESS" --compliance "$COMPLIANCE_ADDRESS" --operator "$ADMIN"',
          networkFlag,
          'admin'
        )
      );

      for (const hook of descriptor.requiredHooks) {
        lines.push(
          buildInvokeCommand(
            '$COMPLIANCE_ADDRESS',
            'add_module_to',
            `--hook "${serializeStellarComplianceHookForCli(hook)}" --module "${modVar}" --operator "$MANAGER"`,
            networkFlag,
            'manager'
          )
        );
      }

      for (const invocation of descriptor.deployment.getPostRegistrationInvocations?.(selection) ??
        []) {
        lines.push(
          buildInvokeCommand(
            modVar,
            invocation.functionName,
            invocation.args,
            networkFlag,
            'manager'
          )
        );
      }

      lines.push(
        shellEcho(
          `${CLR.green}  ✓ ${shellSafeDescriptorName} registered on hooks: ${descriptor.requiredHooks.map(serializeStellarComplianceHookForCli).join(', ')}${CLR.rst}`
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
      lines.push(
        shellEcho(`${CLR.green}  ✓ Claim topic ${topic.id} (${shellEscape(topic.name)})${CLR.rst}`)
      );
    }
  }

  if (config.identityVerification.trustedIssuers.length > 0) {
    lines.push(
      ...shellSubsection(`Trusted Issuers (${config.identityVerification.trustedIssuers.length})`)
    );
    for (const issuer of config.identityVerification.trustedIssuers) {
      const topicsArg = `'[${issuer.claimTopics.map(String).join(', ')}]'`;
      const shellSafeIssuerAddress = shellEscape(issuer.address);
      const issuerPreview = shellEscape(issuer.address.slice(0, 8));
      lines.push(
        buildInvokeCommand(
          '$CTI_ADDRESS',
          'add_trusted_issuer',
          `--trusted_issuer "${shellSafeIssuerAddress}" --claim_topics ${topicsArg} --operator "$MANAGER"`,
          networkFlag
        )
      );
      lines.push(
        shellEcho(
          `${CLR.green}  ✓ Issuer ${issuerPreview}... → topics [${issuer.claimTopics.join(', ')}]${CLR.rst}`
        )
      );
    }
  }

  return lines.join('\n');
}

export interface DeployScriptGenerationOptions {
  includeIdentitySupport?: boolean;
  includeDemoAutoMint?: boolean;
}

export function buildInitialSupplyGuidance(
  config: RWAConfig,
  options?: DeployScriptGenerationOptions
): string[] {
  if (config.token.initialSupply === undefined) return [];

  if (options?.includeDemoAutoMint) {
    return [
      ...shellSection('Initial Supply — Demo Auto-Mint Script Included'),
      shellEcho('  Status:    deploy.sh does not auto-mint (identity verification required).'),
      shellEcho(`  Requested: ${config.token.initialSupply} base units (from config)`),
      shellEcho(
        `  Decimals:  ${config.token.decimals} (1 whole token = 10^${config.token.decimals} base units)`
      ),
      shellEcho(''),
      shellEcho('  This testnet export includes scripts/bootstrap-demo-mint.sh — a demo-only'),
      shellEcho('  educational script (NOT production KYC) that will:'),
      shellEcho('    1. Deploy the example Claim Issuer and register it in CTI'),
      shellEcho('    2. Deploy an Identity contract for Admin and sign demo claims'),
      shellEcho('    3. Register Admin in IRS'),
      shellEcho('    4. Run compliance preflight on the `created` hook (see script output)'),
      shellEcho(`    5. Mint ${config.token.initialSupply} base units to Admin`),
      shellEcho(''),
      shellEcho('  After ./scripts/deploy.sh completes:'),
      shellEcho('    chmod +x scripts/bootstrap-demo-mint.sh'),
      shellEcho('    ./scripts/bootstrap-demo-mint.sh --preflight   # optional compliance check'),
      shellEcho(
        '    ./scripts/bootstrap-demo-mint.sh               # full demo flow (run printed Manager invokes first if needed)'
      ),
    ];
  }

  const identityScaffoldLines = options?.includeIdentitySupport
    ? [
        shellEcho('  This export includes example claim-issuer and identity crates (see README),'),
        shellEcho('  but deploy.sh does not deploy or wire them automatically.'),
      ]
    : [
        shellEcho('  The current generator does not scaffold claim-issuer or per-holder'),
        shellEcho('  identity contracts.'),
      ];

  return [
    ...shellSection('Initial Supply — Manual Mint Required'),
    shellEcho('  Status:    Skipping automatic initial supply mint.'),
    shellEcho(`  Requested: ${config.token.initialSupply} base units (from config)`),
    shellEcho(
      `  Decimals:  ${config.token.decimals} (1 whole token = 10^${config.token.decimals} base units)`
    ),
    shellEcho(''),
    shellEcho('  Why: Stellar identity verification requires each mint recipient to have'),
    shellEcho('  a verified identity contract with valid claims registered in IRS/CTI.'),
    ...identityScaffoldLines,
    shellEcho('  The mint amount must use on-chain base units, not display units.'),
    shellEcho(''),
    shellEcho('  Next steps:'),
    shellEcho('    1. Deploy a Claim Issuer contract for your trusted issuer(s)'),
    shellEcho('    2. Deploy a per-holder Identity contract for each mint recipient'),
    shellEcho('    3. Register holder identities and country data in IRS'),
    shellEcho('    4. Issue required claims from the trusted issuer'),
    shellEcho('    5. Mint using:'),
    shellEcho(`       stellar contract invoke --id \\$RWA_TOKEN_ADDRESS -- mint \\\\`),
    shellEcho(`         --to <RECIPIENT> --amount ${config.token.initialSupply}  # base units`),
  ];
}
