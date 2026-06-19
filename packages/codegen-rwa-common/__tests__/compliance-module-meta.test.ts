import { describe, expect, it } from 'vitest';

import type { ComplianceModuleSelectionWarningRule } from '../src/compliance-module-meta';
import {
  evaluateComplianceSelectionWarnings,
  groupComplianceModulesByCategory,
} from '../src/compliance-module-meta';

const SAMPLE_RULES = [
  {
    type: 'modules-selected-together',
    id: 'conflicting-modules',
    moduleIds: ['module-a', 'module-b'],
  },
  {
    type: 'empty-config-when-selected',
    id: 'module-c-empty-field',
    moduleId: 'module-c',
    fieldKey: 'allowedUsers',
  },
  {
    type: 'initial-supply-with-modules',
    id: 'initial-supply-warning',
  },
] as const satisfies readonly ComplianceModuleSelectionWarningRule[];

describe('evaluateComplianceSelectionWarnings', () => {
  it('warns when all modules in a together-rule are selected', () => {
    const warnings = evaluateComplianceSelectionWarnings(
      { compliance: { modules: [] } },
      ['module-a', 'module-b'],
      SAMPLE_RULES
    );
    expect(warnings.map((warning) => warning.id)).toContain('conflicting-modules');
  });

  it('warns when a selected module has an empty configured field', () => {
    const warnings = evaluateComplianceSelectionWarnings(
      { compliance: { modules: [{ moduleId: 'module-c' }] } },
      ['module-c'],
      SAMPLE_RULES
    );
    expect(warnings.map((warning) => warning.id)).toContain('module-c-empty-field');
  });

  it('warns when initial supply is set and modules are selected', () => {
    const warnings = evaluateComplianceSelectionWarnings(
      { compliance: { modules: [{ moduleId: 'module-x' }] }, initialSupply: '1000' },
      ['module-x'],
      SAMPLE_RULES
    );
    expect(warnings.map((warning) => warning.id)).toContain('initial-supply-warning');
  });
});

describe('groupComplianceModulesByCategory', () => {
  it('groups modules in the provided category order', () => {
    const grouped = groupComplianceModulesByCategory(
      [
        {
          id: 'module-b',
          category: 'category-b',
          runtimePrerequisites: [],
          requiredHooks: ['transferred'],
        },
        {
          id: 'module-a',
          category: 'category-a',
          runtimePrerequisites: [],
          requiredHooks: ['created', 'destroyed'],
        },
      ],
      ['category-a', 'category-b', 'category-c']
    );

    expect(grouped.map((group) => group.category)).toEqual(['category-a', 'category-b']);
  });
});
