import {
  createModuleInvocation,
  defineComplianceModuleDescriptor,
  getOptionalScalarConfigValue,
} from './shared';

export const initialLockupPeriodModule = defineComplianceModuleDescriptor({
  id: 'initial-lockup-period',
  name: 'Initial Lockup Period',
  requiredHooks: ['transferred', 'created', 'destroyed'],
  crateName: 'compliance-initial-lockup-period',
  review: { state: 'stable' },
  configFields: [
    {
      key: 'lockupPeriodLedgers',
      label: 'Lockup Duration (ledgers)',
      type: 'number',
      required: true,
      placeholder: 'e.g. 17280',
    },
  ],
  deployment: {
    requiresIdentityRegistryStorage: false,
    getConfigurationInvocations(selection) {
      const lockupPeriodLedgers = getOptionalScalarConfigValue(selection, 'lockupPeriodLedgers');
      return lockupPeriodLedgers
        ? [
            createModuleInvocation(
              'set_lockup_period',
              `--token "$RWA_TOKEN_ADDRESS" --period ${lockupPeriodLedgers} --operator "$MANAGER"`
            ),
          ]
        : [];
    },
  },
});
