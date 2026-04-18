import { PR_652 } from './review-urls';
import {
  createHookWiringVerificationInvocation,
  createModuleInvocation,
  defineComplianceModuleDescriptor,
  getOptionalScalarConfigValue,
} from './shared';

export const initialLockupPeriodModule = defineComplianceModuleDescriptor({
  id: 'initial-lockup-period',
  name: 'Initial Lockup Period',
  requiredHooks: ['canTransfer', 'created', 'transferred', 'destroyed'],
  crateName: 'initial-lockup-period',
  review: { state: 'under-review', prUrl: PR_652 },
  configFields: [
    {
      key: 'lockupSeconds',
      label: 'Lockup Duration (seconds)',
      type: 'number',
      required: true,
      placeholder: 'e.g. 2592000',
    },
  ],
  deployment: {
    requiresIdentityRegistryStorage: false,
    getConfigurationInvocations(selection) {
      const lockupSeconds = getOptionalScalarConfigValue(selection, 'lockupSeconds');
      return lockupSeconds
        ? [
            createModuleInvocation(
              'set_lockup_period',
              `--token "$RWA_TOKEN_ADDRESS" --lockup_seconds ${lockupSeconds}`
            ),
          ]
        : [];
    },
    getPostRegistrationInvocations() {
      return [createHookWiringVerificationInvocation()];
    },
  },
});
