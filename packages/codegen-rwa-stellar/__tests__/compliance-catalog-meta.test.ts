import { describe, expect, it } from 'vitest';

import { evaluateComplianceSelectionWarnings } from '@openzeppelin/codegen-rwa-common';

import { createValidConfig } from './helpers/config';

import {
  STELLAR_COMPLIANCE_MODULE_CATEGORIES,
  STELLAR_COMPLIANCE_RUNTIME_PREREQUISITES,
  STELLAR_COMPLIANCE_SELECTION_WARNING_RULES,
} from '../src/compliance-catalog-meta';
import { getEcosystemMetadata } from '../src/ecosystem-metadata';
import { getComplianceConfigWarnings } from '../src/templates/compliance-config-warnings';

describe('STELLAR_COMPLIANCE_MODULE_CATEGORIES', () => {
  it('lists the Stellar catalog category ids in display order', () => {
    expect(STELLAR_COMPLIANCE_MODULE_CATEGORIES).toEqual([
      'supply-and-balance',
      'jurisdiction',
      'access-and-velocity',
    ]);
  });
});

describe('STELLAR_COMPLIANCE_RUNTIME_PREREQUISITES', () => {
  it('declares identity registry as a runtime prerequisite', () => {
    expect(STELLAR_COMPLIANCE_RUNTIME_PREREQUISITES).toEqual(['identity-registry']);
  });
});

describe('STELLAR_COMPLIANCE_SELECTION_WARNING_RULES', () => {
  it('warns when country allow and restrict are selected together', () => {
    const warnings = evaluateComplianceSelectionWarnings(
      { compliance: { modules: [] } },
      ['country-allow', 'country-restrict'],
      STELLAR_COMPLIANCE_SELECTION_WARNING_RULES
    );
    expect(warnings.map((warning) => warning.id)).toContain('country-allow-and-restrict');
  });

  it('warns when transfer allow is selected without allowed users', () => {
    const warnings = evaluateComplianceSelectionWarnings(
      { compliance: { modules: [{ moduleId: 'transfer-allow' }] } },
      ['transfer-allow'],
      STELLAR_COMPLIANCE_SELECTION_WARNING_RULES
    );
    expect(warnings.map((warning) => warning.id)).toContain('transfer-allow-empty-list');
  });

  it('surfaces supply-limit conflicts via compliance config warnings', () => {
    const warnings = getComplianceConfigWarnings(
      createValidConfig({
        token: { initialSupply: '1000' },
        compliance: { modules: [{ moduleId: 'supply-limit', config: { limit: '100' } }] },
      }),
      { includeDemoCountryChecks: false }
    );
    expect(warnings.map((warning) => warning.id)).toContain('initial-supply-exceeds-supply-limit');
  });
});

describe('getEcosystemMetadata', () => {
  it('includes the Stellar compliance catalog metadata', () => {
    const metadata = getEcosystemMetadata();
    expect(metadata.complianceCatalog.moduleCategories).toEqual(
      STELLAR_COMPLIANCE_MODULE_CATEGORIES
    );
    expect(metadata.complianceCatalog.selectionWarningRules).toEqual(
      STELLAR_COMPLIANCE_SELECTION_WARNING_RULES
    );
  });
});
