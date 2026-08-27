import type { CodegenInfoBlurb, FileTree } from '@openzeppelin/codegen-core';
import type { RWAConfig } from '@openzeppelin/rwa-config';

import type {
  GeneratedZipArtifact,
  GenerationStatus,
  StructuralComplianceModuleOption,
  StructuralEcosystemMetadata,
} from '../../types/wizard';

/**
 * In-memory project returned by preview generation.
 * Keys are the same relative paths as `GenerationResult.files`
 * (e.g. `Cargo.toml`, `contracts/rwa-token/src/contract.rs`).
 * They are not ZIP entry names. JSZip places each key under a
 * single root directory named from the token symbol; that prefix
 * is packaging, not generation.
 */
export interface GeneratedFileTreeArtifact {
  readonly files: FileTree;
}

/** Shared options bag for `generateZip` and `generateFileTree` (INV-3). */
export interface GenerateArtifactOptions {
  readonly onStatus?: (status: GenerationStatus) => void;
  readonly includeIdentitySupport?: boolean;
}

/** Normalized validation result for UI (field paths, codes, messages). */
export interface ValidationResultDTO {
  valid: boolean;
  errors: Array<{ field: string; code: string; message: string }>;
  warnings: Array<{ field: string; code: string; message: string }>;
}

/** Chain-agnostic deploy signer guidance surfaced by codegen when supported. */
export interface DeployGuidanceDTO {
  adminAddress: string;
  managerAddress: string;
  adminEqualsManager: boolean;
  networkDisplayName: string;
  networkIsTestnet: boolean;
  demoAutoMintEligible: boolean;
  demoMintComplianceIssues: Array<{
    warningId: string;
    moduleName: string;
    blocking: boolean;
    autoFixable: boolean;
  }>;
}

/**
 * App-local codegen service boundary (contract: codegen-service-contract).
 * UI interacts only with this interface; real and mock implementations are interchangeable.
 */
export interface RwaCodegenService {
  validate(config: RWAConfig): Promise<ValidationResultDTO>;
  /**
   * Returns structural compliance-module descriptors (ids, hooks, review
   * state, config field keys). UI prose is joined in the app layer via
   * `enrichAvailableModules`.
   */
  getAvailableModules(): Promise<StructuralComplianceModuleOption[]>;
  /**
   * Returns structural ecosystem metadata (ids, names, locks, defaults,
   * operator roles, hooks, limits). User-facing copy is joined from
   * `@openzeppelin/rwa-wizard-copy` in the app layer — codegen packages
   * omit field-level prose here; optional introductory copy uses
   * `getCodegenInfoBlurb` (CLI / UI).
   */
  getEcosystemMetadata?: () => StructuralEcosystemMetadata;
  /**
   * Optional introductory blurb: title, description, and reference links from
   * the ecosystem codegen package (same data can surface in CLI output or UI).
   */
  getCodegenInfoBlurb?: () => CodegenInfoBlurb;
  generateZip(config: RWAConfig, options?: GenerateArtifactOptions): Promise<GeneratedZipArtifact>;
  /**
   * Generate the in-memory project for `config`.
   * Uses the package `generate` / `generateWithIdentitySupport` toggle that
   * mirrors ZIP identity dispatch, with the same `buildGenerateOptions` merge.
   *
   * Throws `CodegenInvalidConfigError` when the package refuses the config.
   * Throws `CodegenGenerationError` for any other failure.
   * Throws `CodegenUnsupportedError` when the loaded package has no `generate`.
   *
   * Never returns a partial tree.
   */
  generateFileTree(
    config: RWAConfig,
    options?: GenerateArtifactOptions
  ): Promise<GeneratedFileTreeArtifact>;
  /** Optional post-generation deploy guidance when the target exposes deploy semantics. */
  getDeployGuidance?: (config: RWAConfig) => DeployGuidanceDTO;
  /** Structural compliance config warnings (copy joined in the app enrichment seam). */
  getComplianceConfigWarnings?: (
    config: RWAConfig,
    options?: { includeDemoCountryChecks?: boolean }
  ) => Array<{ id: string; relatedModuleIds: readonly string[] }>;
  /** Whether compliance + demo-mint config has blocking conflicts. */
  hasComplianceConfigBlockingIssues?: (
    config: RWAConfig,
    options?: { includeDemoCountryChecks?: boolean }
  ) => boolean;
  /** Whether demo auto-mint export is config-ready (testnet + initial supply + no blockers). */
  isDemoAutoMintConfigReady?: (config: RWAConfig) => boolean;
  /** Whether a compliance selection warning id blocks Generate / Next. */
  isComplianceConfigBlockingWarningId?: (id: string) => boolean;
  /** Whether the codegen package can emit dev/testnet identity scaffolding. */
  supportsIdentitySupport?: boolean;
}
