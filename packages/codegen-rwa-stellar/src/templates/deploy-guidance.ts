import { getAdminAddress, getResolvedRoleAssignments } from '@openzeppelin/codegen-rwa-common';
import type { RWAConfig } from '@openzeppelin/rwa-config';

import { getManagerDeploymentAddress } from './scripts/deploy-sh-token';

import { generateRoleSymbol } from '../constants';
import { resolveStellarDeploymentTarget } from '../deployment/target';
import { getDemoMintComplianceWarningId } from './compliance-config-warnings';
import { isDemoAutoMintEligible } from './demo-auto-mint';
import {
  getDemoMintCompliancePreflightIssues,
  type DemoMintCompliancePreflightIssue,
} from './demo-mint-compliance-preflight';

const roleResolutionOptions = { generateRoleSymbol };

export type DemoMintComplianceIssueSummary = Pick<
  DemoMintCompliancePreflightIssue,
  'moduleName' | 'blocking' | 'autoFixable'
> & {
  /** Joined to `notice.compliance.selection-warning.*` in the wizard app. */
  warningId: string;
};

/** Structured deploy guidance shared by generated README, CLI, and wizard UI. */
export interface DeployGuidance {
  adminAddress: string;
  managerAddress: string;
  adminEqualsManager: boolean;
  networkDisplayName: string;
  networkIsTestnet: boolean;
  demoAutoMintEligible: boolean;
  demoMintComplianceIssues: DemoMintComplianceIssueSummary[];
}

/**
 * The signer-facing half of `DeployGuidance`: who deploys, and where.
 *
 * Separated from the demo-mint half because most callers want only this, and
 * the whole descriptor costs far more than it looks. Computing
 * `demoAutoMintEligible` and `demoMintComplianceIssues` reads
 * `token.initialSupply` and every selected module's config — so a caller that
 * wanted an admin address got those as dependencies too, and the README's
 * 78-line deploy section claimed an initial supply and a module's allow-list
 * that cannot move a line inside it. See
 * `docs/codegen-core/provenance/attribution-hazards.md` §3.
 */
export type DeploySignerGuidance = Pick<
  DeployGuidance,
  | 'adminAddress'
  | 'managerAddress'
  | 'adminEqualsManager'
  | 'networkDisplayName'
  | 'networkIsTestnet'
>;

/** Resolve deployment signer requirements, reading nothing about demo minting. */
export function getDeploySignerGuidance(config: RWAConfig): DeploySignerGuidance {
  const deployment = resolveStellarDeploymentTarget(config.deployment.target);
  const adminAddress = getAdminAddress(config);
  const managerAddress = getManagerDeploymentAddress(config);

  return {
    adminAddress,
    managerAddress,
    adminEqualsManager: adminAddress === managerAddress,
    networkDisplayName: deployment.displayName,
    networkIsTestnet: deployment.networkFlag.includes('testnet'),
  };
}

/** Resolve deployment signer requirements from the project config. */
export function getDeployGuidance(config: RWAConfig): DeployGuidance {
  return {
    ...getDeploySignerGuidance(config),
    demoAutoMintEligible: isDemoAutoMintEligible(config),
    demoMintComplianceIssues: isDemoAutoMintEligible(config)
      ? getDemoMintCompliancePreflightIssues(config).map(
          ({ moduleId, moduleName, blocking, autoFixable }) => ({
            warningId: getDemoMintComplianceWarningId(moduleId),
            moduleName,
            blocking,
            autoFixable,
          })
        )
      : [],
  };
}

