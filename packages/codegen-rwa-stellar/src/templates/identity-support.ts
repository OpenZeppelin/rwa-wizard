import type { FileTree, GenerateOptions, GenerationResult } from '@openzeppelin/codegen-core';
import {
  createFile,
  getFileCount,
  insertAfterExact,
  mergeFileTrees,
  replaceExact,
} from '@openzeppelin/codegen-core';
import type { RWAConfig } from '@openzeppelin/rwa-config';

import { generateWorkspaceToml } from './cargo/workspace-toml';

import { CRATE_NAMES } from '../constants';
import { getModuleById } from '../modules/registry';
import { StellarRwaGenerator } from '../stellar-rwa-generator';
import { resolveUpstreamTemplateSource } from '../upstream/source';
import type { UpstreamTemplateSource } from '../upstream/types';
import { generateLibRs } from './lib-rs';

export const IDENTITY_SUPPORT_CONTRACTS = [
  {
    id: 'claim-issuer',
    crateName: 'rwa-claim-issuer-example',
    dirPath: 'contracts/claim-issuer',
    displayName: 'Claim Issuer',
  },
  {
    id: 'identity',
    crateName: 'rwa-identity-example',
    dirPath: 'contracts/identity',
    displayName: 'Identity',
  },
] as const;

export const SIGN_CLAIM_TOOL = {
  id: 'sign-claim',
  dirPath: 'tools/sign-claim',
  displayName: 'Sign Claim',
} as const;

const IDENTITY_SUPPORT_WORKSPACE_DEPENDENCIES = {
  'ed25519-dalek': '"2.1.1"',
} as const;

const IDENTITY_REGISTRY_STORAGE_CONTRACT_PATH =
  'contracts/identity-registry-storage/src/contract.rs';

const IRS_UPSTREAM_SOROBAN_IMPORT =
  'use soroban_sdk::{contract, contractimpl, symbol_short, Address, Env, FromVal, Symbol, Val, Vec};';

const IRS_IDENTITY_SUPPORT_SOROBAN_IMPORT =
  'use soroban_sdk::{contract, contractimpl, symbol_short, Address, Env, FromVal, IntoVal, Symbol, Val, Vec};';

const IRS_TYPED_COUNTRY_DATA_INSERT_AFTER = `    pub fn get_token_index(e: &Env, token: Address) -> u32 {
        binder::get_token_index(e, &token)
    }`;

const IRS_TYPED_COUNTRY_DATA_HELPER = `

    pub fn get_country_data_entries(e: &Env, account: Address) -> Vec<Val> {
        Vec::from_iter(
            e,
            identity_storage::get_country_data_entries(e, &account)
                .iter()
                .map(|entry| entry.into_val(e)),
        )
    }

    #[only_role(operator, "manager")]
    pub fn add_identity_country_data(
        e: &Env,
        account: Address,
        identity: Address,
        initial_profiles: Vec<CountryData>,
        operator: Address,
    ) {
        identity_storage::add_identity(
            e,
            &account,
            &identity,
            IdentityType::Individual,
            &initial_profiles,
        );
    }`;

export interface IdentitySupportFiles {
  files: FileTree;
  workspaceMembers: string[];
  workspaceExcludes: string[];
}

function getGeneratedWorkspaceMembers(config: RWAConfig): string[] {
  const members = [
    `contracts/${CRATE_NAMES.rwaToken}`,
    `contracts/${CRATE_NAMES.compliance}`,
    `contracts/${CRATE_NAMES.identityVerifier}`,
    `contracts/${CRATE_NAMES.claimTopicsIssuers}`,
    `contracts/${CRATE_NAMES.identityRegistryStorage}`,
  ];

  const uniqueModuleIds = [...new Set(config.compliance.modules.map((module) => module.moduleId))];
  for (const moduleId of uniqueModuleIds) {
    const entry = getModuleById(moduleId);
    if (entry) {
      members.push(`contracts/modules/${entry.crateName}`);
    }
  }

  return members;
}

