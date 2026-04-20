/**
 * @openzeppelin/codegen-core — Public API Contract
 *
 * This file defines the public interface surface of the core codegen engine.
 * It is the sole integration surface between the engine and any generator.
 * Generators implement `Generator<TConfig>` and produce `GenerationResult`.
 * The engine orchestrates validation, generation, and ZIP assembly.
 *
 * Primary exports (counted toward SC-007 ≤10 target):
 *   Types:    Generator, FileTree, ValidationResult, GenerationResult,
 *             ZipResult, ProgressCallback, GenerateOptions, ProgressPhase
 *   Functions: generateZip
 *   Constants: PROGRESS_PHASES
 *   Total: 10 primary exports
 *
 * Supporting types (not counted individually — sub-types of primary exports):
 *   ValidationError, ValidationWarning, GenerationMetadata, ProgressEvent
 */

// ---------------------------------------------------------------------------
// File Tree
// ---------------------------------------------------------------------------

/**
 * In-memory representation of a project's directory structure.
 * Keys are relative paths (e.g., "contracts/token/src/contract.rs").
 * Values are UTF-8 text content or binary data.
 */
export type FileTree = Record<string, string | Uint8Array>;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface ValidationError {
  /** Dot-path to the invalid field, e.g., "token.decimals" */
  field: string;
  /** Machine-readable error code, e.g., "INVALID_RANGE" */
  code: string;
  /** Human-readable description */
  message: string;
}

export interface ValidationWarning {
  field: string;
  code: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

export const PROGRESS_PHASES = [
  'validating',
  'generating-contracts',
  'generating-scripts',
  'generating-config',
  'generating-readme',
  'packaging',
  'success',
  'error',
] as const;

export type ProgressPhase = (typeof PROGRESS_PHASES)[number];

export interface ProgressEvent {
  /** Current pipeline phase */
  phase: ProgressPhase;
  /** Completion percentage (0–100) */
  percentage: number;
  /** Optional detail message */
  message?: string;
}

export type ProgressCallback = (event: ProgressEvent) => void;

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

export interface GenerateOptions {
  onProgress?: ProgressCallback;
  /**
   * Absolute path to a local checkout of the upstream contracts library.
   * When set, generators resolve contract dependencies via local `path = "…"`
   * instead of a pinned git revision. Useful during development against
   * unmerged branches of the contracts repo.
   */
  contractsLibraryPath?: string;
  /**
   * Allow modules whose review state is not yet "stable".
   * When false (the default), generators should reject or warn about
   * modules that are still under review.
   */
  allowUnderReviewModules?: boolean;
}

export interface GenerationMetadata {
  generatorName: string;
  generatorVersion: string;
  generatedAt: string;
  fileCount: number;
  configHash: string;
}

export interface GenerationResult {
  files: FileTree;
  metadata: GenerationMetadata;
}

export interface ZipResult {
  data: Blob;
  fileName: string;
  metadata: GenerationMetadata;
}

// ---------------------------------------------------------------------------
// Generator Interface — the sole extensibility contract
// ---------------------------------------------------------------------------

/**
 * The interface that all generators must implement.
 *
 * A generator knows how to:
 * 1. Validate a domain-specific configuration
 * 2. Produce an in-memory file tree from that configuration
 *
 * The core engine handles everything else: ZIP assembly, progress
 * orchestration, and pipeline coordination.
 *
 * @typeParam TConfig - The configuration type this generator accepts.
 *                      For RWA generators, this is RWAConfig.
 */
export interface Generator<TConfig = unknown> {
  readonly name: string;
  readonly version: string;

  /** Validate a configuration without generating output. */
  validate(config: TConfig): ValidationResult;

  /** Generate the file tree from a validated configuration. */
  generate(config: TConfig, options?: GenerateOptions): GenerationResult;
}

// ---------------------------------------------------------------------------
// Core Engine Functions
// ---------------------------------------------------------------------------

/**
 * Package a GenerationResult into a ZIP archive.
 *
 * This is a standalone function (not on Generator) because ZIP assembly
 * is a cross-cutting concern owned by the core engine, not by generators.
 *
 * Note: Generator packages (e.g., codegen-rwa-stellar) typically wrap this
 * in a convenience function that accepts a config and calls generate() + generateZip()
 * in one step. The core engine's generateZip() accepts a pre-built GenerationResult,
 * keeping the engine decoupled from any specific config type.
 */
export declare function generateZip(
  result: GenerationResult,
  fileName: string,
  options?: { onProgress?: ProgressCallback }
): Promise<ZipResult>;
