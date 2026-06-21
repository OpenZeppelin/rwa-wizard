import { describe, expect, it } from 'vitest';

import { createValidConfig } from './helpers/config';

import {
  formatDeployPostGenerationSteps,
  formatDeployReadinessChecklist,
  getConfiguredAccessControlRows,
  getDeployGuidance,
} from '../src/templates/deploy-guidance';

describe('deploy guidance', () => {
  it('surfaces configured admin and manager addresses', () => {
    const config = createValidConfig();
    const guidance = getDeployGuidance(config);

    expect(guidance.adminAddress).toBe('GCEXAMPLEOWNER');
    expect(guidance.managerAddress).toBe('GCEXAMPLEMGR');
    expect(guidance.adminEqualsManager).toBe(false);
    expect(guidance.networkDisplayName).toBe('Stellar Testnet');
    expect(guidance.networkIsTestnet).toBe(true);
    expect(guidance.demoAutoMintEligible).toBe(true);
    expect(guidance.demoMintComplianceIssues).toEqual([]);
  });

  it('surfaces demo mint compliance preflight issues in deploy guidance', () => {
    const guidance = getDeployGuidance(
      createValidConfig({
        token: { initialSupply: '1000' },
        compliance: {
          modules: [{ moduleId: 'supply-limit', config: { limit: '100' } }],
        },
      })
    );

    expect(guidance.demoMintComplianceIssues).toHaveLength(1);
    expect(guidance.demoMintComplianceIssues[0]?.warningId).toBe(
      'initial-supply-exceeds-supply-limit'
    );
    expect(guidance.demoMintComplianceIssues[0]?.moduleName).toBe('Supply Limit');
  });

  it('formats post-generation steps with demo bootstrap when eligible', () => {
    const guidance = getDeployGuidance(createValidConfig());
    const steps = formatDeployPostGenerationSteps(guidance);

    expect(steps.join('\n')).toContain('bootstrap-demo-mint.sh');
  });

  it('formats post-generation steps without alice placeholder', () => {
    const guidance = getDeployGuidance(createValidConfig());
    const steps = formatDeployPostGenerationSteps(guidance);

    expect(steps.join('\n')).toContain('GCEXAMPLEOWNER');
    expect(steps.join('\n')).toContain('--preflight');
    expect(steps.join('\n')).not.toContain('alice');
  });

  it('builds readiness checklist for wizard review step', () => {
    const config = createValidConfig();
    const items = formatDeployReadinessChecklist(config, getDeployGuidance(config));

    expect(items.some((item) => item.includes('GCEXAMPLEOWNER'))).toBe(true);
    expect(items.some((item) => item.includes('build.sh'))).toBe(true);
  });

  it('lists configured access control rows for README table', () => {
    const rows = getConfiguredAccessControlRows(createValidConfig());

    expect(rows.some((row) => row.role === 'Admin' && row.address === 'GCEXAMPLEOWNER')).toBe(true);
    expect(rows.some((row) => row.role === 'Manager (deploy/post-deploy)')).toBe(true);
    expect(rows.some((row) => row.role === 'Agent')).toBe(true);
  });

  it('documents additional manager addresses as config-only until manually granted', () => {
    const rows = getConfiguredAccessControlRows(
      createValidConfig({
        accessControl: {
          ownership: { type: 'single-owner', ownerAddress: 'GCEXAMPLEOWNER' },
          roles: [
            {
              name: 'Manager',
              symbol: 'manager',
              addresses: ['GCMANAGER1', 'GCMANAGER2'],
            },
          ],
        },
      })
    );

    const additional = rows.find((row) => row.role === 'Manager (additional)');
    expect(additional?.address).toBe('GCMANAGER2');
    expect(additional?.note).toContain('grant additional managers manually');
    expect(additional?.note).not.toContain('Granted on-chain at deploy');
  });
});
