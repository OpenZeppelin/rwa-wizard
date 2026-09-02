import type {
  FileTree,
  GenerateOptions,
  GenerationResult,
  ProvenanceCollector,
} from '@openzeppelin/codegen-core';
import {
  createLineBuilder,
  createPatchBuilder,
  createProvenanceCollector,
  getFileCount,
  hasProvenance,
  mergeFileTrees,
  mergeProvenance,
} from '@openzeppelin/codegen-core';
import type { RWAConfig } from '@openzeppelin/rwa-config';

import { workspaceTomlBlocks } from './cargo/workspace-toml';
import {
  applyIdentityRegistryStoragePatches,
  getIdentityRegistryStorageSource,
  IDENTITY_REGISTRY_STORAGE_CONTRACT_PATH,
} from './contracts/identity-registry-storage';
import {
  generateBootstrapDemoMintShInScope,
  shouldGenerateBootstrapDemoMintScript,
} from './scripts/bootstrap-demo-mint-sh';
import { generateDeployShInScope } from './scripts/deploy-sh';

import { CRATE_NAMES } from '../constants';
import { getModuleById } from '../modules/registry';
import { StellarRwaGenerator } from '../stellar-rwa-generator';
import { resolveUpstreamTemplateSource } from '../upstream/source';
import type { UpstreamTemplateSource } from '../upstream/types';
import { IDENTITY_SUPPORT_CONTRACTS, SIGN_CLAIM_TOOL } from './identity-support-contracts';
import { generateLibRs } from './lib-rs';
import { generateReadmeInScope } from './readme';

export { IDENTITY_SUPPORT_CONTRACTS, SIGN_CLAIM_TOOL } from './identity-support-contracts';

const IDENTITY_SUPPORT_WORKSPACE_DEPENDENCIES = {
  'ed25519-dalek': '"2.1.1"',
} as const;

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

const GENERATED_CORE_WORKSPACE_MEMBERS: readonly string[] = [
  `contracts/${CRATE_NAMES.rwaToken}`,
  `contracts/${CRATE_NAMES.compliance}`,
  `contracts/${CRATE_NAMES.identityVerifier}`,
  `contracts/${CRATE_NAMES.claimTopicsIssuers}`,
  `contracts/${CRATE_NAMES.identityRegistryStorage}`,
];

/**
 * The module-derived workspace members, in the same first-seen, de-duplicated
 * order the base generator emits their crates in.
 */
