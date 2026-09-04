import { describe, expect, it } from 'vitest';

import {
  getAvailableModules,
  getModuleById,
  getModuleDescriptorById,
} from '../../src/modules/registry';
import { shellSingleQuoteLiteral } from '../../src/templates/scripts/deploy-sh-helpers';

describe('Compliance Module Descriptors', () => {
  it('keeps internal deployment behavior out of the public registry surface', () => {
    for (const entry of getAvailableModules()) {
      expect(entry).not.toHaveProperty('deployment');
    }

    expect(getModuleById('supply-limit')).not.toHaveProperty('deployment');
  });

  it('stores IRS wiring requirements on each module descriptor', () => {
    expect(getModuleDescriptorById('max-balance')?.deployment.requiresIdentityRegistryStorage).toBe(
      true
    );
    expect(
      getModuleDescriptorById('supply-limit')?.deployment.requiresIdentityRegistryStorage
    ).toBe(false);
  });

  it('builds supply limit invocations from the module descriptor', () => {
    const invocations = getModuleDescriptorById(
      'supply-limit'
    )?.deployment.getConfigurationInvocations({
      moduleId: 'supply-limit',
      config: { limit: 1000 },
    });

    expect(invocations).toEqual([
      {
        functionName: 'set_supply_limit',
        args: '--token "$RWA_TOKEN_ADDRESS" --limit 1000 --operator "$MANAGER"',
      },
    ]);
  });

  it('serializes country restriction invocations through the descriptor', () => {
    const invocations = getModuleDescriptorById(
      'country-restrict'
    )?.deployment.getConfigurationInvocations({
      moduleId: 'country-restrict',
      config: { restrictedCountries: ['US', 'KP'] },
    });

    expect(invocations).toEqual([
      {
        functionName: 'batch_restrict_countries',
        args: `--token "$RWA_TOKEN_ADDRESS" --countries '[840, 408]' --operator "$MANAGER"`,
      },
    ]);
  });

  it('serializes time-transfer limit structs using the Stellar CLI JSON shape', () => {
    const invocations = getModuleDescriptorById(
      'time-transfers-limits'
    )?.deployment.getConfigurationInvocations({
      moduleId: 'time-transfers-limits',
      config: { limitDurationLedgers: 17280, limitValue: 25000 },
    });

    expect(invocations).toEqual([
      {
        functionName: 'set_time_transfer_limit',
        args: `--token "$RWA_TOKEN_ADDRESS" --limit '{"limit_duration": 17280, "limit_value": "25000"}' --operator "$MANAGER"`,
      },
    ]);
  });

  it('serializes transfer allow-list users through the descriptor', () => {
    const invocations = getModuleDescriptorById(
      'transfer-allow'
    )?.deployment.getConfigurationInvocations({
      moduleId: 'transfer-allow',
      config: { allowedUsers: ['GCALLOW1', 'GCALLOW2'] },
    });

    expect(invocations).toEqual([
      {
        functionName: 'batch_allow_users',
        args: `--token "$RWA_TOKEN_ADDRESS" --users '["GCALLOW1", "GCALLOW2"]' --operator "$MANAGER"`,
      },
    ]);
  });

  it('escapes single quotes in transfer allow-list users for shell-safe deploy.sh', () => {
    const malicious = "GC', echo PWNED; :'";
    const invocations = getModuleDescriptorById(
      'transfer-allow'
    )?.deployment.getConfigurationInvocations({
      moduleId: 'transfer-allow',
      config: { allowedUsers: [malicious] },
    });

    expect(invocations).toHaveLength(1);
    const args = invocations?.[0]?.args ?? '';
    const safeUsers = `'${shellSingleQuoteLiteral(`[${JSON.stringify(malicious)}]`)}'`;
    expect(args).toBe(`--token "$RWA_TOKEN_ADDRESS" --users ${safeUsers} --operator "$MANAGER"`);
    // Unescaped form would close the single-quoted --users argument mid-value.
    expect(args.includes(`--users '["GC', echo`)).toBe(false);
  });

  it('does not emit removed hook-wiring verification invocations', () => {
    expect(
      getModuleDescriptorById('supply-limit')?.deployment.getPostRegistrationInvocations?.({
        moduleId: 'supply-limit',
        config: { limit: 1000 },
      }) ?? []
    ).toEqual([]);
  });
});
