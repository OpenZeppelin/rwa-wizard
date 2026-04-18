import { PR_652 } from './review-urls';
import {
  createHookWiringVerificationInvocation,
  createModuleInvocation,
  defineComplianceModuleDescriptor,
  getOptionalScalarConfigValue,
  serializeLimitStruct,
} from './shared';

export const timeTransfersLimitsModule = defineComplianceModuleDescriptor({
  id: 'time-transfers-limits',
  name: 'Time-based Transfer Limits',
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
    getPostRegistrationInvocations() {
      return [createHookWiringVerificationInvocation()];
    },
  },
});
