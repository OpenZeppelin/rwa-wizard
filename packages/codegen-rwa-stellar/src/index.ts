import type {
  GenerateOptions,
  GenerationResult,
  ValidationResult,
  ZipResult,
} from '@openzeppelin/codegen-core';
import { generateZip as coreGenerateZip } from '@openzeppelin/codegen-core';
import type { RWAConfig } from '@openzeppelin/rwa-config';

import type { ComplianceModuleRegistryEntry } from './modules/registry';
import { getAvailableModules as getModules } from './modules/registry';

import { sanitizeDirectoryName, StellarRwaGenerator } from './stellar-rwa-generator';

/**
 * Stellar/Soroban-specific validation constraints.
 *
 * Defines the numeric and string limits imposed by the Soroban runtime
 * and the `stellar-contracts` library (e.g., `symbol_short!` 9-char limit,
 * token name/symbol max lengths, decimal range). Each chain generator
 * defines its own constants — the config package stays chain-agnostic.
 *
 * @example
 * ```ts
 * import { STELLAR_VALIDATION_CONSTANTS } from '@openzeppelin/codegen-rwa-stellar';
 *
 * if (symbol.length > STELLAR_VALIDATION_CONSTANTS.TOKEN_SYMBOL_MAX_LENGTH) {
 *   // handle error
 * }
 * ```
 */
export { STELLAR_VALIDATION_CONSTANTS } from './constants';

/**
 * Auto-generate a Soroban-compatible role symbol from a human-readable role name.
 *
 * Uses well-known RWA role mappings (`manager`, `agent`, `operator`) first,
 * then falls back to: lowercase, strip non-alphanumeric, truncate to
 * Soroban's 9-char `symbol_short!` limit.
 *
 * @param name - The human-readable role name (e.g., `"Compliance Officer"`)
 * @returns A Soroban-compatible symbol string (e.g., `"complianc"`)
 *
 * @example
 * ```ts
 * import { generateRoleSymbol } from '@openzeppelin/codegen-rwa-stellar';
 *
 * generateRoleSymbol('manager');            // "manager"
 * generateRoleSymbol('Compliance Officer'); // "complianc"
 * ```
 */
export { generateRoleSymbol } from './constants';

/**
 * Internal Generator implementation — implements `Generator<RWAConfig>` from codegen-core.
 *
 * Most consumers should use the standalone `generate()`, `validate()`, and `generateZip()`
 * functions rather than instantiating this class directly.
 */
export { StellarRwaGenerator } from './stellar-rwa-generator';

/**
 * Metadata describing an available compliance module in the Stellar registry.
 *
 * Includes the module's unique ID, human-readable name, description,
 * the set of required hooks, review state, and config field descriptors.
 */
export type {
  ComplianceModuleRegistryEntry,
  ModuleReviewMeta,
  ModuleReviewState,
  ModuleConfigField,
} from './modules/registry';

export { getModuleById } from './modules/registry';

/**
 * Ecosystem metadata for Stellar/Soroban — operator roles, compliance hooks, and limits.
 *
 * Each codegen package exposes its own `getEcosystemMetadata()` so the wizard
 * UI can load ecosystem-specific constants through the service boundary
 * instead of importing them from the chain-agnostic config package.
 *
 * @example
 * ```ts
 * import { getEcosystemMetadata } from '@openzeppelin/codegen-rwa-stellar';
 *
 * const meta = getEcosystemMetadata();
 * console.log(meta.operatorRoles);   // Stellar operator roles
 * console.log(meta.complianceHooks); // Stellar compliance hooks
 * console.log(meta.limits);          // { maxModulesPerHook: 20, maxTrustedIssuers: 50 }
 * ```
 */
export { getEcosystemMetadata } from './ecosystem-metadata';

export type {
  StellarComplianceHook,
  StellarEcosystemMetadata,
  StellarAdminControlMeta,
  StellarOperatorRoleMeta,
  StellarComplianceHookMeta,
} from './ecosystem-metadata';

/**
 * Root configuration type for RWA token generation.
 *
 * Re-exported from `@openzeppelin/rwa-config` for consumer convenience.
 * Includes token parameters, identity verification setup, compliance module
 * selections, access control roles, and deployment target.
 */
export type { RWAConfig } from '@openzeppelin/rwa-config';

/**
 * Re-exported from `@openzeppelin/codegen-core` for consumer convenience.
 */
export type {
  GenerationResult,
  ValidationResult,
  GenerateOptions,
  ZipResult,
} from '@openzeppelin/codegen-core';

