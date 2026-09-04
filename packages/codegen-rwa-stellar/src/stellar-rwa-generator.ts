import type {
  ConfigPath,
  FileTree,
  GenerateOptions,
  GenerationResult,
  Generator,
  ProvenanceCollector,
  ProvenanceScope,
  ValidationError,
  ValidationResult,
} from '@openzeppelin/codegen-core';
import {
  computeConfigHash,
  createLineBuilder,
  createProgressEvent,
  createProvenanceCollector,
  getFileCount,
  mergeFileTrees,
  resolveProgressCallback,
  validateWithRules,
} from '@openzeppelin/codegen-core';
import type { RWAConfig } from '@openzeppelin/rwa-config';

import type { ComplianceModuleRegistryEntry } from './modules/registry';
import { getModuleById } from './modules/registry';
import { generateCrateToml } from './templates/cargo/crate-toml';
import { workspaceTomlBlocks } from './templates/cargo/workspace-toml';
import { generateClaimTopicsIssuersContract } from './templates/contracts/claim-topics-issuers';
import { generateComplianceContract } from './templates/contracts/compliance';
import {
  generateComplianceModuleCargoToml,
  generateComplianceModuleContract,
} from './templates/contracts/compliance-module';
import { generateIdentityRegistryStorageContractInScope } from './templates/contracts/identity-registry-storage';
import { generateIdentityVerifierContract } from './templates/contracts/identity-verifier';
import { generateRwaTokenContractInScope } from './templates/contracts/rwa-token';
import { generateLibRs } from './templates/lib-rs';
import { generateReadmeInScope } from './templates/readme';
import { generateRustfmtToml } from './templates/rustfmt-toml';
import { generateBuildSh } from './templates/scripts/build-sh';
import { generateDeployShInScope } from './templates/scripts/deploy-sh';
import { generateUnderReviewModulesMd } from './templates/under-review-modules-md';
import { resolveUpstreamTemplateSource } from './upstream/source';
import type { UpstreamTemplateSource } from './upstream/types';
import { rwaValidationRules } from './validation/rules';

import { CRATE_NAMES } from './constants';
import { StellarRwaProgressPhase } from './progress-phases';

export { sanitizeDirectoryName } from './sanitize-project-name';

const GENERATOR_NAME = 'codegen-rwa-stellar';
const GENERATOR_VERSION = '0.1.0';

interface ContractCrate {
  name: string;
  dirPath: string;
  dependencies: string[];
  includeRlib?: boolean;
  /**
   * Produces `contract.rs` inside the file's own recording scope. Contracts that
   * read no config ignore the scope and return upstream text; only `rwa-token`
   * and the IRS build a patch builder over it.
   */
  generateContract: (
    scope: ProvenanceScope<RWAConfig>,
    templateSource: UpstreamTemplateSource
  ) => string;
}

/**
 * Describe the core contract crates always emitted by the generator.
 */
function getCoreContractCrates(): ContractCrate[] {
  return [
    {
      name: CRATE_NAMES.rwaToken,
      dirPath: `contracts/${CRATE_NAMES.rwaToken}`,
      dependencies: [
        'soroban-sdk',
        'stellar-access',
        'stellar-contract-utils',
        'stellar-macros',
        'stellar-tokens',
      ],
      generateContract: generateRwaTokenContractInScope,
    },
    {
      name: CRATE_NAMES.compliance,
      dirPath: `contracts/${CRATE_NAMES.compliance}`,
      dependencies: ['soroban-sdk', 'stellar-access', 'stellar-macros', 'stellar-tokens'],
      generateContract: (_scope, templateSource) => generateComplianceContract(templateSource),
    },
    {
      name: CRATE_NAMES.identityVerifier,
      dirPath: `contracts/${CRATE_NAMES.identityVerifier}`,
      dependencies: ['soroban-sdk', 'stellar-access', 'stellar-macros', 'stellar-tokens'],
      generateContract: (_scope, templateSource) =>
        generateIdentityVerifierContract(templateSource),
    },
    {
      name: CRATE_NAMES.claimTopicsIssuers,
      dirPath: `contracts/${CRATE_NAMES.claimTopicsIssuers}`,
      dependencies: ['soroban-sdk', 'stellar-access', 'stellar-macros', 'stellar-tokens'],
      generateContract: (_scope, templateSource) =>
        generateClaimTopicsIssuersContract(templateSource),
    },
    {
      name: CRATE_NAMES.identityRegistryStorage,
      dirPath: `contracts/${CRATE_NAMES.identityRegistryStorage}`,
      dependencies: ['soroban-sdk', 'stellar-access', 'stellar-macros', 'stellar-tokens'],
      generateContract: generateIdentityRegistryStorageContractInScope,
    },
  ];
}

