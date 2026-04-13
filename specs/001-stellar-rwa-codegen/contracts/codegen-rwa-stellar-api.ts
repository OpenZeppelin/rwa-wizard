/**
 * @openzeppelin/codegen-rwa-stellar — Public API Contract
 *
 * This file defines the public interface surface of the Stellar RWA
 * generator package. It implements the core engine's Generator interface
 * and re-exports the RWAConfig type.
 *
 * Primary exports (counted toward SC-007 ≤10 target):
 *   Functions:  generate, generateZip, validate, getAvailableModules, getModuleById, generateRoleSymbol
 *   Types:      ComplianceModuleRegistryEntry, ModuleReviewMeta, ModuleConfigField
 *   Constants:  STELLAR_VALIDATION_CONSTANTS
 *   Total: 10 primary exports
 *
 * Re-exports (not counted — passthrough from upstream packages):
 *   RWAConfig from @openzeppelin/rwa-config
 *   GenerationResult, ZipResult, ValidationResult, GenerateOptions
 *   from @openzeppelin/codegen-core
 */

import type {
  GenerateOptions,
  GenerationResult,
  ProgressCallback,
  ValidationResult,
  ZipResult,
} from './codegen-core-api';
import type { RWAConfig } from './rwa-config-api';

// ---------------------------------------------------------------------------
// Stellar-specific compliance hook type
// ---------------------------------------------------------------------------

/**
 * The 5 compliance hooks in the Stellar/Soroban `ComplianceHook` enum.
 * Maps 1:1 to the Rust `ComplianceHook` variants in `stellar-contracts`.
 */
export type StellarComplianceHook =
  | 'canTransfer'
  | 'canCreate'
  | 'transferred'
  | 'created'
  | 'destroyed';

// ---------------------------------------------------------------------------
// Compliance Module Registry
// ---------------------------------------------------------------------------

export type ModuleReviewState = 'stable' | 'under-review';

export interface ModuleReviewMeta {
  state: ModuleReviewState;
  prUrl?: string;
}

export interface ModuleConfigField {
  key: string;
  label: string;
  type: 'string' | 'number' | 'string[]';
  required: boolean;
  placeholder?: string;
  hint?: string;
}

export interface ComplianceModuleRegistryEntry {
  /** Unique identifier, e.g., "supply-limit" */
  id: string;
  /** Human-readable name, e.g., "Supply Limit" */
  name: string;
  /** Short description of the module's purpose */
  description: string;
  /** Which compliance hooks this module requires (Stellar-specific values) */
  requiredHooks: StellarComplianceHook[];
  /** Crate name in the stellar-contracts library */
  crateName: string;
  /** Review status of the upstream implementation */
  review: ModuleReviewMeta;
  /** Typed configuration fields the module accepts/requires */
  configFields: ModuleConfigField[];
}

// ---------------------------------------------------------------------------
// Public API Functions
// ---------------------------------------------------------------------------

/**
 * Validate an RWA configuration without generating output.
 * Returns structured, machine-readable validation results.
 */
export declare function validate(config: RWAConfig): ValidationResult;

/**
 * Generate a complete Stellar/Soroban RWA token project.
 * Returns the raw in-memory file tree (first-class public API output).
 *
 * @throws {Error} If the config is invalid. Use validate() first for graceful pre-flight checks.
 */
export declare function generate(config: RWAConfig, options?: GenerateOptions): GenerationResult;

/**
 * Generate a Stellar/Soroban RWA token project as a ZIP archive.
 *
 * Convenience wrapper: calls generate() internally, then delegates to
 * codegen-core's generateZip() for ZIP assembly. Accepts an RWAConfig
 * directly (unlike codegen-core's generateZip which takes a GenerationResult).
 */
export declare function generateZip(
  config: RWAConfig,
  options?: { onProgress?: ProgressCallback }
): Promise<ZipResult>;

/**
 * Get the registry of available compliance modules for Stellar.
 * Includes all modules with implementations (both stable and under-review).
 * Each entry includes requiredHooks, review state, and configFields.
 */
export declare function getAvailableModules(): ComplianceModuleRegistryEntry[];

/**
 * Look up a single module by its registry identifier.
 * Returns undefined if not found.
 */
export declare function getModuleById(id: string): ComplianceModuleRegistryEntry | undefined;

// ---------------------------------------------------------------------------
// Stellar-Specific Validation Constants
// ---------------------------------------------------------------------------

/**
 * Validation constraints specific to the Stellar/Soroban runtime.
 *
 * Each generator package defines its own validation constants reflecting
 * chain-specific limits (e.g., Soroban's symbol_short! 9-char limit,
 * i128 numeric range). The config package (@openzeppelin/rwa-config)
 * intentionally does NOT define these — it stays chain-agnostic.
 */
export declare const STELLAR_VALIDATION_CONSTANTS: {
  TOKEN_NAME_MAX_LENGTH: 32;
  TOKEN_SYMBOL_MAX_LENGTH: 12;
  DECIMALS_MIN: 0;
  DECIMALS_MAX: 18;
  /** Soroban `symbol_short!` macro limit */
  ROLE_SYMBOL_MAX_LENGTH: 9;
  // NOTE: I128_MAX is intentionally NOT here. It should be defined locally
  // inside the validation module (e.g. stellar-rwa-validator.ts) where it's
  // used, not as a shared constant. This avoids exporting an implementation
  // detail that only matters during config validation.
};

/**
 * Auto-generate a Soroban-compatible role symbol from a role name.
 * Uses well-known RWA role mappings, then falls back to lowercase +
 * strip non-alphanumeric + truncate to Soroban's 9-char limit.
 */
export declare function generateRoleSymbol(name: string): string;

// ---------------------------------------------------------------------------
// Re-exports for consumer convenience
// ---------------------------------------------------------------------------

export type { RWAConfig, GenerationResult, ZipResult, ValidationResult, GenerateOptions };
