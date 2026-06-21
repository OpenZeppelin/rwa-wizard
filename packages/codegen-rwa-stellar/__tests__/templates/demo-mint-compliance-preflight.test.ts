import { describe, expect, it } from 'vitest';

import {
  getDemoMintCompliancePreflightIssues,
  hasBlockingDemoMintComplianceIssues,
} from '../../src/templates/demo-mint-compliance-preflight';
import { createValidConfig } from '../helpers/config';

describe('demo mint compliance preflight', () => {
  it('flags supply-limit and max-balance below initialSupply', () => {
    const issues = getDemoMintCompliancePreflightIssues(
      createValidConfig({
        token: { initialSupply: '1000' },
        compliance: {
          modules: [
            { moduleId: 'supply-limit', config: { limit: '100' } },
            { moduleId: 'max-balance', config: { maxBalance: '50' } },
          ],
        },
      })
    );

    expect(issues).toHaveLength(2);
    expect(issues.map((issue) => issue.moduleId)).toEqual(['supply-limit', 'max-balance']);
    expect(issues.every((issue) => issue.autoFixable)).toBe(true);
    expect(issues.every((issue) => issue.hook === 'created')).toBe(true);
    expect(issues[0]?.suggestedInvoke?.functionName).toBe('set_supply_limit');
  });

  it('flags empty country allow-list for demo CH profile', () => {
    const issues = getDemoMintCompliancePreflightIssues(
      createValidConfig({
        token: { initialSupply: '100' },
        compliance: {
          modules: [{ moduleId: 'country-allow' }],
        },
      })
    );

    expect(issues).toHaveLength(1);
    expect(issues[0]?.moduleId).toBe('country-allow');
    expect(issues[0]?.suggestedInvoke?.functionName).toBe('batch_allow_countries');
  });

  it('treats country-restrict on CH as blocking', () => {
    const config = createValidConfig({
      token: { initialSupply: '100' },
      compliance: {
        modules: [{ moduleId: 'country-restrict', config: { restrictedCountries: ['CH'] } }],
      },
    });

    const issues = getDemoMintCompliancePreflightIssues(config);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.blocking).toBe(true);
    expect(issues[0]?.autoFixable).toBe(false);
    expect(hasBlockingDemoMintComplianceIssues(config)).toBe(true);
  });

  it('returns no issues when limits accommodate initialSupply', () => {
    const issues = getDemoMintCompliancePreflightIssues(
      createValidConfig({
        token: { initialSupply: '100' },
        compliance: {
          modules: [
            { moduleId: 'supply-limit', config: { limit: '1000' } },
            { moduleId: 'max-balance', config: { maxBalance: '1000' } },
          ],
        },
      })
    );

    expect(issues).toEqual([]);
  });
});
