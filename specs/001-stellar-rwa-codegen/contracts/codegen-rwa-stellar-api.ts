/**
 * @openzeppelin/codegen-rwa-stellar — Public API Contract
 *
 * This file defines the public interface surface of the Stellar RWA
 * generator package. It implements the core engine's Generator interface
 * and re-exports the RWAConfig type.
 *
 * Primary exports (counted toward SC-007 ≤10 target):
 *   Functions: generate, generateZip, validate, getAvailableModules
 *   Types:     ComplianceModuleRegistryEntry
 *   Total: 5 primary exports
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
// Re-exports for consumer convenience
// ---------------------------------------------------------------------------

export type { RWAConfig, GenerationResult, ZipResult, ValidationResult, GenerateOptions };