function getGeneratedModuleWorkspaceMembers(config: RWAConfig): string[] {
  const members: string[] = [];
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

/**
 * Every identity-support file is static upstream text: it reads no config, so
 * each is produced inside its own scope and honestly records empty paths
 * (INV-36). Identity-support MODE is an entry-point choice, not a config path,
 * so none of them gets a `created` entry (INV-23).
 */
function generateIdentitySupportFilesFromSource<T extends object>(
  templateSource: UpstreamTemplateSource,
  collector: ProvenanceCollector<T>
): IdentitySupportFiles {
  let files: FileTree = {};

  for (const contract of IDENTITY_SUPPORT_CONTRACTS) {
    files = mergeFileTrees(
      files,
      collector.createFile(`${contract.dirPath}/src/contract.rs`, () =>
        templateSource.getTemplate('identity-support-contract', contract.id)
      ),
      collector.createFile(`${contract.dirPath}/src/lib.rs`, () => generateLibRs()),
      collector.createFile(`${contract.dirPath}/Cargo.toml`, () =>
        templateSource.getTemplate('identity-support-cargo', contract.id)
      )
    );
  }

  files = mergeFileTrees(
    files,
    collector.createFile(`${SIGN_CLAIM_TOOL.dirPath}/src/main.rs`, () =>
      templateSource.getTemplate('identity-support-tool', SIGN_CLAIM_TOOL.id)
    ),
    collector.createFile(`${SIGN_CLAIM_TOOL.dirPath}/Cargo.toml`, () =>
      generateStandaloneSignClaimCargoToml(templateSource)
    )
  );

  return {
    files,
    workspaceMembers: IDENTITY_SUPPORT_CONTRACTS.map((contract) => contract.dirPath),
    workspaceExcludes: [SIGN_CLAIM_TOOL.dirPath],
  };
}

/**
 * Re-emit the IRS contract with the identity-support additions.
 *
 * The identity variant is REPLAYED from the upstream source — the base patch
 * sequence first, then the two identity edits — rather than patched on top of
 * the already-generated text (D5, INV-22). Patching the generated string under
 * a fresh scope would re-record the file and discard every range the base pass
 * had attached, so the identity IRS would report that it depends only on the
 * identity import. Replaying keeps one patch builder over the whole edit
 * sequence, and the bytes are unchanged because the sequence is unchanged.
 */
function generateIdentityRegistryStorageOverride(
  files: FileTree,
  templateSource: UpstreamTemplateSource,
  collector: ProvenanceCollector<RWAConfig>
): FileTree {
  if (typeof files[IDENTITY_REGISTRY_STORAGE_CONTRACT_PATH] !== 'string') {
    return files;
  }

  return mergeFileTrees(
    files,
    collector.createFile(IDENTITY_REGISTRY_STORAGE_CONTRACT_PATH, (scope) => {
      const patcher = createPatchBuilder(scope, getIdentityRegistryStorageSource(templateSource));
      applyIdentityRegistryStoragePatches(patcher);
      patcher.replaceExact(IRS_UPSTREAM_SOROBAN_IMPORT, IRS_IDENTITY_SUPPORT_SOROBAN_IMPORT);
      patcher.insertAfterExact(IRS_TYPED_COUNTRY_DATA_INSERT_AFTER, IRS_TYPED_COUNTRY_DATA_HELPER);
      return patcher.text();
    })
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
  // This entry point returns files only; nothing consumes provenance, so the
  // collector is disabled and records nothing. The support templates never read
  // config, so the collector's config type is immaterial here.
  return generateIdentitySupportFilesFromSource(
    resolveUpstreamTemplateSource(options),
    createProvenanceCollector({}, { enabled: false })
  );
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

  // INV-15: one override collector for this wrapper, enabled from the SAME
  // option as the base call, so base and override provenance are always present
  // together or absent together.
  const overrideCollector = createProvenanceCollector(config, {
    enabled: options?.recordProvenance === true,
  });

  // Recorded in the SAME order the files merge below — base(+IRS), support,
  // extras — so the surviving provenance entry always belongs to the surviving
  // content (INV-20).
  const identityIrs = generateIdentityRegistryStorageOverride(
    result.files,
    templateSource,
    overrideCollector
  );
  const support = generateIdentitySupportFilesFromSource(templateSource, overrideCollector);
  // INV-23: the demo-mint script's existence decision, observed before it is
  // taken, so its paths become that file's `created` entry.
  const demoAutoMint = overrideCollector.observe((c) =>
    shouldGenerateBootstrapDemoMintScript(c, true)
  );
  const includeDemoAutoMint = demoAutoMint.value;
  const readmeContext = {
    templateSourceMetadata: templateSource.metadata,
    includeIdentitySupport: true,
    includeDemoAutoMint,
  };
  const deployScriptOptions = {
    includeIdentitySupport: true,
    includeDemoAutoMint,
  };

  // Observed at the composition root so the module members' paths reach the
  // member block only, and land on no other file (INV-24).
  const moduleMembers = overrideCollector.observe((c) => getGeneratedModuleWorkspaceMembers(c));

  const extraFiles = [
    overrideCollector.createFile('Cargo.toml', (scope) => {
      // INV-17: first toucher of the scope; every member value is already resolved.
      const builder = createLineBuilder(scope, { separator: '\n' });
      const blocks = workspaceTomlBlocks(
        {
          members: [
            ...GENERATED_CORE_WORKSPACE_MEMBERS,
            ...moduleMembers.value,
            ...support.workspaceMembers,
          ],
          exclude: support.workspaceExcludes,
          extraWorkspaceDependencies: IDENTITY_SUPPORT_WORKSPACE_DEPENDENCIES,
          contractsLibraryPath: options?.contractsLibraryPath,
          repositoryUrl: templateSource.metadata.sourceRepoUrl,
        },
        [
          { members: GENERATED_CORE_WORKSPACE_MEMBERS, paths: [] },
          { members: moduleMembers.value, paths: moduleMembers.paths },
          // Identity-only members come from the entry point, not from config.
          { members: support.workspaceMembers, paths: [] },
        ]
      );
      for (const block of blocks) builder.block(block.text, block.paths);
      return builder.text();
    }),
    overrideCollector.createFile('README.md', (scope) =>
      generateReadmeInScope(scope, readmeContext)
    ),
    overrideCollector.createFile('scripts/deploy.sh', (scope) =>
      generateDeployShInScope(scope, deployScriptOptions)
    ),
  ];

  if (includeDemoAutoMint) {
    extraFiles.push(
      overrideCollector.createFile(
        'scripts/bootstrap-demo-mint.sh',
        (scope) => generateBootstrapDemoMintShInScope(scope),
        { createdBy: demoAutoMint.paths }
      )
    );
  }

  // Merge order is load-bearing (INV-20): the provenance merge below mirrors it
  // argument for argument, so the surviving entry always belongs to the
  // surviving content.
  const files = mergeFileTrees(identityIrs, support.files, ...extraFiles);

  const baseProvenance = hasProvenance(result) ? result.provenance : undefined;
  const overrideProvenance = overrideCollector.result();

  return {
    ...result,
    files,
    metadata: {
      ...result.metadata,
      fileCount: getFileCount(files),
    },
    // INV-2 / D14: conditional spread. Both collectors share one option, so the
    // guard is a type narrowing, not a half-recorded result.
    ...(baseProvenance !== undefined && overrideProvenance !== undefined
      ? { provenance: mergeProvenance(baseProvenance, overrideProvenance) }
      : {}),
  };
}
