import { describe, expect, it } from 'vitest';

import {
  getComplianceConfigWarnings,
  hasComplianceConfigBlockingIssues,
  isComplianceConfigBlockingWarningId,
  isDemoAutoMintConfigReady,
} from '../../src/templates/compliance-config-warnings';
import { createPresetDeploymentTarget, createValidConfig } from '../helpers/config';

describe('compliance config warnings', () => {
  it('merges module interaction rules with demo mint preflight issues', () => {
    const warnings = getComplianceConfigWarnings(
      createValidConfig({
        token: { initialSupply: '1000' },
        compliance: {
          modules: [
            { moduleId: 'country-allow' },
            { moduleId: 'country-restrict' },
            { moduleId: 'supply-limit', config: { limit: '100' } },
          ],
        },
      }),
      { includeDemoCountryChecks: true }
    );

    expect(warnings.map((warning) => warning.id)).toEqual(
      expect.arrayContaining([
        'country-allow-and-restrict',
        'initial-supply-exceeds-supply-limit',
        'demo-mint-country-not-allowed',
      ])
    );
  });

  it('blocks when supply limit is below initial supply', () => {
    const config = createValidConfig({
      token: { initialSupply: '500' },
      compliance: { modules: [{ moduleId: 'supply-limit', config: { limit: '100' } }] },
    });

    expect(hasComplianceConfigBlockingIssues(config)).toBe(true);
    expect(isComplianceConfigBlockingWarningId('initial-supply-exceeds-supply-limit')).toBe(true);
    expect(isComplianceConfigBlockingWarningId('initial-supply-compliance-reminder')).toBe(false);
    expect(isDemoAutoMintConfigReady(config)).toBe(false);
  });

  it('is demo auto-mint ready when limits accommodate initial supply', () => {
    const config = createValidConfig({
      token: { initialSupply: '500' },
      compliance: {
        modules: [
          { moduleId: 'supply-limit', config: { limit: '1000' } },
          { moduleId: 'max-balance', config: { maxBalance: '1000' } },
        ],
      },
    });

    expect(isDemoAutoMintConfigReady(config)).toBe(true);
  });

  it('does not gate demo auto-mint readiness when export is ineligible', () => {
    const config = createValidConfig({
      token: { initialSupply: undefined },
      compliance: {
        modules: [{ moduleId: 'supply-limit', config: { limit: '100' } }],
      },
    });

    expect(isDemoAutoMintConfigReady(config)).toBe(true);
  });

  it('ignores demo country blockers when includeDemoCountryChecks is false', () => {
    const config = createValidConfig({
      token: { initialSupply: '100' },
      deployment: { target: createPresetDeploymentTarget('stellar-public') },
      compliance: {
        modules: [{ moduleId: 'country-restrict', config: { restrictedCountries: ['CH'] } }],
      },
    });

    expect(hasComplianceConfigBlockingIssues(config, { includeDemoCountryChecks: false })).toBe(
      false
    );
    expect(hasComplianceConfigBlockingIssues(config, { includeDemoCountryChecks: true })).toBe(
      true
    );
  });
});
