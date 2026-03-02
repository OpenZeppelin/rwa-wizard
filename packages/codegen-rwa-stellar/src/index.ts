import type {
  GenerateOptions,
  GenerationResult,
  ProgressCallback,
  ValidationResult,
  ZipResult,
} from '@openzeppelin/codegen-core';
import { generateZip as coreGenerateZip } from '@openzeppelin/codegen-core';
import type { RWAConfig } from '@openzeppelin/rwa-config';

import type { ComplianceModuleRegistryEntry } from './modules/registry';
import { getAvailableModules as getModules } from './modules/registry';

import { sanitizeDirectoryName, StellarRwaGenerator } from './stellar-rwa-generator';

export { STELLAR_VALIDATION_CONSTANTS, generateRoleSymbol } from './constants';

export { StellarRwaGenerator } from './stellar-rwa-generator';

export type { ComplianceModuleRegistryEntry } from './modules/registry';

export type { RWAConfig } from '@openzeppelin/rwa-config';

export type {
  GenerationResult,
  ValidationResult,
  GenerateOptions,
  ZipResult,
} from '@openzeppelin/codegen-core';

const generator = new StellarRwaGenerator();

/**
 * Generate a complete Stellar/Soroban RWA token project.
 * Returns the raw in-memory file tree.
 *
 * @throws {Error} If the config is invalid.
 */
export function generate(config: RWAConfig, options?: GenerateOptions): GenerationResult {
  return generator.generate(config, options);
}

/**
 * Validate an RWA configuration without generating output.
 * Returns structured, machine-readable validation results per SR-017.
 * Never throws — always returns a ValidationResult.
 */
export function validate(config: RWAConfig): ValidationResult {
  return generator.validate(config);
}

/**
 * Generate a Stellar/Soroban RWA token project as a ZIP archive.
 *
 * Convenience wrapper: calls generate() internally, then delegates to
 * codegen-core's generateZip() for ZIP assembly. The root directory
 * is derived from the token symbol (sanitized + `-rwa` suffix).
 */
export async function generateZip(
  config: RWAConfig,
  options?: { onProgress?: ProgressCallback }
): Promise<ZipResult> {
  const result = generate(config);
  const dirName = sanitizeDirectoryName(config.token.symbol);

  return coreGenerateZip(result, dirName, options);
}

/**
 * Get the registry of available compliance modules for Stellar.
 * Only returns modules with concrete implementations.
 */
export function getAvailableModules(): ComplianceModuleRegistryEntry[] {
  return getModules();
}