function generateStandaloneSignClaimCargoToml(templateSource: UpstreamTemplateSource): string {
  return templateSource
    .getTemplate('identity-support-tool-cargo', SIGN_CLAIM_TOOL.id)
    .replace(/^authors\.workspace = true$/m, 'authors = ["OpenZeppelin"]');
}

function generateIdentitySupportFilesFromSource(
  templateSource: UpstreamTemplateSource
): IdentitySupportFiles {
  let files: FileTree = {};

  for (const contract of IDENTITY_SUPPORT_CONTRACTS) {
    files = mergeFileTrees(
      files,
      createFile(
        `${contract.dirPath}/src/contract.rs`,
        templateSource.getTemplate('identity-support-contract', contract.id)
      ),
      createFile(`${contract.dirPath}/src/lib.rs`, generateLibRs()),
      createFile(
        `${contract.dirPath}/Cargo.toml`,
        templateSource.getTemplate('identity-support-cargo', contract.id)
      )
    );
  }

  files = mergeFileTrees(
    files,
    createFile(
      `${SIGN_CLAIM_TOOL.dirPath}/src/main.rs`,
      templateSource.getTemplate('identity-support-tool', SIGN_CLAIM_TOOL.id)
    ),
    createFile(
      `${SIGN_CLAIM_TOOL.dirPath}/Cargo.toml`,
      generateStandaloneSignClaimCargoToml(templateSource)
    )
  );

  return {
    files,
    workspaceMembers: IDENTITY_SUPPORT_CONTRACTS.map((contract) => contract.dirPath),
    workspaceExcludes: [SIGN_CLAIM_TOOL.dirPath],
  };
}

function addTypedCountryDataHelper(files: FileTree): FileTree {
  const source = files[IDENTITY_REGISTRY_STORAGE_CONTRACT_PATH];
  if (typeof source !== 'string') {
    return files;
  }

  return mergeFileTrees(
    files,
    createFile(
      IDENTITY_REGISTRY_STORAGE_CONTRACT_PATH,
      insertAfterExact(
        replaceExact(source, IRS_UPSTREAM_SOROBAN_IMPORT, IRS_IDENTITY_SUPPORT_SOROBAN_IMPORT),
        IRS_TYPED_COUNTRY_DATA_INSERT_AFTER,
        IRS_TYPED_COUNTRY_DATA_HELPER
      )
    )
  );
}

/**
 * Generate upstream example identity-onboarding contracts and a claim-signing helper.
 *
 * Development and testnet scaffolding only — not a production onboarding stack.
 * The claim-signing helper is emitted as an excluded Cargo package because it
 * is a native binary, not a Soroban contract crate.
 */
export function generateIdentitySupportFiles(options?: GenerateOptions): IdentitySupportFiles {
  return generateIdentitySupportFilesFromSource(resolveUpstreamTemplateSource(options));
}

/**
 * Generate the regular RWA project plus example claim-issuer / identity
 * scaffolding used to exercise complete local and testnet identity flows.
 *
 * Not for production — use real claim issuers and holder onboarding in live deployments.
 */
export function generateWithIdentitySupport(
  config: RWAConfig,
  options?: GenerateOptions
): GenerationResult {
  const generator = new StellarRwaGenerator();
  const result = generator.generate(config, options);
  const templateSource = resolveUpstreamTemplateSource(options);
  const support = generateIdentitySupportFilesFromSource(templateSource);

  const files = mergeFileTrees(
    addTypedCountryDataHelper(result.files),
    support.files,
    createFile(
      'Cargo.toml',
      generateWorkspaceToml({
        members: [...getGeneratedWorkspaceMembers(config), ...support.workspaceMembers],
        exclude: support.workspaceExcludes,
        extraWorkspaceDependencies: IDENTITY_SUPPORT_WORKSPACE_DEPENDENCIES,
        contractsLibraryPath: options?.contractsLibraryPath,
        repositoryUrl: templateSource.metadata.sourceRepoUrl,
      })
    )
  );

  return {
    ...result,
    files,
    metadata: {
      ...result.metadata,
      fileCount: getFileCount(files),
    },
  };
}
