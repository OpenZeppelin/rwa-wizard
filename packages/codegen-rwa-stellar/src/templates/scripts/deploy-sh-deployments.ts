import { getUniqueModuleSelections } from '@openzeppelin/codegen-rwa-common';
import type { RWAConfig } from '@openzeppelin/rwa-config';

import { CRATE_NAMES } from '../../constants';
import { getModuleDescriptorById } from '../../modules/registry';
import {
  buildDeploySection,
  moduleVarName,
  shellSubsection,
  type DeployedContract,
} from './deploy-sh-helpers';
import { buildTokenConstructorArgs } from './deploy-sh-token';

interface DeploymentDescriptor {
  displayName: string;
  varName: string;
  crateName: string;
  constructorArgs: string;
  comment?: string;
}

function appendDeploymentSection(
  lines: string[],
  deployedContracts: DeployedContract[],
  descriptor: DeploymentDescriptor,
  networkFlag: string,
  explorerUrlTemplate: string | undefined,
  stepLabel?: string
): void {
  lines.push('echo ""');

  if (descriptor.comment) {
    lines.push(descriptor.comment);
  }

  lines.push(
    buildDeploySection(
      descriptor.varName,
      descriptor.displayName,
      descriptor.crateName,
      descriptor.constructorArgs,
      networkFlag,
      explorerUrlTemplate,
      stepLabel
    )
  );
  deployedContracts.push({ name: descriptor.displayName, varName: descriptor.varName });
  lines.push('');
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
      constructorArgs: '--admin "$ADMIN"',
    });
  }

  return descriptors;
}

function buildTokenDeploymentDescriptor(config: RWAConfig): DeploymentDescriptor {
  return {
    varName: 'RWA_TOKEN_ADDRESS',
    displayName: `${config.token.symbol} Token`,
    crateName: CRATE_NAMES.rwaTtoken,
    constructorArgs: buildTokenConstructorArgs(config),
  };
}

export function buildDeploymentSections(
  config: RWAConfig,
  networkFlag: string,
  explorerUrlTemplate: string | undefined
): { deployedContracts: DeployedContract[]; lines: string[] } {
  const lines: string[] = [];
  const deployedContracts: DeployedContract[] = [];

  const coreDescriptors = buildCoreDeploymentDescriptors();
  lines.push(...shellSubsection(`Core Contracts (${coreDescriptors.length})`));

  for (let i = 0; i < coreDescriptors.length; i++) {
    appendDeploymentSection(
      lines,
      deployedContracts,
      coreDescriptors[i],
      networkFlag,
      explorerUrlTemplate,
      `[${i + 1}/${coreDescriptors.length}]`
    );
  }

  const moduleDeployments = buildModuleDeploymentDescriptors(config);
  if (moduleDeployments.length > 0) {
    lines.push(...shellSubsection(`Compliance Modules (${moduleDeployments.length})`));

    for (let i = 0; i < moduleDeployments.length; i++) {
      appendDeploymentSection(
        lines,
        deployedContracts,
        moduleDeployments[i],
        networkFlag,
        explorerUrlTemplate,
        `[${i + 1}/${moduleDeployments.length}]`
      );
    }
  }

  lines.push(...shellSubsection('RWA Token'));
  appendDeploymentSection(
    lines,
    deployedContracts,
    buildTokenDeploymentDescriptor(config),
    networkFlag,
    explorerUrlTemplate
  );

  return { deployedContracts, lines };
}
