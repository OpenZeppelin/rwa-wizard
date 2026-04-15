import { PR_650 } from './review-urls';
import {
  createHookWiringVerificationInvocation,
  createModuleInvocation,
  defineComplianceModuleDescriptor,
  getOptionalScalarConfigValue,
} from './shared';

export const maxBalanceModule = defineComplianceModuleDescriptor({
  id: 'max-balance',
  name: 'Max Balance',
  description: 'Limits the maximum token balance per identity',
  requiredHooks: ['canTransfer', 'canCreate', 'transferred', 'created', 'destroyed'],
  crateName: 'max-balance',
  review: { state: 'under-review', prUrl: PR_650 },
  configFields: [
    {
      key: 'maxBalance',
      label: 'Max Balance',
      type: 'number',
      required: true,
      placeholder: 'e.g. 50000',
      hint: 'Maximum token balance per identity (in smallest token units)',
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
              `--token "$RWA_TOKEN_ADDRESS" --max ${maxBalance}`
            ),
          ]
        : [];
    },
    getPostRegistrationInvocations() {
      return [createHookWiringVerificationInvocation()];
    },
  },
});
