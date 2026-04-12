import type {
  FileTree,
  GenerateOptions,
  GenerationResult,
  Generator,
  ValidationResult,
} from '@openzeppelin/codegen-core';
import {
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
import { rwaValidationRules } from './validation/rules';

import { CRATE_NAMES } from './constants';

/**
 * Stellar-specific generation options extending the core `GenerateOptions`.
 */
export interface StellarGenerateOptions extends GenerateOptions {
  /**
   * Absolute path to a local `stellar-contracts` checkout.
   * When set, workspace Cargo.toml uses `path = "<this>/packages/<crate>/`
   * instead of the default git+rev dependency.
   */
  stellarContractsPath?: string;
  /** Allow under-review modules in generation (skip review-state validation errors). */
  allowUnderReviewModules?: boolean;
}

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
  generateContract: (config: RWAConfig) => string;
}

function getCoreContractCrates(): ContractCrate[] {
  return [
    {
      name: CRATE_NAMES.rwaTtoken,
      dirPath: `contracts/${CRATE_NAMES.rwaTtoken}`,
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

function generateContractCrateFiles(crate: ContractCrate, config: RWAConfig): FileTree {
  const contractRs = crate.generateContract(config);
  const libRs = generateLibRs();
  const cargoToml = generateCrateToml({
    name: crate.name,
    dependencies: crate.dependencies,
  });

  return mergeFileTrees(
    createFile(`${crate.dirPath}/src/contract.rs`, contractRs),
    createFile(`${crate.dirPath}/src/lib.rs`, libRs),
    createFile(`${crate.dirPath}/Cargo.toml`, cargoToml)
  );
}

function sortObjectKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sortObjectKeys);
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj as Record<string, unknown>).sort()) {
    sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key]);
  }
  return sorted;
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

  validate(config: RWAConfig, _options?: StellarGenerateOptions): ValidationResult {
    return validateWithRules(config, rwaValidationRules);
  }

  generate(config: RWAConfig, options?: StellarGenerateOptions): GenerationResult {
    const progress = resolveProgressCallback(options?.onProgress);

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
      files = mergeFileTrees(files, generateContractCrateFiles(crate, config));
    }

    const uniqueModuleIds = [...new Set(config.compliance.modules.map((m) => m.moduleId))];
    for (const moduleId of uniqueModuleIds) {
      const entry = getModuleById(moduleId);
      if (!entry) continue;

      const moduleDirPath = `contracts/modules/${entry.crateName}`;
      members.push(moduleDirPath);

      const contractRs = generateComplianceModuleContract(entry);
      const libRs = generateLibRs();
      const cargoToml = generateCrateToml({
        name: entry.crateName,
        dependencies: ['soroban-sdk', 'stellar-tokens'],
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
      stellarContractsPath: options?.stellarContractsPath,
    });
    files = mergeFileTrees(files, createFile('Cargo.toml', workspaceToml));

    const rustfmtToml = generateRustfmtToml();
    files = mergeFileTrees(files, createFile('rustfmt.toml', rustfmtToml));

    files = mergeFileTrees(files, createFile('scripts/build.sh', generateBuildSh(config)));
    files = mergeFileTrees(files, createFile('scripts/deploy.sh', generateDeploySh(config)));
    files = mergeFileTrees(files, createFile('config.json', generateConfigJson(config)));
    files = mergeFileTrees(files, createFile('README.md', generateReadme(config)));

    const underReviewMd = generateUnderReviewModulesMd(config);
    if (underReviewMd) {
      files = mergeFileTrees(files, createFile('UNDER_REVIEW_MODULES.md', underReviewMd));
    }

    const configHash = computeConfigHashSync(config);

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

function computeConfigHashSync(config: RWAConfig): string {
  const sorted = sortObjectKeys(config);
  const json = JSON.stringify(sorted);
  return hashFallback(json);
}

function hashFallback(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}
