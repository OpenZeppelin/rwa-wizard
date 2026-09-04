import type { ConfigPath, LineBuilder, ProvenanceScope } from '@openzeppelin/codegen-core';
import { createLineBuilder } from '@openzeppelin/codegen-core';
import {
  getAdminAddress,
  selectedClaimTopicIds,
  selectedClaimTopicIndices,
} from '@openzeppelin/codegen-rwa-common';
import type { RWAConfig } from '@openzeppelin/rwa-config';

import { resolveStellarDeploymentTarget } from '../../deployment/target';
import { renderDetached } from '../contracts/detached-scope';
import { withoutRolesListRoot } from '../contracts/rwa-token-roles';
import {
  buildCoreDeploymentPlan,
  buildModuleDeploymentDescriptors,
  buildTokenDeploymentDescriptor,
  deployedContractsOf,
  emitDeploymentSections,
  getDeploymentCrateNames,
} from './deploy-sh-deployments';
import {
  buildColorPreamble,
  buildRoleSignerPreflightChecks,
  emitDisplay,
  emitEcho,
  emitSection,
  shellEcho,
  shellEscape,
  shellSection,
} from './deploy-sh-helpers';
import {
  buildInitialSupplyGuidance,
  emitPostDeployConfig,
  type DeployScriptGenerationOptions,
} from './deploy-sh-post-deploy';
import {
  buildArgumentParsing,
  buildDeploymentManifestWrite,
  buildPreflightExit,
  buildWasmPreflightCheck,
} from './deploy-sh-preflight';
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
 *
 * Supports `./scripts/deploy.sh --preflight` to validate signers and WASM artifacts without deploying.
 */
export const DEPLOY_SCRIPT_PATH = 'scripts/deploy.sh';

interface ObservedModule {
  readonly moduleId: string;
  /** Index of the FIRST occurrence — the one `getUniqueModuleSelections` keeps. */
  readonly firstIndex: number;
  /** Every occurrence path for this id, so duplicates union rather than duplicate. */
  readonly paths: readonly ConfigPath[];
}

/**
 * The selected modules, observed one occurrence at a time.
 *
 * Observing the module list as a whole would give every module section the union
 * of every module's paths, so ticking one module would highlight its siblings'
 * deploy commands (INV-19, INV-34). Duplicate selections of one id union their
 * indices, matching the single crate the generator emits.
 */
function observeSelectedModules(builder: LineBuilder<RWAConfig>): readonly ObservedModule[] {
  const moduleCount = builder.observe((config) => config.compliance.modules.length).value;
  const byId = new Map<string, { firstIndex: number; paths: ConfigPath[] }>();

  for (let index = 0; index < moduleCount; index += 1) {
    const occurrence = builder.observe((config) => config.compliance.modules[index]?.moduleId);
    const moduleId = occurrence.value;
    if (moduleId === undefined) continue;

    const existing = byId.get(moduleId);
    if (existing === undefined) {
      byId.set(moduleId, { firstIndex: index, paths: [...occurrence.paths] });
    } else {
      existing.paths.push(...occurrence.paths);
    }
  }

  return [...byId.entries()].map(([moduleId, entry]) => ({ moduleId, ...entry }));
}

