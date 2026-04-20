import { PR_651 } from './review-urls';
import { defineComplianceModuleDescriptor } from './shared';

export const transferRestrictModule = defineComplianceModuleDescriptor({
  id: 'transfer-restrict',
  name: 'Transfer Restriction',
  requiredHooks: ['canTransfer'],
  crateName: 'transfer-restrict',
  review: { state: 'under-review', prUrl: PR_651 },
  configFields: [],
  deployment: {
    requiresIdentityRegistryStorage: false,
    getConfigurationInvocations() {
      return [];
    },
  },
});
