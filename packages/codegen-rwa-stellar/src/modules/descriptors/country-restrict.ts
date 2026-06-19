import {
  createModuleInvocation,
  defineComplianceModuleDescriptor,
  getOptionalNumericCountryCodes,
  serializeNumericArray,
} from './shared';

export const countryRestrictModule = defineComplianceModuleDescriptor({
  id: 'country-restrict',
  name: 'Country Restriction',
  category: 'jurisdiction',
  runtimePrerequisites: ['identity-registry'],
  requiredHooks: ['transferred', 'created'],
  crateName: 'compliance-country-restrict',
  review: { state: 'stable' },
  configFields: [
    {
      key: 'restrictedCountries',
      label: 'Restricted Countries',
      type: 'string[]',
      required: false,
      placeholder: 'e.g. US, KP',
      valueKind: 'country-code-list',
    },
  ],
  deployment: {
    requiresIdentityRegistryStorage: true,
    getConfigurationInvocations(selection) {
      const countriesToRestrict = getOptionalNumericCountryCodes(selection, 'restrictedCountries');
      return countriesToRestrict.length > 0
        ? [
            createModuleInvocation(
              'batch_restrict_countries',
              `--token "$RWA_TOKEN_ADDRESS" --countries ${serializeNumericArray(countriesToRestrict)} --operator "$MANAGER"`
            ),
          ]
        : [];
    },
  },
});
