import { countryAllowModule } from './descriptors/country-allow';
import { countryRestrictModule } from './descriptors/country-restrict';
import { initialLockupPeriodModule } from './descriptors/initial-lockup-period';
import { maxBalanceModule } from './descriptors/max-balance';
import { supplyLimitModule } from './descriptors/supply-limit';
import { timeTransfersLimitsModule } from './descriptors/time-transfers-limits';
import { transferRestrictModule } from './descriptors/transfer-restrict';

import type { ComplianceModuleDescriptor, ComplianceModuleRegistryEntry } from './types';

export type {
  ComplianceModuleRegistryEntry,
  ModuleConfigField,
  ModuleReviewMeta,
  ModuleReviewState,
} from './types';

const COMPLIANCE_MODULE_DESCRIPTORS: readonly ComplianceModuleDescriptor[] = [
  supplyLimitModule,
  maxBalanceModule,
  countryRestrictModule,
  countryAllowModule,
  transferRestrictModule,
  initialLockupPeriodModule,
  timeTransfersLimitsModule,
];

function toRegistryEntry(descriptor: ComplianceModuleDescriptor): ComplianceModuleRegistryEntry {
  const { deployment: _deployment, ...entry } = descriptor;
  return entry;
}

function cloneRegistryEntry(entry: ComplianceModuleRegistryEntry): ComplianceModuleRegistryEntry {
  return {
    ...entry,
    requiredHooks: [...entry.requiredHooks],
    review: { ...entry.review },
    configFields: entry.configFields.map((field) => ({ ...field })),
  };
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  Object.freeze(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      deepFreeze(item);
    }
    return value;
  }
  for (const key of Object.keys(value as object)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}

const registryEntries = COMPLIANCE_MODULE_DESCRIPTORS.map((descriptor) =>
  deepFreeze(toRegistryEntry(descriptor))
);

export const COMPLIANCE_MODULE_REGISTRY: readonly ComplianceModuleRegistryEntry[] =
  Object.freeze(registryEntries);

const descriptorById = new Map(COMPLIANCE_MODULE_DESCRIPTORS.map((entry) => [entry.id, entry]));
const registryById = new Map(COMPLIANCE_MODULE_REGISTRY.map((entry) => [entry.id, entry]));

/**
 * Return the set of registered module identifiers.
 */
export function getRegisteredModuleIds(): Set<string> {
  return new Set(descriptorById.keys());
}

/**
 * Look up a full module descriptor including internal deployment behavior.
 */
export function getModuleDescriptorById(id: string): ComplianceModuleDescriptor | undefined {
  return descriptorById.get(id);
}

/**
 * Look up a compliance module by identifier.
 */
export function getModuleById(id: string): ComplianceModuleRegistryEntry | undefined {
  const entry = registryById.get(id);
  return entry ? cloneRegistryEntry(entry) : undefined;
}

/**
 * Return the full compliance module catalog in stable declaration order.
 */
export function getAvailableModules(): ComplianceModuleRegistryEntry[] {
  return COMPLIANCE_MODULE_REGISTRY.map(cloneRegistryEntry);
}
