import { describe, expect, it } from 'vitest';

import {
  getAvailableModules,
  getModuleById,
  getModuleDescriptorById,
} from '../../src/modules/registry';

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
    expect(getModuleDescriptorById('supply-limit')?.deployment.requiresIdentityRegistryStorage).toBe(
      false
    );
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
        args: '--token "$RWA_TOKEN_ADDRESS" --limit 1000',
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
        args: `--token "$RWA_TOKEN_ADDRESS" --countries '[840, 408]'`,
      },
    ]);
  });

  it('returns no configuration invocations for modules without post-deploy config', () => {
    const invocations = getModuleDescriptorById(
      'transfer-restrict'
    )?.deployment.getConfigurationInvocations({
      moduleId: 'transfer-restrict',
    });

    expect(invocations).toEqual([]);
  });
});
