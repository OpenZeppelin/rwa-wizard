import type { GenerateOptions, GenerationResult } from '@openzeppelin/codegen-core';
import type { RWAConfig } from '@openzeppelin/rwa-config';

import { StellarRwaGenerator } from './stellar-rwa-generator';

export { STELLAR_VALIDATION_CONSTANTS, generateRoleSymbol } from './constants';

export { StellarRwaGenerator } from './stellar-rwa-generator';

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
 * Returns structured, machine-readable validation results.
 */
export function validate(config: RWAConfig) {
  return generator.validate(config);
}
