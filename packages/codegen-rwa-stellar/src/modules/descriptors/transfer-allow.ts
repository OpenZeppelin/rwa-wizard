import {
  createModuleInvocation,
  defineComplianceModuleDescriptor,
  getOptionalStringArrayConfigValue,
  serializeStringArray,
} from './shared';

export const transferAllowModule = defineComplianceModuleDescriptor({
  id: 'transfer-allow',
  name: 'Transfer Allow-list',
  category: 'access-and-velocity',
  runtimePrerequisites: [],
  requiredHooks: ['transferred'],
  crateName: 'compliance-transfer-allow',
  review: { state: 'stable' },
  configFields: [
    {
      key: 'allowedUsers',
      label: 'Allowed Users',
      type: 'string[]',
      required: false,
      valueKind: 'address-list',
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
