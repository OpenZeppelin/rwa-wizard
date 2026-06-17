import { getAdminAddress } from '@openzeppelin/codegen-rwa-common';
import type { RWAConfig } from '@openzeppelin/rwa-config';

import { resolveStellarDeploymentTarget } from '../../deployment/target';
import { buildDeploymentSections } from './deploy-sh-deployments';
import { buildColorPreamble, shellEcho, shellEscape, shellSection } from './deploy-sh-helpers';
import { buildInitialSupplyGuidance, buildPostDeployConfig } from './deploy-sh-post-deploy';
import { buildDeploymentSummary } from './deploy-sh-summary';
import { getManagerDeploymentAddress } from './deploy-sh-token';

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
  const shellSafeDeploymentName = shellEscape(deployment.displayName);
  const adminAddress = getAdminAddress(config);
  const managerAddress = getManagerDeploymentAddress(config);
  const explorerUrlTemplate = deployment.explorerUrlTemplate;
  const sections: string[] = [];

  sections.push('#!/bin/bash');
  sections.push('set -e');
  sections.push('');
  sections.push(...buildColorPreamble());
  sections.push('');
  sections.push(`ADMIN="${shellEscape(adminAddress)}"`);
  sections.push(`MANAGER="${shellEscape(managerAddress)}"`);
  sections.push('SOURCE_ACCOUNT="${SOURCE_ACCOUNT:-${STELLAR_ACCOUNT:-}}"');
  sections.push('ADMIN_SOURCE_ACCOUNT="${ADMIN_SOURCE_ACCOUNT:-$SOURCE_ACCOUNT}"');
  sections.push('MANAGER_SOURCE_ACCOUNT="${MANAGER_SOURCE_ACCOUNT:-$SOURCE_ACCOUNT}"');
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
  sections.push('if [ "$ADMIN" != "$MANAGER" ]; then');
  sections.push(
    '  echo "Admin and Manager addresses differ — set ADMIN_SOURCE_ACCOUNT and MANAGER_SOURCE_ACCOUNT to Stellar CLI identities that control those addresses."'
  );
  sections.push(
    '  echo "Post-deploy invokes sign with the matching role account; deploy transactions still use SOURCE_ACCOUNT."'
  );
  sections.push('  echo ""');
  sections.push('fi');
  sections.push('');

  sections.push(
    ...shellSection(
      `Deploying ${shellEscape(config.token.name)} (${shellEscape(config.token.symbol)}) — RWA Token System`
    )
  );
  sections.push(shellEcho(`  Network:        ${shellSafeDeploymentName}`));
  sections.push(shellEcho('  Deploy Signer:  $SOURCE_ACCOUNT'));
  sections.push(shellEcho('  Admin:          $ADMIN'));
  sections.push(shellEcho('  Manager:        $MANAGER'));
  sections.push(shellEcho('  Admin Signer:   $ADMIN_SOURCE_ACCOUNT'));
  sections.push(shellEcho('  Manager Signer: $MANAGER_SOURCE_ACCOUNT'));
  sections.push('');
  const { deployedContracts, lines: deploymentSections } = buildDeploymentSections(
    config,
    networkFlag,
    explorerUrlTemplate
  );
  sections.push(...deploymentSections);

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
