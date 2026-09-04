import type { ConfigPath, LineSink } from '@openzeppelin/codegen-core';
import { getUniqueModuleSelections } from '@openzeppelin/codegen-rwa-common';
import type { RWAConfig } from '@openzeppelin/rwa-config';

import { CRATE_NAMES } from '../../constants';
import { getModuleDescriptorById } from '../../modules/registry';
import {
  buildDeploySection,
  emitSubsection,
  moduleVarName,
  shellSubsection,
  unionConfigPaths,
  type DeployedContract,
} from './deploy-sh-helpers';
import { buildTokenConstructorArgs } from './deploy-sh-token';

interface DeploymentDescriptor {
  displayName: string;
  varName: string;
  crateName: string;
  constructorArgs: string;
  comment?: string;
  /** Set for module deployments, so each section can carry ITS module's paths. */
  moduleId?: string;
}

/**
 * Emit one deployment section directly into the parent builder.
 *
 * Emitting per section rather than returning one array is what keeps a module's
 * paths on that module's own lines: `lines()` records ONE range for a whole
 * array, so a returned array would collapse every section into a single range
 * and let one module claim its siblings' commands (INV-18, INV-34).
 */
function emitDeploymentSection(
  sink: LineSink,
  descriptor: DeploymentDescriptor,
  networkFlag: string,
  explorerUrlTemplate: string | undefined,
  paths: readonly ConfigPath[],
  stepLabel?: string
): void {
  sink.line('echo ""');

  if (descriptor.comment) {
    sink.line(descriptor.comment);
  }

  sink.block(
    buildDeploySection(
      descriptor.varName,
      descriptor.displayName,
      descriptor.crateName,
      descriptor.constructorArgs,
      networkFlag,
      explorerUrlTemplate,
      stepLabel
    ),
    paths
  );
  sink.line('');
}

function buildCoreDeploymentDescriptors(): DeploymentDescriptor[] {
  return [
    {
      comment: `# 1. Deploy ${CRATE_NAMES.claimTopicsIssuers}`,
      varName: 'CTI_ADDRESS',
      displayName: 'Claim Topics & Issuers',
      crateName: CRATE_NAMES.claimTopicsIssuers,
      constructorArgs: '--admin "$ADMIN" --manager "$MANAGER"',
    },
    {
      comment: `# 2. Deploy ${CRATE_NAMES.identityRegistryStorage}`,
      varName: 'IRS_ADDRESS',
      displayName: 'Identity Registry Storage',
      crateName: CRATE_NAMES.identityRegistryStorage,
      constructorArgs: '--admin "$ADMIN" --manager "$MANAGER"',
    },
    {
      comment: `# 3. Deploy ${CRATE_NAMES.identityVerifier}`,
      varName: 'IDENTITY_VERIFIER_ADDRESS',
      displayName: 'Identity Verifier',
      crateName: CRATE_NAMES.identityVerifier,
      constructorArgs:
        '--admin "$ADMIN" --manager "$MANAGER" --identity_registry_storage "$IRS_ADDRESS" --claim_topics_and_issuers "$CTI_ADDRESS"',
    },
    {
      comment: `# 4. Deploy ${CRATE_NAMES.compliance}`,
      varName: 'COMPLIANCE_ADDRESS',
      displayName: 'Compliance',
      crateName: CRATE_NAMES.compliance,
      constructorArgs: '--admin "$ADMIN" --manager "$MANAGER"',
    },
  ];
}

function buildModuleDeploymentDescriptors(config: RWAConfig): DeploymentDescriptor[] {
  const descriptors: DeploymentDescriptor[] = [];
  const selectedModules = getUniqueModuleSelections(config.compliance.modules);

  for (const selection of selectedModules) {
    const moduleDescriptor = getModuleDescriptorById(selection.moduleId);
    if (!moduleDescriptor) continue;

    descriptors.push({
      varName: moduleVarName(selection.moduleId),
      displayName: moduleDescriptor.name,
      crateName: moduleDescriptor.crateName,
      constructorArgs: '--admin "$ADMIN" --manager "$MANAGER"',
      moduleId: selection.moduleId,
    });
  }

  return descriptors;
}

