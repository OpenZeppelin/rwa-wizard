import { PR_652 } from './review-urls';
import {
  createModuleInvocation,
  defineComplianceModuleDescriptor,
  getOptionalScalarConfigValue,
  serializeLimitStruct,
} from './shared';

export const timeTransfersLimitsModule = defineComplianceModuleDescriptor({
  id: 'time-transfers-limits',
  name: 'Time-based Transfer Limits',
  description: 'Limits the volume of tokens an identity can transfer within rolling time windows',
  requiredHooks: ['canTransfer', 'transferred'],
  crateName: 'time-transfers-limits',
  review: { state: 'under-review', prUrl: PR_652 },
  configFields: [
    {
      key: 'limitTime',
      label: 'Window Duration (seconds)',
      type: 'number',
      required: true,
      placeholder: 'e.g. 86400',
      hint: 'Rolling time window in seconds (1 day = 86400)',
    },
    {
      key: 'limitValue',
      label: 'Transfer Limit',
      type: 'number',
      required: true,
      placeholder: 'e.g. 100000',
      hint: 'Maximum transfer volume within the time window (in smallest token units)',
    },
  ],
  deployment: {
    requiresIdentityRegistryStorage: true,
    getConfigurationInvocations(selection) {
      const limitTime = getOptionalScalarConfigValue(selection, 'limitTime');
      const limitValue = getOptionalScalarConfigValue(selection, 'limitValue');
      return limitTime && limitValue
        ? [
            createModuleInvocation(
              'set_time_transfer_limit',
              `--token "$RWA_TOKEN_ADDRESS" --limit ${serializeLimitStruct(limitTime, limitValue)}`
            ),
          ]
        : [];
    },
  },
});
