import type {
  FileTree,
  GenerateOptions,
  GenerationResult,
  Generator,
  ValidationError,
  ValidationResult,
} from '@openzeppelin/codegen-core';
import {
  computeConfigHash,
  createFile,
  createProgressEvent,
  getFileCount,
  mergeFileTrees,
  resolveProgressCallback,
  validateWithRules,
} from '@openzeppelin/codegen-core';
import type { RWAConfig } from '@openzeppelin/rwa-config';

import { getModuleById } from './modules/registry';
import { generateCrateToml } from './templates/cargo/crate-toml';
import { generateWorkspaceToml } from './templates/cargo/workspace-toml';
import { generateClaimTopicsIssuersContract } from './templates/contracts/claim-topics-issuers';
import { generateComplianceContract } from './templates/contracts/compliance';
import { generateComplianceModuleContract } from './templates/contracts/compliance-module';
import { generateIdentityRegistryStorageContract } from './templates/contracts/identity-registry-storage';
import { generateIdentityVerifierContract } from './templates/contracts/identity-verifier';
import { generateRwaTokenContract } from './templates/contracts/rwa-token';
import { generateLibRs } from './templates/lib-rs';
import { generateReadme } from './templates/readme';
import { generateRustfmtToml } from './templates/rustfmt-toml';
import { generateBuildSh } from './templates/scripts/build-sh';
import { generateDeploySh } from './templates/scripts/deploy-sh';
import { generateUnderReviewModulesMd } from './templates/under-review-modules-md';
import { resolveUpstreamTemplateSource } from './upstream/source';
import type { UpstreamTemplateSource } from './upstream/types';
import { rwaValidationRules } from './validation/rules';

import { CRATE_NAMES } from './constants';

/**
 * Sanitize a token symbol into a valid directory name for the ZIP root.
 *
 * Algorithm: lowercase → replace non-alphanumeric with hyphens →
 * collapse consecutive hyphens → trim leading/trailing hyphens → append `-rwa`.
 */
export function sanitizeDirectoryName(symbol: string): string {
  const sanitized = symbol
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${sanitized}-rwa`;
}

const GENERATOR_NAME = 'codegen-rwa-stellar';
const GENERATOR_VERSION = '0.1.0';

interface ContractCrate {
  name: string;
  dirPath: string;
  dependencies: string[];
  includeRlib?: boolean;
  generateContract: (config: RWAConfig, templateSource: UpstreamTemplateSource) => string;
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
      generateContract: generateRwaTokenContract,
    },
    {
      name: CRATE_NAMES.compliance,
      dirPath: `contracts/${CRATE_NAMES.compliance}`,
      dependencies: ['soroban-sdk', 'stellar-access', 'stellar-macros', 'stellar-tokens'],
      generateContract: generateComplianceContract,
    },
    {
      name: CRATE_NAMES.identityVerifier,
      dirPath: `contracts/${CRATE_NAMES.identityVerifier}`,
      dependencies: ['soroban-sdk', 'stellar-access', 'stellar-macros', 'stellar-tokens'],
      generateContract: generateIdentityVerifierContract,
    },
    {
      name: CRATE_NAMES.claimTopicsIssuers,
      dirPath: `contracts/${CRATE_NAMES.claimTopicsIssuers}`,
      dependencies: ['soroban-sdk', 'stellar-access', 'stellar-macros', 'stellar-tokens'],
      generateContract: generateClaimTopicsIssuersContract,
    },
    {
      name: CRATE_NAMES.identityRegistryStorage,
      dirPath: `contracts/${CRATE_NAMES.identityRegistryStorage}`,
      dependencies: ['soroban-sdk', 'stellar-access', 'stellar-macros', 'stellar-tokens'],
      generateContract: generateIdentityRegistryStorageContract,
    },
  ];
}

/**
 * Generate the standard file set for one contract crate.
 */
function generateContractCrateFiles(
  crate: ContractCrate,
  config: RWAConfig,
  templateSource: UpstreamTemplateSource
): FileTree {
  const contractRs = crate.generateContract(config, templateSource);
  const libRs = generateLibRs();
  const cargoToml = generateCrateToml({
    name: crate.name,
    dependencies: crate.dependencies,
    includeRlib: crate.includeRlib,
  });

  return mergeFileTrees(
    createFile(`${crate.dirPath}/src/contract.rs`, contractRs),
    createFile(`${crate.dirPath}/src/lib.rs`, libRs),
    createFile(`${crate.dirPath}/Cargo.toml`, cargoToml)
  );
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

    progress(createProgressEvent('validating', 10));

    const validation = this.validate(config, options);
    if (!validation.valid) {
      throw new Error(
        `Invalid configuration: ${validation.errors.map((e) => e.message).join('; ')}`
      );
    }

    progress(createProgressEvent('generating-contracts', 30));

    const crates = getCoreContractCrates();
    const members = crates.map((c) => c.dirPath);

    let files: FileTree = {};

    for (const crate of crates) {
      files = mergeFileTrees(files, generateContractCrateFiles(crate, config, templateSource));
    }

    const uniqueModuleIds = [...new Set(config.compliance.modules.map((m) => m.moduleId))];
    for (const moduleId of uniqueModuleIds) {
      const entry = getModuleById(moduleId);
      if (!entry) continue;

      const moduleDirPath = `contracts/modules/${entry.crateName}`;
      members.push(moduleDirPath);

      const contractRs = generateComplianceModuleContract(entry, templateSource);
      const libRs = generateLibRs();
      const cargoToml = generateCrateToml({
        name: entry.crateName,
        dependencies: ['soroban-sdk', 'stellar-tokens'],
        includeRlib: true,
      });

      files = mergeFileTrees(
        files,
        createFile(`${moduleDirPath}/src/contract.rs`, contractRs),
        createFile(`${moduleDirPath}/src/lib.rs`, libRs),
        createFile(`${moduleDirPath}/Cargo.toml`, cargoToml)
      );
    }

    progress(createProgressEvent('generating-scripts', 60));

    const workspaceToml = generateWorkspaceToml({
      members,
      contractsLibraryPath: options?.contractsLibraryPath,
      repositoryUrl: templateSource.metadata.sourceRepoUrl,
    });
    files = mergeFileTrees(files, createFile('Cargo.toml', workspaceToml));

    const rustfmtToml = generateRustfmtToml();
    files = mergeFileTrees(files, createFile('rustfmt.toml', rustfmtToml));

    files = mergeFileTrees(files, createFile('scripts/build.sh', generateBuildSh(config)));
    files = mergeFileTrees(files, createFile('scripts/deploy.sh', generateDeploySh(config)));
    files = mergeFileTrees(files, createFile('config.json', generateConfigJson(config)));
    files = mergeFileTrees(
      files,
      createFile(
        'README.md',
        generateReadme(config, {
          templateSourceMetadata: templateSource.metadata,
        })
      )
    );

    const underReviewMd = generateUnderReviewModulesMd(config);
    if (underReviewMd) {
      files = mergeFileTrees(files, createFile('UNDER_REVIEW_MODULES.md', underReviewMd));
    }

    const configHash = computeConfigHash(config);

    progress(createProgressEvent('complete', 100));

    return {
      files,
      metadata: {
        generatorName: this.name,
        generatorVersion: this.version,
        generatedAt: new Date().toISOString(),
        fileCount: getFileCount(files),
        configHash,
      },
    };
  }
}

/** Serialize RWAConfig as config.json mirroring the type structure per SR-007. */
function generateConfigJson(config: RWAConfig): string {
  return JSON.stringify(config, null, 2) + '\n';
}
