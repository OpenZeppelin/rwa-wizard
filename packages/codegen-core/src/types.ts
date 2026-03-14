/**
 * Core types for the codegen engine.
 *
 * These types define the extensibility contract between the engine
 * and any generator implementation. No chain-specific or domain-specific
 * assumptions are made here.
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
  /** Machine-readable error code (uppercase snake_case), e.g., "INVALID_RANGE" */
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

/**
 * Canonical pipeline phase strings used by codegen packages.
 * Generators and the core pipeline must use these values so consumers can map consistently.
 */
export const PROGRESS_PHASES = [
  'validating',
  'generating-contracts',
  'generating-scripts',
  'packaging',
  'assembling-zip',
  'complete',
  'error',
] as const;

export type ProgressPhase = (typeof PROGRESS_PHASES)[number];

/**
 * UI-friendly summary phases for progress display.
 * Use toSummaryPhase() to map ProgressPhase to SummaryPhase.
 */
export type SummaryPhase = 'validating' | 'generating' | 'packaging' | 'success' | 'error';

export interface ProgressEvent {
  /** Current pipeline phase (canonical ProgressPhase). */
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
}

export interface GenerationMetadata {
  generatorName: string;
  generatorVersion: string;
  generatedAt: string;
  fileCount: number;
  /** SHA-256 of JSON.stringify(config) with keys sorted alphabetically */
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
// Generator Interface
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
 */
export interface Generator<TConfig = unknown> {
  readonly name: string;
  readonly version: string;

  /** Validate a configuration without generating output. */
  validate(config: TConfig): ValidationResult;

  /** Generate the file tree from a validated configuration. */
  generate(config: TConfig, options?: GenerateOptions): GenerationResult;
}
