import type { RWAConfig } from '@openzeppelin/rwa-config';

export type ComplianceModuleCategoryId = string;

/**
 * Runtime data the token ecosystem must provide before a module can enforce
 * its rules (beyond deploy-time wiring).
 */
export type ComplianceModuleRuntimePrerequisiteId = string;

/**
 * Semantic input kinds for module configuration fields. Drives wizard form
 * widgets without embedding UI prose in codegen packages.
 */
export const COMPLIANCE_MODULE_CONFIG_VALUE_KINDS = ['address-list', 'country-code-list'] as const;

export type ComplianceModuleConfigValueKind = (typeof COMPLIANCE_MODULE_CONFIG_VALUE_KINDS)[number];

export interface ComplianceModuleCatalogSlice {
  id: string;
  category: ComplianceModuleCategoryId;
}

export type ComplianceModuleSelectionWarningId = string;

export interface ComplianceModuleSelectionWarning {
  id: ComplianceModuleSelectionWarningId;
  relatedModuleIds: readonly string[];
}

export type ComplianceModuleSelectionWarningRule =
  | { type: 'modules-selected-together'; id: string; moduleIds: readonly string[] }
  | { type: 'empty-config-when-selected'; id: string; moduleId: string; fieldKey: string }
  | { type: 'initial-supply-with-modules'; id: string }
  | {
      type: 'initial-supply-exceeds-module-scalar';
      id: string;
      moduleId: string;
      fieldKey: string;
    };

function hasModule(selectedIds: ReadonlySet<string>, moduleId: string): boolean {
  return selectedIds.has(moduleId);
}

function readStringArrayConfig(
  compliance: RWAConfig['compliance'],
  moduleId: string,
  fieldKey: string
): string[] {
  const selection = compliance.modules.find((entry) => entry.moduleId === moduleId);
  const value = selection?.config?.[fieldKey];
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry).trim()).filter((entry) => entry.length > 0);
  }
  if (typeof value === 'string') {
    return value
      .split(/[\n,]+/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }
  return [];
}

function readScalarConfigValue(
  compliance: RWAConfig['compliance'],
  moduleId: string,
  fieldKey: string
): string | undefined {
  const selection = compliance.modules.find((entry) => entry.moduleId === moduleId);
  const value = selection?.config?.[fieldKey];
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return undefined;
}

function evaluateSelectionWarningRule(
  rule: ComplianceModuleSelectionWarningRule,
  input: {
    compliance: RWAConfig['compliance'];
    initialSupply?: RWAConfig['token']['initialSupply'];
  },
  selected: ReadonlySet<string>,
  selectedModuleIds: readonly string[]
): ComplianceModuleSelectionWarning | null {
  switch (rule.type) {
    case 'modules-selected-together':
      if (rule.moduleIds.every((moduleId) => hasModule(selected, moduleId))) {
        return { id: rule.id, relatedModuleIds: rule.moduleIds };
      }
      return null;
    case 'empty-config-when-selected':
      if (hasModule(selected, rule.moduleId)) {
        const values = readStringArrayConfig(input.compliance, rule.moduleId, rule.fieldKey);
        if (values.length === 0) {
          return { id: rule.id, relatedModuleIds: [rule.moduleId] };
        }
      }
      return null;
    case 'initial-supply-with-modules':
      if (
        input.initialSupply !== undefined &&
        String(input.initialSupply).trim() !== '' &&
        selected.size > 0
      ) {
        return { id: rule.id, relatedModuleIds: [...selectedModuleIds] };
      }
      return null;
    case 'initial-supply-exceeds-module-scalar': {
      const initialSupply = input.initialSupply;
      if (initialSupply === undefined || String(initialSupply).trim() === '') {
        return null;
      }
      if (!hasModule(selected, rule.moduleId)) {
        return null;
      }
      const configuredLimit = readScalarConfigValue(input.compliance, rule.moduleId, rule.fieldKey);
      if (!configuredLimit) {
        return null;
      }
      try {
        if (BigInt(configuredLimit) < BigInt(initialSupply)) {
          return { id: rule.id, relatedModuleIds: [rule.moduleId] };
        }
      } catch {
        return null;
      }
      return null;
    }
    default: {
      const _exhaustive: never = rule;
      return _exhaustive;
    }
  }
}

/**
 * Evaluate selection warnings for the compliance step using ecosystem-provided rules.
 * Copy for each warning id lives in `@openzeppelin/rwa-wizard-copy`.
 */
export function evaluateComplianceSelectionWarnings(
  input: {
    compliance: RWAConfig['compliance'];
    initialSupply?: RWAConfig['token']['initialSupply'];
  },
  selectedModuleIds: readonly string[],
  rules: readonly ComplianceModuleSelectionWarningRule[]
): ComplianceModuleSelectionWarning[] {
  const selected = new Set(selectedModuleIds);
  const warnings: ComplianceModuleSelectionWarning[] = [];

  for (const rule of rules) {
    const warning = evaluateSelectionWarningRule(rule, input, selected, selectedModuleIds);
    if (warning) {
      warnings.push(warning);
    }
  }

  return warnings;
}

/**
 * Group catalog entries by category in the provided category order.
 */
export function groupComplianceModulesByCategory<T extends ComplianceModuleCatalogSlice>(
  modules: readonly T[],
  categoryOrder: readonly ComplianceModuleCategoryId[]
): Array<{ category: ComplianceModuleCategoryId; modules: T[] }> {
  const resolvedOrder =
    categoryOrder.length > 0 ? categoryOrder : [...new Set(modules.map((mod) => mod.category))];

  const byCategory = new Map<ComplianceModuleCategoryId, T[]>();
  for (const category of resolvedOrder) {
    byCategory.set(category, []);
  }
  for (const mod of modules) {
    const bucket = byCategory.get(mod.category);
    if (!bucket) {
      byCategory.set(mod.category, [mod]);
      continue;
    }
    bucket.push(mod);
  }
  return [...byCategory.entries()]
    .map(([category, groupedModules]) => ({
      category,
      modules: groupedModules,
    }))
    .filter((group) => group.modules.length > 0);
}
