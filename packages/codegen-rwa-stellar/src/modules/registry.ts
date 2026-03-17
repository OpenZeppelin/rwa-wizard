import type { StellarComplianceHook } from '../ecosystem-metadata';

/**
 * Metadata for an available compliance module per data-model.md.
 *
 * `getAvailableModules()` only returns entries with concrete
 * implementations — no `implemented` flag is needed.
 */
export interface ComplianceModuleRegistryEntry {
  id: string;
  name: string;
  description: string;
  supportedHooks: StellarComplianceHook[];
}

/**
 * Full compliance module registry. Each entry describes a module that
 * the code generator knows how to produce. The contract templates are
 * stubs — actual compliance logic will be added when upstream
 * `stellar-contracts` ships concrete module implementations.
 */
export const COMPLIANCE_MODULE_REGISTRY: ComplianceModuleRegistryEntry[] = [
  {
    id: 'supply-cap',
    name: 'Supply Cap',
    description: 'Enforces a maximum total supply for the token',
    supportedHooks: ['canCreate'],
  },
  {
    id: 'max-balance',
    name: 'Max Balance',
    description: 'Limits the maximum token balance per wallet',
    supportedHooks: ['canTransfer', 'canCreate'],
  },
  {
    id: 'country-restrict',
    name: 'Country Restriction',
    description: 'Restricts transfers based on country jurisdiction',
    supportedHooks: ['canTransfer'],
  },
];

const registryById = new Map(COMPLIANCE_MODULE_REGISTRY.map((e) => [e.id, e]));

/**
 * Returns the set of all known module IDs for fast validation lookups.
 */
export function getRegisteredModuleIds(): Set<string> {
  return new Set(registryById.keys());
}

/**
 * Returns only modules with concrete implementations.
 *
 * Currently all registry entries are stub implementations, so this
 * returns the full registry. When some modules are deferred, filter
 * here to exclude unimplemented entries.
 */
export function getAvailableModules(): ComplianceModuleRegistryEntry[] {
  return [...COMPLIANCE_MODULE_REGISTRY];
}
