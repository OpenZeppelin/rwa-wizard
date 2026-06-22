import type { ComplianceModuleSelectionWarningRule } from '@openzeppelin/codegen-rwa-common';

/**
 * Canonical module category ids for the Stellar compliance catalog UI.
 */
export const STELLAR_COMPLIANCE_MODULE_CATEGORIES = [
  'supply-and-balance',
  'jurisdiction',
  'access-and-velocity',
] as const;

export type StellarComplianceModuleCategoryId =
  (typeof STELLAR_COMPLIANCE_MODULE_CATEGORIES)[number];

/**
 * Runtime prerequisites Stellar modules may declare beyond deploy-time wiring.
 */
export const STELLAR_COMPLIANCE_RUNTIME_PREREQUISITES = ['identity-registry'] as const;

export type StellarComplianceModuleRuntimePrerequisiteId =
  (typeof STELLAR_COMPLIANCE_RUNTIME_PREREQUISITES)[number];

export const STELLAR_COMPLIANCE_SELECTION_WARNING_RULES = [
  {
    type: 'modules-selected-together',
    id: 'country-allow-and-restrict',
    moduleIds: ['country-allow', 'country-restrict'],
  },
  {
    type: 'empty-config-when-selected',
    id: 'transfer-allow-empty-list',
    moduleId: 'transfer-allow',
    fieldKey: 'allowedUsers',
  },
] as const satisfies readonly ComplianceModuleSelectionWarningRule[];
