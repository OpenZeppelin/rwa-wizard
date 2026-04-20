import { describe, expect, it } from 'vitest';

import type { ComplianceModuleSelection } from '@openzeppelin/rwa-config';

import {
  formatModuleConfigSummary,
  formatModuleConfigValue,
  formatModuleReviewSummary,
  getSelectedModuleSummaries,
  getUniqueModuleSelections,
  getUnderReviewModules,
  type ModuleSummarySource,
} from '../src/module-summary';

const MODULES: Record<string, ModuleSummarySource> = {
  'country-allow': {
    id: 'country-allow',
    name: 'Country Allow-list',
    requiredHooks: ['canTransfer'],
    configFields: [{ key: 'allowedCountries' }],
    review: { state: 'under-review', prUrl: 'https://github.com/OpenZeppelin/example/pull/1' },
  },
  'supply-limit': {
    id: 'supply-limit',
    name: 'Supply Limit',
    requiredHooks: ['canCreate', 'created', 'destroyed'],
    configFields: [{ key: 'limit' }],
    review: { state: 'stable' },
  },
};

function resolveModule(moduleId: string): ModuleSummarySource | undefined {
  return MODULES[moduleId];
}

describe('module summary helpers', () => {
  describe('getUniqueModuleSelections', () => {
    it('deduplicates by moduleId while keeping first-seen order', () => {
      const selections: ComplianceModuleSelection[] = [
        { moduleId: 'supply-limit', config: { limit: 1000000 } },
        { moduleId: 'country-allow', config: { allowedCountries: ['CH'] } },
        { moduleId: 'supply-limit', config: { limit: 999 } },
      ];

      expect(getUniqueModuleSelections(selections)).toEqual([
        { moduleId: 'supply-limit', config: { limit: 1000000 } },
        { moduleId: 'country-allow', config: { allowedCountries: ['CH'] } },
      ]);
    });
  });

  describe('formatModuleConfigValue', () => {
    it('formats arrays and objects into compact strings', () => {
      expect(formatModuleConfigValue(['CH', 'SG'])).toBe('CH, SG');
      expect(formatModuleConfigValue({ limit: 10 })).toBe('{"limit":10}');
    });
  });

  describe('formatModuleConfigSummary', () => {
    it('orders preferred keys first and drops empty values', () => {
      expect(
        formatModuleConfigSummary(
          {
            zeta: 'tail',
            allowedCountries: ['CH', 'SG'],
            emptyString: '   ',
            emptyArray: [],
            nested: { limit: 10 },
          },
          ['allowedCountries']
        )
      ).toBe('`allowedCountries=CH, SG`, `nested={"limit":10}`, `zeta=tail`');
    });

    it('returns None when nothing renderable remains', () => {
      expect(
        formatModuleConfigSummary(
          {
            emptyString: '',
            emptyArray: [],
            missing: undefined,
          },
          []
        )
      ).toBe('None');
    });
  });

  describe('formatModuleReviewSummary', () => {
    it('formats stable and under-review states', () => {
      expect(formatModuleReviewSummary({ state: 'stable' })).toBe('Stable');
      expect(
        formatModuleReviewSummary({
          state: 'under-review',
          prUrl: 'https://github.com/OpenZeppelin/example/pull/1',
        })
      ).toBe('Under review ([PR](https://github.com/OpenZeppelin/example/pull/1))');
    });
  });

  describe('getSelectedModuleSummaries', () => {
    it('deduplicates selections and builds display-ready module summaries', () => {
      const selections: ComplianceModuleSelection[] = [
        { moduleId: 'supply-limit', config: { limit: 1000000 } },
        { moduleId: 'country-allow', config: { allowedCountries: ['CH', 'SG'] } },
        { moduleId: 'supply-limit', config: { limit: 999 } },
      ];

      expect(getSelectedModuleSummaries(selections, resolveModule)).toEqual([
        {
          id: 'supply-limit',
          name: 'Supply Limit',
          hooks: ['canCreate', 'created', 'destroyed'],
          configSummary: '`limit=1000000`',
          reviewSummary: 'Stable',
        },
        {
          id: 'country-allow',
          name: 'Country Allow-list',
          hooks: ['canTransfer'],
          configSummary: '`allowedCountries=CH, SG`',
          reviewSummary: 'Under review ([PR](https://github.com/OpenZeppelin/example/pull/1))',
        },
      ]);
    });

    it('skips unknown module ids', () => {
      expect(
        getSelectedModuleSummaries([{ moduleId: 'missing-module' }], resolveModule)
      ).toEqual([]);
    });
  });

  describe('getUnderReviewModules', () => {
    it('returns unique under-review module notices only', () => {
      const selections: ComplianceModuleSelection[] = [
        { moduleId: 'country-allow' },
        { moduleId: 'country-allow' },
        { moduleId: 'supply-limit' },
      ];

      expect(getUnderReviewModules(selections, resolveModule)).toEqual([
        {
          id: 'country-allow',
          name: 'Country Allow-list',
          prUrl: 'https://github.com/OpenZeppelin/example/pull/1',
        },
      ]);
    });
  });
});