/**
 * Generate the standard file set for one contract crate.
 *
 * Each of the three files gets its OWN scope (INV-16): `lib.rs` and the crate
 * `Cargo.toml` read no config, and sharing the contract's scope would attribute
 * every field the contract read to two static files.
 */
function generateContractCrateFiles(
  crate: ContractCrate,
  collector: ProvenanceCollector<RWAConfig>,
  templateSource: UpstreamTemplateSource
): FileTree {
  return mergeFileTrees(
    collector.createFile(`${crate.dirPath}/src/contract.rs`, (scope) =>
      crate.generateContract(scope, templateSource)
    ),
    collector.createFile(`${crate.dirPath}/src/lib.rs`, () => generateLibRs()),
    collector.createFile(`${crate.dirPath}/Cargo.toml`, () =>
      generateCrateToml({
        name: crate.name,
        dependencies: crate.dependencies,
        includeRlib: crate.includeRlib,
      })
    )
  );
}

/**
 * One selected module, with the config paths of every occurrence that selected it.
 *
 * Grouping is by module id in first-seen order, which is the order the module
 * loop already used, so the generated file order does not move. Duplicate
 * selections of one id collapse to a single group whose paths union both
 * indices (D9) — a sibling module's index never enters another group, which is
 * what stops one tick from claiming another module's crate (INV-19).
 */
interface SelectedModuleGroup {
  readonly entry: ComplianceModuleRegistryEntry;
  readonly createdBy: readonly ConfigPath[];
}

/**
 * Observe each `compliance.modules[i].moduleId` individually, so every group
 * carries per-occurrence paths rather than the whole array. Runs at the
 * composition root, outside every file scope, so the reads land on no file's
 * content (INV-23).
 */
function observeSelectedModuleGroups(
  collector: ProvenanceCollector<RWAConfig>
): readonly SelectedModuleGroup[] {
  const moduleCount = collector.observe((config) => config.compliance.modules.length).value;

  const groups = new Map<string, { entry: ComplianceModuleRegistryEntry; paths: ConfigPath[] }>();
  for (let index = 0; index < moduleCount; index += 1) {
    const occurrence = collector.observe((config) => config.compliance.modules[index]?.moduleId);
    const moduleId = occurrence.value;
    if (moduleId === undefined) continue;

    const existing = groups.get(moduleId);
    if (existing !== undefined) {
      existing.paths.push(...occurrence.paths);
      continue;
    }
    const entry = getModuleById(moduleId);
    // Unknown ids are rejected by validation before generation; skipping here
    // preserves the pre-migration loop's behaviour exactly.
    if (!entry) continue;
    groups.set(moduleId, { entry, paths: [...occurrence.paths] });
  }

  return [...groups.values()].map((group) => ({ entry: group.entry, createdBy: group.paths }));
}

/**
 * Promote under-review warnings to errors unless explicitly allowed.
 */
function applyGenerationOptionsPolicies(
  validation: ValidationResult,
  options?: GenerateOptions
): ValidationResult {
  if (options?.allowUnderReviewModules) {
    return validation;
  }

  const underReviewErrors: ValidationError[] = validation.warnings
    .filter((warning) => warning.code === 'UNDER_REVIEW_MODULE')
    .map((warning) => ({
      ...warning,
      message: `${warning.message}. Re-run with allowUnderReviewModules enabled to proceed.`,
    }));

  if (underReviewErrors.length === 0) {
    return validation;
  }

  return {
    valid: false,
    errors: [...validation.errors, ...underReviewErrors],
    warnings: validation.warnings,
  };
}

/**
 * Stellar RWA Generator — implements Generator<RWAConfig> from codegen-core.
 *
 * Produces a complete multi-contract Stellar/Soroban project from
 * a declarative RWAConfig object.
 */
export class StellarRwaGenerator implements Generator<RWAConfig> {
  readonly name = GENERATOR_NAME;
  readonly version = GENERATOR_VERSION;

  /** Validate configuration and apply generation-specific policy gates. */
  validate(config: RWAConfig, options?: GenerateOptions): ValidationResult {
    const validation = validateWithRules(config, rwaValidationRules);
    return applyGenerationOptionsPolicies(validation, options);
  }