const generator = new StellarRwaGenerator();

/**
 * Generate a complete Stellar/Soroban RWA token project.
 *
 * Produces an in-memory file tree containing all 5 core contracts
 * (RWA Token, Compliance, Identity Verifier, CTI, IRS), workspace
 * Cargo.toml, build/deploy scripts, config.json, and README.md.
 * When compliance modules are selected, each module generates as
 * a separate crate under `contracts/modules/`.
 *
 * @param config - The RWA configuration describing the token project.
 * @param options - Optional generation options (e.g., progress callback).
 * @returns A `GenerationResult` containing the file tree and generation metadata.
 * @throws {Error} If the config is invalid. Use `validate()` first for graceful pre-flight checks.
 *
 * @example
 * ```ts
 * import { generate } from '@openzeppelin/codegen-rwa-stellar';
 *
 * const result = generate({
 *   token: { name: 'My Token', symbol: 'MTK', decimals: 18, documentManager: { enabled: true } },
 *   identityVerification: { claimTopics: [{ id: 1, name: 'KYC' }], trustedIssuers: [] },
 *   compliance: { modules: [] },
 *   accessControl: { ownership: { type: 'single-owner', ownerAddress: 'G...' }, roles: [] },
 *   deployment: {
 *     target: { kind: 'preset', ecosystem: 'stellar', networkId: 'stellar-testnet' },
 *   },
 * });
 *
 * console.log(Object.keys(result.files)); // file paths
 * ```
 */
export function generate(config: RWAConfig, options?: GenerateOptions): GenerationResult {
  return generator.generate(config, options);
}

/**
 * Validate an RWA configuration without generating output.
 *
 * Returns structured, machine-readable validation results with field paths
 * and error codes. Never throws — always returns a `ValidationResult`.
 * Errors block generation; warnings are advisory.
 *
 * @param config - The RWA configuration to validate.
 * @param options - Optional Stellar-specific options.
 * @returns A `ValidationResult` with `valid`, `errors`, and `warnings` fields.
 *
 * @example
 * ```ts
 * import { validate } from '@openzeppelin/codegen-rwa-stellar';
 *
 * const result = validate(config);
 * if (!result.valid) {
 *   for (const error of result.errors) {
 *     console.error(`${error.field}: [${error.code}] ${error.message}`);
 *   }
 * }
 * ```
 */
export function validate(config: RWAConfig, options?: GenerateOptions): ValidationResult {
  return generator.validate(config, options);
}

/**
 * Generate a Stellar/Soroban RWA token project as a ZIP archive.
 *
 * Convenience wrapper: calls `generate()` internally, then delegates to
 * codegen-core's `generateZip()` for ZIP assembly. The root directory
 * is derived from the token symbol (sanitized: lowercase, non-alphanumeric
 * replaced with hyphens, `-rwa` suffix appended).
 *
 * @param config - The RWA configuration describing the token project.
 * @param options - Optional settings including progress, local checkout, and review flags.
 * @returns A `ZipResult` containing the Blob data, fileName, and generation metadata.
 * @throws {Error} If the config is invalid.
 *
 * @example
 * ```ts
 * import { generateZip } from '@openzeppelin/codegen-rwa-stellar';
 *
 * const zip = await generateZip(config, {
 *   onProgress: (event) => console.log(`${event.phase}: ${event.percentage}%`),
 * });
 *
 * // zip.data is a Blob, zip.fileName is e.g. "acme-rwa.zip"
 * ```
 */
export async function generateZip(
  config: RWAConfig,
  options?: GenerateOptions
): Promise<ZipResult> {
  const result = generate(config, options);
  const dirName = sanitizeDirectoryName(config.token.symbol);

  return coreGenerateZip(result, dirName, { onProgress: options?.onProgress });
}

/**
 * Get the registry of available compliance modules for Stellar.
 *
 * Returns only modules with concrete implementations in the generator.
 * Each entry includes the module ID, human-readable name, description,
 * and required compliance hooks.
 *
 * @returns An array of `ComplianceModuleRegistryEntry` objects.
 *
 * @example
 * ```ts
 * import { getAvailableModules } from '@openzeppelin/codegen-rwa-stellar';
 *
 * const modules = getAvailableModules();
 * for (const mod of modules) {
 *   console.log(`${mod.id}: ${mod.description} (hooks: ${mod.requiredHooks.join(', ')})`);
 * }
 * ```
 */
export function getAvailableModules(): ComplianceModuleRegistryEntry[] {
  return getModules();
}
