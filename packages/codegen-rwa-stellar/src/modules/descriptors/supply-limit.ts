import {
  createModuleInvocation,
  defineComplianceModuleDescriptor,
  getOptionalScalarConfigValue,
} from './shared';

export const supplyLimitModule = defineComplianceModuleDescriptor({
  id: 'supply-limit',
  name: 'Supply Limit',
  category: 'supply-and-balance',
  runtimePrerequisites: [],
  requiredHooks: ['created', 'destroyed'],
  crateName: 'compliance-supply-limit',
  review: { state: 'stable' },
  configFields: [
    {
      key: 'limit',
      label: 'Supply Limit',
      type: 'number',
      required: true,
      placeholder: 'e.g. 1000000',
    },
  ],
  deployment: {
    requiresIdentityRegistryStorage: false,
    getConfigurationInvocations(selection) {
      const limit = getOptionalScalarConfigValue(selection, 'limit');
      return limit
        ? [
            createModuleInvocation(
              'set_supply_limit',
              `--token "$RWA_TOKEN_ADDRESS" --limit ${limit} --operator "$MANAGER"`
            ),
          ]
        : [];
    },
  },
});
