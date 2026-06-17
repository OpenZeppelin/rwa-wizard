import {
  createModuleInvocation,
  defineComplianceModuleDescriptor,
  getOptionalStringArrayConfigValue,
  serializeStringArray,
} from './shared';

export const transferAllowModule = defineComplianceModuleDescriptor({
  id: 'transfer-allow',
  name: 'Transfer Allow-list',
  requiredHooks: ['transferred'],
  crateName: 'compliance-transfer-allow',
  review: { state: 'stable' },
  configFields: [
    {
      key: 'allowedUsers',
      label: 'Allowed Users',
      type: 'string[]',
      required: false,
      placeholder: 'e.g. G..., G...',
    },
  ],
  deployment: {
    requiresIdentityRegistryStorage: false,
    getConfigurationInvocations(selection) {
      const allowedUsers = getOptionalStringArrayConfigValue(selection, 'allowedUsers');
      return allowedUsers && allowedUsers.length > 0
        ? [
            createModuleInvocation(
              'batch_allow_users',
              `--token "$RWA_TOKEN_ADDRESS" --users ${serializeStringArray(allowedUsers)} --operator "$MANAGER"`
            ),
          ]
        : [];
    },
  },
});
