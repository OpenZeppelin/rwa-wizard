import {
  createModuleInvocation,
  defineComplianceModuleDescriptor,
  getOptionalScalarConfigValue,
  serializeLimitStruct,
} from './shared';

export const timeTransfersLimitsModule = defineComplianceModuleDescriptor({
  id: 'time-transfers-limits',
  name: 'Time-based Transfer Limits',
  category: 'access-and-velocity',
  runtimePrerequisites: ['identity-registry'],
  requiredHooks: ['transferred'],
  crateName: 'compliance-time-transfers-limits',
  review: { state: 'stable' },
  configFields: [
    {
      key: 'limitDurationLedgers',
      label: 'Window Duration (ledgers)',
      type: 'number',
      required: true,
      placeholder: 'e.g. 17280',
    },
    {
      key: 'limitValue',
      label: 'Transfer Limit',
      type: 'number',
      required: true,
      placeholder: 'e.g. 100000',
    },
  ],
  deployment: {
    requiresIdentityRegistryStorage: true,
    getConfigurationInvocations(selection) {
      const limitDurationLedgers = getOptionalScalarConfigValue(selection, 'limitDurationLedgers');
      const limitValue = getOptionalScalarConfigValue(selection, 'limitValue');
      return limitDurationLedgers && limitValue
        ? [
            createModuleInvocation(
              'set_time_transfer_limit',
              `--token "$RWA_TOKEN_ADDRESS" --limit ${serializeLimitStruct(limitDurationLedgers, limitValue)} --operator "$MANAGER"`
            ),
          ]
        : [];
    },
  },
});