  /** Generate the complete in-memory project file tree for the given config. */
  generate(config: RWAConfig, options?: GenerateOptions): GenerationResult {
    const progress = resolveProgressCallback(options?.onProgress);
    const templateSource = resolveUpstreamTemplateSource(options);

    progress(createProgressEvent(StellarRwaProgressPhase.validating, 10));

    const validation = this.validate(config, options);
    if (!validation.valid) {
      throw new Error(
        `Invalid configuration: ${validation.errors.map((e) => e.message).join('; ')}`
      );
    }

    progress(createProgressEvent(StellarRwaProgressPhase.generatingContracts, 30));

    // INV-15: created AFTER validation, so validation's reads of locked fields
    // never enter a file scope. One collector per composition root.
    const collector = createProvenanceCollector(config, {
      enabled: options?.recordProvenance === true,
    });

    const crates = getCoreContractCrates();
    const coreMembers = crates.map((c) => c.dirPath);

    let files: FileTree = {};

    for (const crate of crates) {
      files = mergeFileTrees(files, generateContractCrateFiles(crate, collector, templateSource));
    }

    const moduleGroups = observeSelectedModuleGroups(collector);
    const moduleMembers = moduleGroups.map((group) => `contracts/modules/${group.entry.crateName}`);

    for (const group of moduleGroups) {
      const moduleDirPath = `contracts/modules/${group.entry.crateName}`;

      // INV-19 / INV-23: these three files exist BECAUSE this module was
      // selected, so the selecting paths are a `created` entry — never content
      // paths, and never a sibling module's index. Duplicate selections of one
      // id union their indices onto the single file set they produce (D9).
      const createdBy = group.createdBy;

      files = mergeFileTrees(
        files,
        collector.createFile(
          `${moduleDirPath}/src/contract.rs`,
          () => generateComplianceModuleContract(group.entry, templateSource),
          { createdBy }
        ),
        collector.createFile(`${moduleDirPath}/src/lib.rs`, () => generateLibRs(), { createdBy }),
        collector.createFile(
          `${moduleDirPath}/Cargo.toml`,
          () => generateComplianceModuleCargoToml(group.entry, templateSource),
          { createdBy }
        )
      );
    }

    progress(createProgressEvent(StellarRwaProgressPhase.generatingScripts, 60));

    files = mergeFileTrees(
      files,
      collector.createFile('Cargo.toml', (scope) => {
        // INV-17: the builder is the first thing that touches the scope. Every
        // member value was resolved at the composition root, so nothing is read
        // through this scope at all — the member range carries exactly the
        // observed module paths and nothing else.
        const builder = createLineBuilder(scope, { separator: '\n' });
        const blocks = workspaceTomlBlocks(
          {
            members: [...coreMembers, ...moduleMembers],
            contractsLibraryPath: options?.contractsLibraryPath,
            repositoryUrl: templateSource.metadata.sourceRepoUrl,
          },
          [
            { members: coreMembers, paths: [] },
            {
              members: moduleMembers,
              paths: moduleGroups.flatMap((group) => group.createdBy),
            },
          ]
        );
        for (const block of blocks) builder.block(block.text, block.paths);
        return builder.text();
      })
    );

    files = mergeFileTrees(
      files,
      collector.createFile('rustfmt.toml', () => generateRustfmtToml())
    );

    files = mergeFileTrees(
      files,
      collector.createFile('scripts/build.sh', (scope) => generateBuildSh(scope.config))
    );
    files = mergeFileTrees(
      files,
      collector.createFile('scripts/deploy.sh', (scope) => generateDeployShInScope(scope))
    );
    files = mergeFileTrees(
      files,
      collector.createFile('config.json', (scope) => generateConfigJson(scope.config))
    );
    files = mergeFileTrees(
      files,
      collector.createFile('README.md', (scope) =>
        generateReadmeInScope(scope, {
          templateSourceMetadata: templateSource.metadata,
        })
      )
    );

    // INV-23: the existence decision is observed BEFORE it is taken, so its
    // paths become the file's `created` entry instead of landing on whatever
    // the content emits first.
    const underReviewMd = collector.observe((c) => generateUnderReviewModulesMd(c));
    if (underReviewMd.value !== null) {
      files = mergeFileTrees(
        files,
        collector.createFile(
          'UNDER_REVIEW_MODULES.md',
          (scope) => {
            const content = generateUnderReviewModulesMd(scope.config);
            if (content === null) {
              // Unreachable: the template is pure and the config has not moved.
              throw new Error(
                'UNDER_REVIEW_MODULES.md content disagreed with its existence decision'
              );
            }
            return content;
          },
          { createdBy: underReviewMd.paths }
        )
      );
    }

    // INV-15: hashing reads the raw config, outside every scope.
    const configHash = computeConfigHash(config);

    progress(createProgressEvent(StellarRwaProgressPhase.complete, 100));

    const provenance = collector.result();

    return {
      files,
      metadata: {
        generatorName: this.name,
        generatorVersion: this.version,
        generatedAt: new Date().toISOString(),
        fileCount: getFileCount(files),
        configHash,
      },
      // INV-2 / D14: a conditional spread, never `provenance: undefined`.
      ...(provenance === undefined ? {} : { provenance }),
    };
  }
}

/** Serialize RWAConfig as config.json mirroring the type structure per SR-007. */
function generateConfigJson(config: RWAConfig): string {
  return JSON.stringify(config, null, 2) + '\n';
}