export function generateDeployShInScope(
  scope: ProvenanceScope<RWAConfig>,
  options?: DeployScriptGenerationOptions
): string {
  // INV-17: the builder is created BEFORE the seven bindings this script used to
  // hoist, so none of their reads can drain onto the shebang. The separator is
  // passed explicitly rather than relying on the default matching by luck.
  const builder = createLineBuilder(scope, { separator: '\n' });

  // INV-24: each hoisted value is observed once and its paths travel to every
  // emission that uses it — `deployment` covers the network flag, display name
  // and explorer template, which are derived from it and read no further config.
  const deployment = builder.observe((config) =>
    resolveStellarDeploymentTarget(config.deployment.target)
  );
  const adminAddress = builder.observe((config) => getAdminAddress(config));
  const managerAddress = withoutRolesListRoot(
    builder.observe((config) => getManagerDeploymentAddress(config))
  );
  const wasmCrateNames = builder.observe((config) => getDeploymentCrateNames(config));

  const networkFlag = deployment.value.networkFlag;
  const shellSafeDeploymentName = shellEscape(deployment.value.displayName);
  const explorerUrlTemplate = deployment.value.explorerUrlTemplate;

  // --- family 1: preamble and account variables ---------------------------
  builder.line('#!/bin/bash');
  builder.line('set -e');
  builder.line('');
  builder.lines(buildColorPreamble());
  builder.line('');
  builder.lines(buildArgumentParsing());
  builder.line('');
  builder.line(`ADMIN="${shellEscape(adminAddress.value)}"`, adminAddress.paths);
  builder.line(`MANAGER="${shellEscape(managerAddress.value)}"`, managerAddress.paths);
  builder.line('SOURCE_ACCOUNT="${SOURCE_ACCOUNT:-${STELLAR_ACCOUNT:-}}"');
  builder.line('ADMIN_SOURCE_ACCOUNT="${ADMIN_SOURCE_ACCOUNT:-$SOURCE_ACCOUNT}"');
  builder.line('MANAGER_SOURCE_ACCOUNT="${MANAGER_SOURCE_ACCOUNT:-$SOURCE_ACCOUNT}"');
  builder.line('');
  builder.line('if [ -z "$SOURCE_ACCOUNT" ]; then');
  builder.line('  echo "Missing Stellar source account."');
  builder.line(
    '  echo "Set SOURCE_ACCOUNT or STELLAR_ACCOUNT to a Stellar CLI identity that controls the configured Admin/Manager addresses."'
  );
  emitDisplay(
    builder,
    [`  echo "Example: export STELLAR_ACCOUNT=<identity-for-${shellEscape(adminAddress.value)}>"`],
    adminAddress.paths
  );
  builder.line('  exit 1');
  builder.line('fi');
  builder.line('');
  builder.line('if [ "$ADMIN" != "$MANAGER" ]; then');
  builder.line(
    '  echo "Admin and Manager addresses differ — set ADMIN_SOURCE_ACCOUNT and MANAGER_SOURCE_ACCOUNT to Stellar CLI identities that control those addresses."'
  );
  builder.line(
    '  echo "Post-deploy invokes sign with the matching role account; deploy transactions still use SOURCE_ACCOUNT."'
  );
  builder.line('  echo ""');
  builder.line('fi');
  builder.lines(buildRoleSignerPreflightChecks());
  builder.line('');
  builder.lines(buildWasmPreflightCheck(wasmCrateNames.value), wasmCrateNames.paths);
  builder.line('');
  builder.lines(buildPreflightExit());
  builder.line('');

  // --- family 2: deployment title and network summary ----------------------
  // Token name and symbol are read HERE, at the line each shapes.
  emitSection(
    builder,
    `Deploying ${shellEscape(builder.config.token.name)} (${shellEscape(builder.config.token.symbol)}) — RWA Token System`
  );
  emitEcho(builder, `  Network:        ${shellSafeDeploymentName}`, deployment.paths);
  // The signer/admin/manager lines below and the "Post-Deploy Configuration"
  // heading are display-only too, but they attribute nothing, so they record no
  // range and there is nothing to mark (a mark on a pathless emission marks
  // nothing). Emitters are applied exactly where a range exists; if an
  // attribution ever reaches one of these, the AS-4 oracle says so.
  builder.line(shellEcho('  Deploy Signer:  $SOURCE_ACCOUNT'));
  builder.line(shellEcho('  Admin:          $ADMIN'));
  builder.line(shellEcho('  Manager:        $MANAGER'));
  builder.line(shellEcho('  Admin Signer:   $ADMIN_SOURCE_ACCOUNT'));
  builder.line(shellEcho('  Manager Signer: $MANAGER_SOURCE_ACCOUNT'));
  builder.line('');

  // --- family 3: deployment and constructor sections -----------------------
  // Module and token descriptors are observed SEPARATELY so a module's paths
  // never land on the token's deploy command, and vice versa (INV-34).
  const moduleDescriptors = builder.observe((config) => buildModuleDeploymentDescriptors(config));
  const selectedModules = observeSelectedModules(builder);
  const tokenDescriptor = builder.observe((config) => buildTokenDeploymentDescriptor(config));
  const plan = {
    core: buildCoreDeploymentPlan(),
    modules: moduleDescriptors.value,
    token: tokenDescriptor.value,
  };
  // Derived from already-observed descriptors, so it reads no config here even
  // though it is used again by the summary and manifest below.
  const deployedContracts = deployedContractsOf(plan);

  emitDeploymentSections(builder, plan, networkFlag, explorerUrlTemplate, {
    deployment: deployment.paths,
    modules: moduleDescriptors.paths,
    moduleById: new Map(selectedModules.map((module) => [module.moduleId, module.paths])),
    token: tokenDescriptor.paths,
  });

  // --- family 4: post-deploy and initial-supply guidance -------------------
  builder.lines(shellSection('Post-Deploy Configuration'));
  // ONE observe for both claim-topic walks, so the section heading carries the
  // whole selection read set and neither walk's paths can drain onto a line it
  // did not shape. `deploy.sh` genuinely needs both: the indices drive the
  // `add_claim_topic` loop, and the ids narrow each trusted issuer's topic list.
  // Splitting them into two observes would attribute the ids to the issuer lines
  // and move a THIRD pinned attribution shape instead of two.
  const claimTopics = builder.observe((config) => ({
    indices: selectedClaimTopicIndices(config),
    ids: new Set<number>(selectedClaimTopicIds(config)),
  }));
  const trustedIssuers = builder.observe(
    (config) => config.identityVerification.trustedIssuers.length
  );
  emitPostDeployConfig(builder, builder.config, networkFlag, deployment.paths, {
    modules: selectedModules.map(({ moduleId, firstIndex }) => ({ moduleId, firstIndex })),
    headingPaths: selectedModules.flatMap((module) => module.paths),
    claimTopicIndices: claimTopics.value.indices,
    selectedClaimTopicIds: claimTopics.value.ids,
    claimTopicPaths: claimTopics.paths,
    trustedIssuerCount: trustedIssuers.value,
    trustedIssuerPaths: trustedIssuers.paths,
  });
  builder.line('');

  const supplyGuidance = builder.observe((config) => buildInitialSupplyGuidance(config, options));
  if (supplyGuidance.value.length > 0) {
    emitDisplay(builder, supplyGuidance.value, supplyGuidance.paths);
    builder.line('');
  }

  // --- family 5: deployment summary and manifest ---------------------------
  emitDisplay(
    builder,
    buildDeploymentSummary(deployedContracts, builder.config, explorerUrlTemplate)
  );
  builder.line('');
  builder.lines(buildDeploymentManifestWrite(deployedContracts, builder.config));
  builder.line('');

  return builder.text();
}

/**
 * Generates `deploy.sh` — a shell script that deploys and configures all
 * contracts in the correct dependency order.
 *
 * Deployment order: CTI -> IRS -> Identity Verifier -> Compliance -> Modules -> RWA Token
 * Post-deploy: bind token -> configure modules -> register hooks -> add claim topics -> add trusted issuers -> initial-supply guidance
 *
 * Supports `./scripts/deploy.sh --preflight` to validate signers and WASM artifacts without deploying.
 */
export function generateDeploySh(
  config: RWAConfig,
  options?: DeployScriptGenerationOptions
): string {
  return renderDetached(config, DEPLOY_SCRIPT_PATH, (scope) =>
    generateDeployShInScope(scope, options)
  );
}
