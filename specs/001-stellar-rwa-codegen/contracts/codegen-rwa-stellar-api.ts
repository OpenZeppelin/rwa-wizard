/**
 * @openzeppelin/codegen-rwa-stellar — Public API Contract
 *
 * This file defines the public interface surface of the Stellar RWA
 * generator package. It implements the core engine's Generator interface
 * and re-exports the RWAConfig type.
 *
 * Primary exports (counted toward SC-007 ≤10 target):
 *   Functions:  generate, generateZip, validate, getAvailableModules, generateRoleSymbol
 *   Types:      ComplianceModuleRegistryEntry
 *   Constants:  STELLAR_VALIDATION_CONSTANTS
 *   Total: 7 primary exports
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
import type { ComplianceHook, RWAConfig } from './rwa-config-api';

// ---------------------------------------------------------------------------
// Compliance Module Registry
// ---------------------------------------------------------------------------

export interface ComplianceModuleRegistryEntry {
  /** Unique identifier, e.g., "supply-cap" */
  id: string;
  /** Human-readable name, e.g., "Supply Cap" */
  name: string;
  /** Short description of the module's purpose */
  description: string;
  /** Which compliance hooks this module can attach to */
  supportedHooks: ComplianceHook[];
}
// Note: getAvailableModules() only returns entries with concrete implementations.
// An `implemented` flag is unnecessary since unimplemented modules are never exposed.

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
 * Only returns modules with concrete implementations.
 */
export declare function getAvailableModules(): ComplianceModuleRegistryEntry[];

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
  /** Soroban i128 max value */
  I128_MAX: bigint;
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
