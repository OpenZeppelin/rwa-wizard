import {
  createModuleInvocation,
  defineComplianceModuleDescriptor,
  getOptionalScalarConfigValue,
} from './shared';

export const maxBalanceModule = defineComplianceModuleDescriptor({
  id: 'max-balance',
  name: 'Max Balance',
  requiredHooks: ['transferred', 'created', 'destroyed'],
  crateName: 'compliance-max-balance',
  review: { state: 'stable' },
  configFields: [
    {
      key: 'maxBalance',
      label: 'Max Balance',
      type: 'number',
      required: true,
      placeholder: 'e.g. 50000',
    },
  ],
  deployment: {
    requiresIdentityRegistryStorage: true,
    getConfigurationInvocations(selection) {
      const maxBalance = getOptionalScalarConfigValue(selection, 'maxBalance');
      return maxBalance
        ? [
            createModuleInvocation(
              'set_max_balance',
              `--token "$RWA_TOKEN_ADDRESS" --max ${maxBalance} --operator "$MANAGER"`
            ),
          ]
        : [];
    },
  },
});