function buildTokenDeploymentDescriptor(config: RWAConfig): DeploymentDescriptor {
  return {
    varName: 'RWA_TOKEN_ADDRESS',
    displayName: `${config.token.symbol} Token`,
    crateName: CRATE_NAMES.rwaToken,
    constructorArgs: buildTokenConstructorArgs(config),
  };
}

/**
 * All workspace crate names deployed by `deploy.sh`, in deployment order.
 *
 * Reads ONLY the module selections. It deliberately does not build the token
 * descriptor: that would read the token name, symbol and every configured role
 * to obtain a crate name that is a fixed constant, and those reads would then be
 * attributed to the WASM preflight block — 38 lines that contain none of them
 * (INV-34).
 */
export function getDeploymentCrateNames(config: RWAConfig): string[] {
  const crateNames = buildCoreDeploymentDescriptors().map((descriptor) => descriptor.crateName);
  crateNames.push(
    ...buildModuleDeploymentDescriptors(config).map((descriptor) => descriptor.crateName)
  );
  crateNames.push(CRATE_NAMES.rwaToken);
  return crateNames;
}

/** The descriptors `deploy.sh` deploys, split by what config each group reads. */
export interface DeploymentPlan {
  readonly core: DeploymentDescriptor[];
  readonly modules: DeploymentDescriptor[];
  readonly token: DeploymentDescriptor;
}

/** Core descriptors read no config; the module and token ones are observed separately. */
export function buildCoreDeploymentPlan(): DeploymentDescriptor[] {
  return buildCoreDeploymentDescriptors();
}

export { buildModuleDeploymentDescriptors, buildTokenDeploymentDescriptor };

/**
 * The deployed-contract list, derived purely from already-resolved descriptors.
 *
 * Kept separate from emission because `deploy.sh` needs it again for the summary
 * and the manifest, long after the deployment sections have been emitted — a
 * value that crosses an emission must not be recomputed from config (INV-24).
 */
export function deployedContractsOf(plan: DeploymentPlan): DeployedContract[] {
  return [...plan.core, ...plan.modules, plan.token].map((descriptor) => ({
    name: descriptor.displayName,
    varName: descriptor.varName,
  }));
}

export interface DeploymentAttribution {
  /** Paths for the deployment target that shapes every `--network` / `--rpc-url` flag. */
  readonly deployment: readonly ConfigPath[];
  /** Paths for the module list as a whole — the subsection heading and count. */
  readonly modules: readonly ConfigPath[];
  /** Paths per module id, so a section carries only its own module's occurrences. */
  readonly moduleById: ReadonlyMap<string, readonly ConfigPath[]>;
  readonly token: readonly ConfigPath[];
}

export function emitDeploymentSections(
  sink: LineSink,
  plan: DeploymentPlan,
  networkFlag: string,
  explorerUrlTemplate: string | undefined,
  attribution: DeploymentAttribution
): void {
  const networkPaths = attribution.deployment;

  sink.lines(shellSubsection(`Core Contracts (${plan.core.length})`));

  plan.core.forEach((descriptor, index) => {
    emitDeploymentSection(
      sink,
      descriptor,
      networkFlag,
      explorerUrlTemplate,
      networkPaths,
      `[${index + 1}/${plan.core.length}]`
    );
  });

  if (plan.modules.length > 0) {
    emitSubsection(sink, `Compliance Modules (${plan.modules.length})`, attribution.modules);

    plan.modules.forEach((descriptor, index) => {
      const modulePaths =
        descriptor.moduleId === undefined
          ? []
          : (attribution.moduleById.get(descriptor.moduleId) ?? []);
      emitDeploymentSection(
        sink,
        descriptor,
        networkFlag,
        explorerUrlTemplate,
        unionConfigPaths(networkPaths, modulePaths),
        `[${index + 1}/${plan.modules.length}]`
      );
    });
  }

  sink.lines(shellSubsection('RWA Token'));
  emitDeploymentSection(
    sink,
    plan.token,
    networkFlag,
    explorerUrlTemplate,
    unionConfigPaths(networkPaths, attribution.token)
  );
}
