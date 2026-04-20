import { PR_650 } from './review-urls';
import {
  createHookWiringVerificationInvocation,
  createModuleInvocation,
  defineComplianceModuleDescriptor,
  getOptionalScalarConfigValue,
} from './shared';

export const supplyLimitModule = defineComplianceModuleDescriptor({
  id: 'supply-limit',
  name: 'Supply Limit',
  requiredHooks: ['canCreate', 'created', 'destroyed'],
  crateName: 'supply-limit',
  review: { state: 'under-review', prUrl: PR_650 },
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
              `--token "$RWA_TOKEN_ADDRESS" --limit ${limit}`
            ),
          ]
        : [];
    },
    getPostRegistrationInvocations() {
      return [createHookWiringVerificationInvocation()];
    },
  },
});