/** Post-generation terminal steps for CLI and wizard success dialogs. */
export function formatDeployPostGenerationSteps(guidance: DeployGuidance): string[] {
  const identityHint = guidance.networkIsTestnet
    ? 'use an existing funded CLI identity whose address matches Admin, or regenerate the project in the wizard with `stellar keys address <your-identity>`'
    : 'use an existing CLI identity whose address matches Admin, or regenerate the project in the wizard with your address';

  const steps = [
    'Next steps after extracting the archive:',
    `1. Export a Stellar CLI identity that controls Admin (${guidance.adminAddress}): ${identityHint}`,
    '2. chmod +x scripts/build.sh scripts/deploy.sh',
    '3. ./scripts/build.sh && cargo fmt',
    '4. export STELLAR_ACCOUNT=<your-cli-identity>',
    '5. ./scripts/deploy.sh --preflight   # optional readiness check',
    '6. ./scripts/deploy.sh',
  ];

  if (guidance.demoAutoMintEligible) {
    steps.push(
      '7. chmod +x scripts/bootstrap-demo-mint.sh',
      '8. ./scripts/bootstrap-demo-mint.sh --preflight   # optional: verify compliance before onboarding',
      '9. ./scripts/bootstrap-demo-mint.sh               # demo onboarding + mint (run Manager fixes manually if preflight prints them)'
    );
  }

  return steps;
}

/** Short checklist items for wizard review step. */
export function formatDeployReadinessChecklist(
  _config: RWAConfig,
  guidance: DeployGuidance
): string[] {
  const fundStep = guidance.networkIsTestnet
    ? 'Fund a Stellar Testnet account for the deploy signer (`stellar keys generate <name> --fund`).'
    : 'Ensure the deploy signer account is funded on the target network.';

  const items = [
    'Install Rust, Stellar CLI, and the `wasm32v1-none` target (`rustup target add wasm32v1-none`).',
    fundStep,
    `Use a Stellar CLI identity that controls Admin \`${guidance.adminAddress}\`.`,
  ];

  if (!guidance.adminEqualsManager) {
    items.push(
      `When Admin and Manager differ, also set identities for Manager \`${guidance.managerAddress}\` via ADMIN_SOURCE_ACCOUNT / MANAGER_SOURCE_ACCOUNT.`
    );
  }

  items.push(
    'After download: run `./scripts/build.sh`, set `STELLAR_ACCOUNT`, then `./scripts/deploy.sh`.',
    'See README.md in the generated project for the full quick start and troubleshooting.'
  );

  return items;
}

/** Role rows for the configured access-control table in README. */
export function getConfiguredAccessControlRows(config: RWAConfig): Array<{
  role: string;
  address: string;
  deploySignerEnvVar: string;
  note?: string;
}> {
  // Signer half only: this table renders addresses, and reading the demo-mint
  // half here would make it depend on the initial supply and every module's
  // config, neither of which appears in a single row.
  const guidance = getDeploySignerGuidance(config);
  const rows: Array<{
    role: string;
    address: string;
    deploySignerEnvVar: string;
    note?: string;
  }> = [
    {
      role: 'Admin',
      address: guidance.adminAddress,
      deploySignerEnvVar: 'ADMIN_SOURCE_ACCOUNT (defaults to SOURCE_ACCOUNT)',
    },
    {
      role: 'Manager (deploy/post-deploy)',
      address: guidance.managerAddress,
      deploySignerEnvVar: 'MANAGER_SOURCE_ACCOUNT (defaults to SOURCE_ACCOUNT)',
      note:
        guidance.adminAddress === guidance.managerAddress
          ? 'Same as Admin in this project.'
          : 'First configured Manager address; post-deploy invokes sign with this role.',
    },
  ];

  for (const role of getResolvedRoleAssignments(config, roleResolutionOptions)) {
    if (role.symbol === 'manager' || role.name.toLowerCase() === 'manager') {
      if (role.addresses.length > 1) {
        rows.push({
          role: `${role.name} (additional)`,
          address: role.addresses.slice(1).join(', '),
          deploySignerEnvVar: '—',
          note: 'Wizard/config snapshot only — deploy grants the first Manager address; grant additional managers manually with grant_role.',
        });
      }
      continue;
    }

    rows.push({
      role: role.name,
      address: role.addresses.join(', '),
      deploySignerEnvVar: '—',
      note: 'Operational role assigned at deploy; configure signers separately for day-two ops.',
    });
  }

  const ownership = config.accessControl.ownership;
  if (ownership.type !== 'single-owner') {
    rows.unshift({
      role: `Owner (${ownership.type})`,
      address: ownership.address,
      deploySignerEnvVar: 'ADMIN_SOURCE_ACCOUNT (defaults to SOURCE_ACCOUNT)',
      note: 'Contract admin address baked into deploy.sh.',
    });
  }

  return rows;
}
